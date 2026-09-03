import { NextResponse } from 'next/server';
import db from '@/lib/db';
import bcrypt from 'bcryptjs';

export async function GET(request: Request) {
  const role = request.headers.get('x-user-role');
  if (role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  try {
    const users = db.prepare('SELECT id, username, role, name, email, enabled, last_login, created_at FROM users').all();
    return NextResponse.json(users);
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
    const { username, password, userRole, name, email, enabled } = await request.json();
    
    if (!username || !password) {
      return NextResponse.json({ error: 'Username and password required' }, { status: 400 });
    }

    const hash = bcrypt.hashSync(password, 10);
    const result = db.prepare(`
      INSERT INTO users (username, password_hash, role, name, email, enabled)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(username, hash, userRole || 'ADMIN', name || null, email || null, enabled ? 1 : 0);

    return NextResponse.json({ id: result.lastInsertRowid, success: true });
  } catch (error: any) {
    if (error.message.includes('UNIQUE constraint failed')) {
      return NextResponse.json({ error: 'Username already exists' }, { status: 400 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
