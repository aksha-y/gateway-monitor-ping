import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET() {
  try {
    const recipients = db.prepare('SELECT * FROM notification_recipients ORDER BY name').all();
    return NextResponse.json(recipients);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, email, enabled } = body;

    if (!name || !email) {
      return NextResponse.json({ error: 'Name and Email are required' }, { status: 400 });
    }

    const cleanEmail = email.replace(/[\s;]+/g, ',').replace(/,+/g, ',').replace(/^,|,$/g, '');

    const stmt = db.prepare(`
      INSERT INTO notification_recipients (name, email, enabled)
      VALUES (?, ?, ?)
    `);
    
    const info = stmt.run(name, cleanEmail, enabled ? 1 : 0);
    return NextResponse.json({ success: true, id: info.lastInsertRowid });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
