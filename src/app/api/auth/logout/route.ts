import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function POST(request: Request) {
  const username = request.headers.get('x-user-username') || 'unknown';
  
  try {
    if (username !== 'unknown') {
      db.prepare(`INSERT INTO audit_log (username, action) VALUES (?, 'LOGOUT')`).run(username);
    }
  } catch (e) {
    // Ignore audit log error on logout
  }

  const response = NextResponse.json({ success: true });
  response.cookies.delete('auth_token');
  return response;
}
