import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { encrypt } from '@/lib/crypto';

export async function GET() {
  try {
    const settings = db.prepare('SELECT * FROM smtp_settings WHERE id = 1').get() as any;
    
    if (settings) {
      // Obfuscate password
      settings.hasPassword = !!settings.password_enc;
      settings.password = settings.hasPassword ? '********' : '';
      delete settings.password_enc;
    }
    
    return NextResponse.json(settings || {});
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { host, port, username, password, security, from_email, from_name, reply_to } = body;

    let updates = [];
    let values = [];

    if (host !== undefined) { updates.push('host = ?'); values.push(host); }
    if (port !== undefined) { updates.push('port = ?'); values.push(port); }
    if (username !== undefined) { updates.push('username = ?'); values.push(username); }
    if (security !== undefined) { updates.push('security = ?'); values.push(security); }
    if (from_email !== undefined) { updates.push('from_email = ?'); values.push(from_email); }
    if (from_name !== undefined) { updates.push('from_name = ?'); values.push(from_name); }
    if (reply_to !== undefined) { updates.push('reply_to = ?'); values.push(reply_to); }
    
    // Only update password if a new one is provided (not '********' or empty string if preserving)
    if (password && password !== '********') {
      updates.push('password_enc = ?');
      values.push(encrypt(password));
    } else if (password === '') {
      // Allow clearing the password
      updates.push('password_enc = ?');
      values.push(null);
    }

    if (updates.length > 0) {
      // Check if row exists
      const exists = db.prepare('SELECT id FROM smtp_settings WHERE id = 1').get();
      if (!exists) {
        db.prepare(`
          INSERT INTO smtp_settings (id) VALUES (1)
        `).run();
      }

      const stmt = db.prepare(`
        UPDATE smtp_settings
        SET ${updates.join(', ')}
        WHERE id = 1
      `);
      stmt.run(...values);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
