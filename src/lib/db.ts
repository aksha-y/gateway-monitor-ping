import Database from 'better-sqlite3';
import path from 'path';

// Using a persistent file in the root of the project
const dbPath = path.join(process.cwd(), 'unifi-monitoring.db');
const db = new Database(dbPath);

// Initialize DB schema
db.exec(`
  CREATE TABLE IF NOT EXISTS properties (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    property_id TEXT UNIQUE NOT NULL,
    property_name TEXT NOT NULL,
    gateway_ip TEXT NOT NULL,
    enabled INTEGER DEFAULT 1,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS monitoring_state (
    property_id TEXT PRIMARY KEY,
    current_status TEXT DEFAULT 'NOT_CHECKED',
    last_check DATETIME,
    last_success DATETIME,
    last_failure DATETIME,
    first_failure DATETIME,
    downtime_start DATETIME,
    total_downtime_seconds INTEGER DEFAULT 0,
    response_time INTEGER,
    failure_count INTEGER DEFAULT 0,
    FOREIGN KEY(property_id) REFERENCES properties(property_id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS smtp_settings (
    id INTEGER PRIMARY KEY CHECK (id = 1), -- Single row config
    host TEXT,
    port INTEGER,
    username TEXT,
    password_enc TEXT,
    security TEXT DEFAULT 'STARTTLS',
    from_email TEXT,
    from_name TEXT,
    reply_to TEXT
  );

  CREATE TABLE IF NOT EXISTS notification_recipients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    enabled INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS alerts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    property_id TEXT NOT NULL,
    outage_id TEXT NOT NULL,
    alert_type TEXT NOT NULL, -- 'DOWN' or 'RECOVERY'
    status TEXT DEFAULT 'PENDING', -- 'PENDING', 'SENT', 'FAILED'
    sent_at DATETIME,
    error_message TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(property_id) REFERENCES properties(property_id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS monitoring_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    property_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    details TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(property_id) REFERENCES properties(property_id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS outages (
    outage_id TEXT PRIMARY KEY,
    property_id TEXT NOT NULL,
    start_time DATETIME NOT NULL,
    alert_time DATETIME,
    recovery_time DATETIME,
    total_downtime_seconds INTEGER,
    status TEXT DEFAULT 'ONGOING', -- 'ONGOING', 'RESOLVED'
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(property_id) REFERENCES properties(property_id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL,
    action TEXT NOT NULL,
    details TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS system_health (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    last_worker_heartbeat DATETIME
  );
`);

// Simple migrations
try {
  const tableInfo = db.prepare("PRAGMA table_info(monitoring_state)").all() as any[];
  const columns = tableInfo.map(col => col.name);
  if (!columns.includes('first_failure')) {
    db.exec("ALTER TABLE monitoring_state ADD COLUMN first_failure DATETIME;");
  }
  if (!columns.includes('downtime_start')) {
    db.exec("ALTER TABLE monitoring_state ADD COLUMN downtime_start DATETIME;");
  }
  if (!columns.includes('total_downtime_seconds')) {
    db.exec("ALTER TABLE monitoring_state ADD COLUMN total_downtime_seconds INTEGER DEFAULT 0;");
  }
  if (!columns.includes('current_outage_id')) {
    db.exec("ALTER TABLE monitoring_state ADD COLUMN current_outage_id TEXT;");
  }
} catch (e) {
  console.error("Migration error:", e);
}

// Seed default admin if no users exist
try {
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
  if (userCount.count === 0) {
    // default password: password123
    // generated using bcryptjs.hashSync('password123', 10)
    const defaultHash = '$2b$10$DMB1IzAUT3ockTt5.BpBMeLHbXot.cr0jw3KwvOOTAJ88.9D5QxkG'; 
    db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)').run('admin', defaultHash);
  }
} catch (e) {
  console.error("Seed error:", e);
}

export default db;
