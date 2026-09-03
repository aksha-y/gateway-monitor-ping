import { NextResponse } from 'next/server';
import db from '@/lib/db';
import bcrypt from 'bcryptjs';

export async function PUT(request: Request, context: any) {
  const params = await context.params;
  const id = params.id;
  
  const currentUserRole = request.headers.get('x-user-role');
  if (currentUserRole !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  try {
    const { username, password, userRole, name, email, enabled } = await request.json();
    
    // Check if updating self role
    const currentUsername = request.headers.get('x-user-username');
    const targetUser = db.prepare('SELECT username, role FROM users WHERE id = ?').get(id) as any;
    
    if (targetUser && targetUser.username === currentUsername && userRole !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Cannot remove own SUPER_ADMIN role' }, { status: 400 });
    }

    if (password) {
      const hash = bcrypt.hashSync(password, 10);
      db.prepare(`
        UPDATE users 
        SET username = ?, password_hash = ?, role = ?, name = ?, email = ?, enabled = ?
        WHERE id = ?
      `).run(username, hash, userRole || 'ADMIN', name || null, email || null, enabled ? 1 : 0, id);
    } else {
      db.prepare(`
        UPDATE users 
        SET username = ?, role = ?, name = ?, email = ?, enabled = ?
        WHERE id = ?
      `).run(username, userRole || 'ADMIN', name || null, email || null, enabled ? 1 : 0, id);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: any) {
  const params = await context.params;
  const id = params.id;
  const currentUserRole = request.headers.get('x-user-role');
  const currentUsername = request.headers.get('x-user-username');

  if (currentUserRole !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  try {
    const targetUser = db.prepare('SELECT username FROM users WHERE id = ?').get(id) as any;
    if (targetUser && targetUser.username === currentUsername) {
      return NextResponse.json({ error: 'Cannot delete own user account' }, { status: 400 });
    }

    db.prepare('DELETE FROM users WHERE id = ?').run(id);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
