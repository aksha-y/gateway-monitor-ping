import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { encrypt } from '@/lib/crypto';

export async function PUT(request: Request, context: any) {
  const params = await context.params;
  const id = params.id;
  const role = request.headers.get('x-user-role');
  if (role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  try {
    const { name, url, username, password, enabled } = await request.json();

    if (password) {
      const password_enc = encrypt(password);
      db.prepare(`
        UPDATE unifi_controllers 
        SET name = ?, url = ?, username = ?, password_enc = ?, enabled = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(name, url, username, password_enc, enabled ? 1 : 0, id);
    } else {
      db.prepare(`
        UPDATE unifi_controllers 
        SET name = ?, url = ?, username = ?, enabled = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(name, url, username, enabled ? 1 : 0, id);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: any) {
  const params = await context.params;
  const id = params.id;
  const role = request.headers.get('x-user-role');
  if (role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  try {
    // Note: If a controller is deleted, what happens to its properties?
    // They will fail gracefully to MONITORING_ERROR since controller won't exist.
    db.prepare('DELETE FROM unifi_controllers WHERE id = ?').run(id);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
