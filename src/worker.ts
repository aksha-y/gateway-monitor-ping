import db from './lib/db';
import ping from 'ping';
import nodemailer from 'nodemailer';
import { decrypt } from './lib/crypto';
import { UnifiClient } from './lib/unifi';

// Configuration
const INTERVAL_MS = 60 * 1000;
const TIMEOUT_SEC = 5;
const RETRIES = 2;
const DOWN_THRESHOLD_MS = 10 * 60 * 1000; // 10 minutes
const EXTERNAL_PING_HOST = '1.1.1.1';

// To track overlapping checks
const activeChecks = new Set<string>();
const activeControllers = new Set<number>();

function logHistory(property_id: string, event_type: string, details: string = '') {
  try {
    db.prepare(`
      INSERT INTO monitoring_history (property_id, event_type, details)
      VALUES (?, ?, ?)
    `).run(property_id, event_type, details);
  } catch (e) {
    console.error(`Failed to log history for ${property_id}`, e);
  }
}

async function checkInternetAccess(): Promise<boolean> {
  try {
    const res = await ping.promise.probe(EXTERNAL_PING_HOST, { timeout: 3 });
    return res.alive;
  } catch {
    return false;
  }
}

function updateHeartbeat() {
  try {
    db.prepare(`
      INSERT INTO system_health (id, last_worker_heartbeat) 
      VALUES (1, ?) 
      ON CONFLICT(id) DO UPDATE SET last_worker_heartbeat=excluded.last_worker_heartbeat
    `).run(new Date().toISOString());
  } catch (e) {
    // ignore
  }
}

async function processEmailQueue() {
  const pendingAlerts = db.prepare(`
    SELECT a.*, p.property_name, p.gateway_ip, p.monitoring_method, p.gateway_name
    FROM alerts a
    JOIN properties p ON a.property_id = p.property_id
    WHERE a.status = 'PENDING'
    ORDER BY a.created_at ASC
    LIMIT 10
  `).all() as any[];

  if (pendingAlerts.length === 0) return;

  const settings = db.prepare('SELECT * FROM smtp_settings WHERE id = 1').get() as any;
  if (!settings || !settings.host || !settings.password_enc) return;

  const recipients = db.prepare('SELECT email FROM notification_recipients WHERE enabled = 1').all() as any[];
  if (recipients.length === 0) {
    db.prepare(`UPDATE alerts SET status = 'FAILED', error_message = 'No enabled recipients' WHERE status = 'PENDING'`).run();
    return;
  }

  const toList = recipients.map(r => r.email).join(', ');
  const password = decrypt(settings.password_enc);

  const transporter = nodemailer.createTransport({
    host: settings.host,
    port: settings.port,
    secure: settings.security === 'SSL/TLS',
    requireTLS: settings.security === 'STARTTLS',
    auth: { user: settings.username, pass: password }
  });

  for (const alert of pendingAlerts) {
    try {
      const subject = alert.alert_type === 'DOWN' 
        ? `ALERT - UniFi Gateway Down - ${alert.property_id} - ${alert.property_name}`
        : `RECOVERED - UniFi Gateway Online - ${alert.property_id} - ${alert.property_name}`;

      const text = `
Property ID: ${alert.property_id}
Property Name: ${alert.property_name}
Monitoring Method: ${alert.monitoring_method}
Gateway: ${alert.monitoring_method === 'ICMP' ? alert.gateway_ip : alert.gateway_name}
Alert Type: ${alert.alert_type}
Outage ID: ${alert.outage_id}
      `.trim();

      await transporter.sendMail({
        from: settings.from_name ? `"${settings.from_name}" <${settings.from_email}>` : settings.from_email,
        to: toList,
        replyTo: settings.reply_to || undefined,
        subject,
        text
      });

      const now = new Date().toISOString();
      db.prepare(`UPDATE alerts SET status = 'SENT', sent_at = ? WHERE id = ?`).run(now, alert.id);
      
      if (alert.alert_type === 'DOWN') {
        db.prepare(`UPDATE outages SET alert_time = ? WHERE outage_id = ?`).run(now, alert.outage_id);
      }
      logHistory(alert.property_id, alert.alert_type === 'DOWN' ? 'Alert Sent' : 'Recovery Email Sent', `Outage ID: ${alert.outage_id}`);
    } catch (err: any) {
      db.prepare(`UPDATE alerts SET status = 'FAILED', error_message = ? WHERE id = ?`).run(err.message, alert.id);
    }
  }
}

async function handlePropertyStateUpdate(property: any, reachable: boolean, pingError: boolean = false) {
  const currentState = db.prepare('SELECT * FROM monitoring_state WHERE property_id = ?').get(property.property_id) as any;
  if (!currentState) return;
  if (currentState.current_status === 'MAINTENANCE') return;

  const nowStr = new Date().toISOString();
  const now = new Date().getTime();

  if (pingError && !reachable) {
    if (currentState.current_status !== 'MONITORING_ERROR') {
      logHistory(property.property_id, 'MONITORING_ERROR', 'Failed to execute check');
    }
    db.prepare(`UPDATE monitoring_state SET current_status = 'MONITORING_ERROR', last_check = ? WHERE property_id = ?`).run(nowStr, property.property_id);
    return;
  }

  if (reachable) {
    let newDowntimeTotal = currentState.total_downtime_seconds || 0;
    
    if (currentState.current_status === 'DOWN' && currentState.downtime_start) {
      const downtimeMs = now - new Date(currentState.downtime_start).getTime();
      const downtimeSec = Math.floor(downtimeMs / 1000);
      newDowntimeTotal += downtimeSec;
      
      if (currentState.current_outage_id) {
        db.prepare(`
          INSERT INTO alerts (property_id, outage_id, alert_type)
          VALUES (?, ?, 'RECOVERY')
        `).run(property.property_id, currentState.current_outage_id);
        
        db.prepare(`
          UPDATE outages SET recovery_time = ?, total_downtime_seconds = ?, status = 'RESOLVED' WHERE outage_id = ?
        `).run(nowStr, downtimeSec, currentState.current_outage_id);
      }
      logHistory(property.property_id, 'RECOVERED', `Downtime: ${downtimeSec}s`);
    } else if (currentState.current_status !== 'ONLINE') {
      logHistory(property.property_id, 'ONLINE');
    }

    db.prepare(`
      UPDATE monitoring_state 
      SET current_status = 'ONLINE', last_check = ?, last_success = ?, failure_count = 0, first_failure = NULL, downtime_start = NULL, total_downtime_seconds = ?, current_outage_id = NULL
      WHERE property_id = ?
    `).run(nowStr, nowStr, newDowntimeTotal, property.property_id);

  } else {
    // If ICMP and no internet, skip marking down
    if (property.monitoring_method === 'ICMP') {
      const hasInternet = await checkInternetAccess();
      if (!hasInternet) {
        db.prepare(`UPDATE monitoring_state SET last_check = ? WHERE property_id = ?`).run(nowStr, property.property_id);
        return;
      }
    }

    const currentFailures = (currentState.failure_count || 0) + 1;
    let newStatus = currentState.current_status;
    let firstFailure = currentState.first_failure;
    let downtimeStart = currentState.downtime_start;
    let outageId = currentState.current_outage_id;

    if (currentState.current_status === 'ONLINE' || currentState.current_status === 'NOT_CHECKED') {
      newStatus = 'POSSIBLE_DOWN';
      firstFailure = nowStr;
      logHistory(property.property_id, 'POSSIBLE_DOWN', 'Gateway check failed');
    } else if (currentState.current_status === 'POSSIBLE_DOWN') {
      if (firstFailure) {
        const firstFailTime = new Date(firstFailure).getTime();
        if (now - firstFailTime >= DOWN_THRESHOLD_MS) {
          newStatus = 'DOWN';
          downtimeStart = nowStr;
          outageId = `OUTAGE-${new Date().toISOString().replace(/\D/g,'').slice(0, 14)}-${Math.floor(Math.random() * 10000)}`;
          
          logHistory(property.property_id, 'DOWN', 'Gateway unreachable for 10 minutes');

          db.prepare(`
            INSERT INTO outages (outage_id, property_id, start_time)
            VALUES (?, ?, ?)
          `).run(outageId, property.property_id, downtimeStart);

          db.prepare(`
            INSERT INTO alerts (property_id, outage_id, alert_type)
            VALUES (?, ?, 'DOWN')
          `).run(property.property_id, outageId);
        }
      } else {
        firstFailure = nowStr;
      }
    }

    db.prepare(`
      UPDATE monitoring_state 
      SET current_status = ?, last_check = ?, last_failure = ?, failure_count = ?, first_failure = ?, downtime_start = ?, current_outage_id = ?
      WHERE property_id = ?
    `).run(newStatus, nowStr, nowStr, currentFailures, firstFailure, downtimeStart, outageId, property.property_id);
  }
}

async function checkICMPProperty(property: any) {
  if (activeChecks.has(property.property_id)) return;
  activeChecks.add(property.property_id);

  try {
    let reachable = false;
    let pingError = false;

    for (let attempt = 1; attempt <= 1 + RETRIES; attempt++) {
      try {
        const res = await ping.promise.probe(property.gateway_ip, { timeout: TIMEOUT_SEC });
        if (res.alive) {
          reachable = true;
          break;
        }
      } catch (err) {
        pingError = true;
      }
    }

    await handlePropertyStateUpdate(property, reachable, pingError);
  } finally {
    activeChecks.delete(property.property_id);
  }
}

async function checkControllerBatch(controllerId: number, properties: any[]) {
  if (activeControllers.has(controllerId)) return;
  activeControllers.add(controllerId);

  try {
    const controller = db.prepare('SELECT * FROM unifi_controllers WHERE id = ?').get(controllerId) as any;
    if (!controller || controller.enabled === 0) {
      for (const p of properties) {
        await handlePropertyStateUpdate(p, false, true); // mark monitoring error
      }
      return;
    }

    const password = decrypt(controller.password_enc);
    const client = new UnifiClient(controller.url);
    const loggedIn = await client.login(controller.username, password);

    if (!loggedIn) {
      console.warn(`[Worker] Failed to login to controller ${controller.name}`);
      for (const p of properties) {
        await handlePropertyStateUpdate(p, false, true);
      }
      return;
    }

    // Group properties by site
    const propertiesBySite: Record<string, any[]> = {};
    for (const p of properties) {
      if (!p.site_name) continue;
      if (!propertiesBySite[p.site_name]) propertiesBySite[p.site_name] = [];
      propertiesBySite[p.site_name].push(p);
    }

    for (const siteName of Object.keys(propertiesBySite)) {
      const siteProps = propertiesBySite[siteName];
      try {
        const devices = await client.getDevices(siteName);
        for (const p of siteProps) {
          const device = devices.find((d: any) => d.mac === p.device_mac || d.device_id === p.device_id);
          if (!device) {
            await handlePropertyStateUpdate(p, false, true); // Gateway not found
            continue;
          }
          // state 1 = online, 0 = offline
          const isOnline = device.state === 1;
          await handlePropertyStateUpdate(p, isOnline, false);
        }
      } catch (err) {
        console.error(`[Worker] Failed to fetch site devices for ${siteName} on controller ${controller.name}`);
        for (const p of siteProps) {
          await handlePropertyStateUpdate(p, false, true);
        }
      }
    }
  } catch (e) {
    console.error(`[Worker] Controller ${controllerId} error:`, e);
    for (const p of properties) {
      await handlePropertyStateUpdate(p, false, true);
    }
  } finally {
    activeControllers.delete(controllerId);
  }
}

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

async function runMonitorCycle() {
  try {
    updateHeartbeat();
    const properties = db.prepare(`SELECT * FROM properties WHERE enabled = 1`).all() as any[];
    db.prepare(`UPDATE monitoring_state SET current_status = 'DISABLED' WHERE property_id IN (SELECT property_id FROM properties WHERE enabled = 0)`).run();
    
    const icmpProps = properties.filter(p => p.monitoring_method === 'ICMP' || !p.monitoring_method);
    const controllerProps = properties.filter(p => p.monitoring_method === 'UNIFI_CONTROLLER' && p.controller_id);

    // Process ICMP in chunks
    if (icmpProps.length > 0) {
      const concurrencyLimit = 20;
      for (let i = 0; i < icmpProps.length; i += concurrencyLimit) {
        const chunk = icmpProps.slice(i, i + concurrencyLimit);
        await Promise.all(chunk.map(p => checkICMPProperty(p)));
      }
    }

    // Process Controllers with offset to avoid overload
    if (controllerProps.length > 0) {
      const propsByController: Record<number, any[]> = {};
      for (const p of controllerProps) {
        if (!propsByController[p.controller_id]) propsByController[p.controller_id] = [];
        propsByController[p.controller_id].push(p);
      }

      for (const [cIdStr, props] of Object.entries(propsByController)) {
        const cId = parseInt(cIdStr, 10);
        // Do not await to allow parallel processing, but stagger starts
        checkControllerBatch(cId, props);
        await delay(500); // 500ms offset between controller starts
      }
    }
    
    await processEmailQueue();
  } catch (error) {
    console.error(`[Worker] Error in cycle:`, error);
  }
}

runMonitorCycle();
setInterval(runMonitorCycle, INTERVAL_MS);
console.log(`[Worker] Engine started. Interval: ${INTERVAL_MS/1000}s`);
