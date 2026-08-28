import db from './db';

export function logAuditAction(request: Request, action: string, details?: string) {
  try {
    const username = request.headers.get('x-user-username') || 'system';
    db.prepare(`
      INSERT INTO audit_log (username, action, details)
      VALUES (?, ?, ?)
    `).run(username, action, details || null);
  } catch (error) {
    console.error('Audit Log Error:', error);
  }
}

export function logAuditActionSync(username: string, action: string, details?: string) {
  try {
    db.prepare(`
      INSERT INTO audit_log (username, action, details)
      VALUES (?, ?, ?)
    `).run(username, action, details || null);
  } catch (error) {
    console.error('Audit Log Error:', error);
  }
}
