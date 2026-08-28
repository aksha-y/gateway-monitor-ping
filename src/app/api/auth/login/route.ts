import { NextResponse } from 'next/server';
import db from '@/lib/db';
import bcrypt from 'bcryptjs';
import { signToken } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const { username, password } = await request.json();
    
    if (!username || !password) {
      return NextResponse.json({ error: 'Username and password required' }, { status: 400 });
    }

    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username) as any;
    
    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      db.prepare(`INSERT INTO audit_log (username, action, details) VALUES (?, 'LOGIN_FAILED', 'Invalid credentials')`).run(username || 'unknown');
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const token = await signToken({ id: user.id, username: user.username });
    
    db.prepare(`INSERT INTO audit_log (username, action) VALUES (?, 'LOGIN_SUCCESS')`).run(user.username);

    const response = NextResponse.json({ success: true });
    response.cookies.set({
      name: 'auth_token',
      value: token,
      httpOnly: true,
      secure: false, // Must be false for local IP HTTP access
      sameSite: 'lax', // Must be lax to work properly across local networks
      maxAge: 60 * 60 * 24 // 24 hours
    });

    return response;
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
