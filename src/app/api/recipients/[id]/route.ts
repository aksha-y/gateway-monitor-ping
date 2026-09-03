import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, email, enabled } = body;

    let updates = [];
    let values = [];

    if (name !== undefined) { updates.push('name = ?'); values.push(name); }
    if (email !== undefined) { 
      const cleanEmail = email.replace(/[\s;]+/g, ',').replace(/,+/g, ',').replace(/^,|,$/g, '');
      updates.push('email = ?'); 
      values.push(cleanEmail); 
    }
    if (enabled !== undefined) { updates.push('enabled = ?'); values.push(enabled ? 1 : 0); }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    const stmt = db.prepare(`
      UPDATE notification_recipients
      SET ${updates.join(', ')}
      WHERE id = ?
    `);
    
    const info = stmt.run(...values);
    if (info.changes === 0) {
      return NextResponse.json({ error: 'Recipient not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const stmt = db.prepare('DELETE FROM notification_recipients WHERE id = ?');
    stmt.run(id);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
