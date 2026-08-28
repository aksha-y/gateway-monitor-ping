import db from './lib/db';
import ping from 'ping';
import nodemailer from 'nodemailer';
import { decrypt } from './lib/crypto';

// Configuration
const INTERVAL_MS = 60 * 1000;
const TIMEOUT_SEC = 5;
const RETRIES = 2;
const DOWN_THRESHOLD_MS = 5 * 60 * 1000;
const EXTERNAL_PING_HOST = '1.1.1.1';

// To track overlapping checks
const activeChecks = new Set<string>();

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
    SELECT a.*, p.property_name, p.gateway_ip
    FROM alerts a
    JOIN properties p ON a.property_id = p.property_id
    WHERE a.status = 'PENDING'
    ORDER BY a.created_at ASC
    LIMIT 10
  `).all() as any[];

  if (pendingAlerts.length === 0) return;

  const settings = db.prepare('SELECT * FROM smtp_settings WHERE id = 1').get() as any;
  if (!settings || !settings.host || !settings.password_enc) {
    console.warn('[EmailQueue] SMTP not fully configured. Delaying alerts.');
    return;
  }

  const recipients = db.prepare('SELECT email FROM notification_recipients WHERE enabled = 1').all() as any[];
  if (recipients.length === 0) {
    console.warn('[EmailQueue] No enabled recipients. Marking alerts as FAILED.');
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
Gateway IP: ${alert.gateway_ip}
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
      
      // Update outage alert_time
      if (alert.alert_type === 'DOWN') {
        db.prepare(`UPDATE outages SET alert_time = ? WHERE outage_id = ?`).run(now, alert.outage_id);
      }
      
      logHistory(alert.property_id, alert.alert_type === 'DOWN' ? 'Alert Sent' : 'Recovery Email Sent', `Outage ID: ${alert.outage_id}`);
      
    } catch (err: any) {
      console.error(`[EmailQueue] Failed to send alert ${alert.id}:`, err.message);
      db.prepare(`UPDATE alerts SET status = 'FAILED', error_message = ? WHERE id = ?`).run(err.message, alert.id);
    }
  }
}

async function checkProperty(property: any) {
  if (activeChecks.has(property.property_id)) return;
  activeChecks.add(property.property_id);

  try {
    const currentState = db.prepare('SELECT * FROM monitoring_state WHERE property_id = ?').get(property.property_id) as any;
    if (!currentState) return;

    if (currentState.current_status === 'MAINTENANCE') {
      // Skip pinging during maintenance
      return;
    }

    let reachable = false;
    let time: number | null = null;
    let pingError = false;

    for (let attempt = 1; attempt <= 1 + RETRIES; attempt++) {
      try {
        const res = await ping.promise.probe(property.gateway_ip, { timeout: TIMEOUT_SEC });
        if (res.alive) {
          reachable = true;
          time = typeof res.time === 'number' ? res.time : null;
          break;
        }
      } catch (err) {
        pingError = true;
      }
    }

    const nowStr = new Date().toISOString();
    const now = new Date().getTime();

    if (pingError && !reachable) {
      if (currentState.current_status !== 'MONITORING_ERROR') {
        logHistory(property.property_id, 'MONITORING_ERROR', 'Failed to execute ping command');
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
        SET current_status = 'ONLINE', last_check = ?, last_success = ?, response_time = ?, failure_count = 0, first_failure = NULL, downtime_start = NULL, total_downtime_seconds = ?, current_outage_id = NULL
        WHERE property_id = ?
      `).run(nowStr, nowStr, time, newDowntimeTotal, property.property_id);

    } else {
      const hasInternet = await checkInternetAccess();
      if (!hasInternet) {
        console.warn(`[Worker] Server lost internet. Suppressing DOWN alert for ${property.property_id}`);
        db.prepare(`UPDATE monitoring_state SET last_check = ? WHERE property_id = ?`).run(nowStr, property.property_id);
        return;
      }

      const currentFailures = (currentState.failure_count || 0) + 1;
      let newStatus = currentState.current_status;
      let firstFailure = currentState.first_failure;
      let downtimeStart = currentState.downtime_start;
      let outageId = currentState.current_outage_id;

      if (currentState.current_status === 'ONLINE' || currentState.current_status === 'NOT_CHECKED') {
        newStatus = 'POSSIBLE_DOWN';
        firstFailure = nowStr;
        logHistory(property.property_id, 'POSSIBLE_DOWN', 'Gateway failed a ping check');
      } else if (currentState.current_status === 'POSSIBLE_DOWN') {
        if (firstFailure) {
          const firstFailTime = new Date(firstFailure).getTime();
          if (now - firstFailTime >= DOWN_THRESHOLD_MS) {
            newStatus = 'DOWN';
            downtimeStart = nowStr;
            outageId = `OUTAGE-${new Date().toISOString().replace(/\D/g,'').slice(0, 14)}-${Math.floor(Math.random() * 10000)}`;
            
            logHistory(property.property_id, 'DOWN', 'Gateway unreachable for 5 minutes');

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
  } catch (error) {
    console.error(`[Worker] Fatal error checking ${property.property_id}:`, error);
  } finally {
    activeChecks.delete(property.property_id);
  }
}

async function runMonitorCycle() {
  try {
    updateHeartbeat();
    const properties = db.prepare(`SELECT * FROM properties WHERE enabled = 1`).all() as any[];
    db.prepare(`UPDATE monitoring_state SET current_status = 'DISABLED' WHERE property_id IN (SELECT property_id FROM properties WHERE enabled = 0)`).run();
    if (properties.length > 0) {
      const concurrencyLimit = 20;
      for (let i = 0; i < properties.length; i += concurrencyLimit) {
        const chunk = properties.slice(i, i + concurrencyLimit);
        await Promise.all(chunk.map(p => checkProperty(p)));
      }
    }
    
    // Process email queue independently of ping checks
    await processEmailQueue();
  } catch (error) {
    console.error(`[Worker] Error in cycle:`, error);
  }
}

runMonitorCycle();
setInterval(runMonitorCycle, INTERVAL_MS);
console.log(`[Worker] Engine started. Interval: ${INTERVAL_MS/1000}s`);
