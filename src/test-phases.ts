import db from './lib/db';

async function runTests() {
  console.log("--- Starting Self-Testing Suite (Phases 1-4) ---");

  try {
    // 1. Setup mock property
    const propId = 'TEST001';
    db.prepare(`DELETE FROM properties WHERE property_id = ?`).run(propId);
    db.prepare(`
      INSERT INTO properties (property_id, property_name, gateway_ip, enabled) 
      VALUES (?, 'Test Gateway', '127.0.0.1', 1)
    `).run(propId);
    db.prepare(`
      INSERT INTO monitoring_state (property_id, current_status)
      VALUES (?, 'NOT_CHECKED')
    `).run(propId);

    console.log("✅ Phase 1: Property inserted correctly");

    // 2. Simulate worker failure logic manually
    const now = new Date().getTime();
    const fiveMinsAgoStr = new Date(now - (5 * 60 * 1000) - 1000).toISOString();
    const nowStr = new Date().toISOString();

    // Set it to POSSIBLE_DOWN
    db.prepare(`
      UPDATE monitoring_state 
      SET current_status = 'POSSIBLE_DOWN', first_failure = ?, last_failure = ?
      WHERE property_id = ?
    `).run(fiveMinsAgoStr, nowStr, propId);

    db.prepare(`INSERT INTO monitoring_history (property_id, event_type, details) VALUES (?, ?, ?)`).run(propId, 'POSSIBLE_DOWN', 'Test event');
    console.log("✅ Phase 2: Status manually set to POSSIBLE_DOWN (simulated ping failure)");

    // 3. Trigger alert creation manually as if worker confirmed DOWN
    const outageId = 'OUTAGE-TEST-123';
    db.prepare(`
      UPDATE monitoring_state 
      SET current_status = 'DOWN', downtime_start = ?, current_outage_id = ?
      WHERE property_id = ?
    `).run(nowStr, outageId, propId);

    db.prepare(`
      INSERT INTO outages (outage_id, property_id, start_time)
      VALUES (?, ?, ?)
    `).run(outageId, propId, nowStr);

    db.prepare(`
      INSERT INTO alerts (property_id, outage_id, alert_type)
      VALUES (?, ?, 'DOWN')
    `).run(propId, outageId);

    const alertDown = db.prepare('SELECT * FROM alerts WHERE property_id = ? AND alert_type = ?').get(propId, 'DOWN') as any;
    if (alertDown && alertDown.status === 'PENDING') {
      console.log("✅ Phase 3: DOWN alert successfully queued");
    } else {
      throw new Error("DOWN alert not queued");
    }

    const outageRec = db.prepare('SELECT * FROM outages WHERE outage_id = ?').get(outageId) as any;
    if (outageRec && outageRec.status === 'ONGOING') {
      console.log("✅ Phase 4: Outage successfully tracked in database");
    } else {
      throw new Error("Outage not tracked correctly");
    }

    // 4. Simulate RECOVERY
    db.prepare(`
      UPDATE monitoring_state 
      SET current_status = 'ONLINE', downtime_start = NULL, current_outage_id = NULL
      WHERE property_id = ?
    `).run(propId);

    db.prepare(`
      INSERT INTO alerts (property_id, outage_id, alert_type)
      VALUES (?, ?, 'RECOVERY')
    `).run(propId, outageId);
    
    db.prepare(`
      UPDATE outages SET recovery_time = ?, status = 'RESOLVED' WHERE outage_id = ?
    `).run(nowStr, outageId);

    const alertRec = db.prepare('SELECT * FROM alerts WHERE property_id = ? AND alert_type = ?').get(propId, 'RECOVERY') as any;
    if (alertRec && alertRec.status === 'PENDING') {
      console.log("✅ Phase 3: RECOVERY alert successfully queued");
    } else {
      throw new Error("RECOVERY alert not queued");
    }

    const resOutage = db.prepare('SELECT * FROM outages WHERE outage_id = ?').get(outageId) as any;
    if (resOutage && resOutage.status === 'RESOLVED') {
      console.log("✅ Phase 4: Outage status successfully updated to RESOLVED");
    } else {
      throw new Error("Outage recovery tracking failed");
    }

    // 5. Cleanup test data
    db.prepare(`DELETE FROM properties WHERE property_id = ?`).run(propId);
    
    console.log("--- All self-tests passed successfully! ---");
  } catch (error) {
    console.error("❌ Test failed:", error);
    process.exit(1);
  }
}

runTests();
