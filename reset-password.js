const db = require('better-sqlite3')('unifi-monitoring.db');
const bcrypt = require('bcryptjs');
const hash = bcrypt.hashSync('password123', 10);
db.prepare('UPDATE users SET password_hash = ? WHERE username = ?').run(hash, 'admin');
console.log('Password reset properly to password123. Hash:', hash);
