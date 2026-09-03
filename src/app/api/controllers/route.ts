import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { encrypt } from '@/lib/crypto';

export async function GET(request: Request) {
  const role = request.headers.get('x-user-role');
  if (role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  try {
    const controllers = db.prepare('SELECT id, name, url, username, enabled, created_at, updated_at FROM unifi_controllers').all();
    return NextResponse.json(controllers);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const role = request.headers.get('x-user-role');
  if (role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  try {
    const { name, url, username, password, enabled } = await request.json();
    
    if (!name || !url || !username || !password) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const password_enc = encrypt(password);
    const result = db.prepare(`
      INSERT INTO unifi_controllers (name, url, username, password_enc, enabled)
      VALUES (?, ?, ?, ?, ?)
    `).run(name, url, username, password_enc, enabled ? 1 : 0);

    return NextResponse.json({ id: result.lastInsertRowid, success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
