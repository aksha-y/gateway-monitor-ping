import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '100', 10);
    const search = searchParams.get('search');

    let query = `SELECT * FROM audit_log WHERE 1=1`;
    const params = [];

    if (search) {
      query += ` AND (username LIKE ? OR action LIKE ? OR details LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    query += ` ORDER BY timestamp DESC LIMIT ?`;
    params.push(limit);

    const logs = db.prepare(query).all(...params);
    return NextResponse.json(logs);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
