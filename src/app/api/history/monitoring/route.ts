import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '100', 10);
    const status = searchParams.get('status');
    const search = searchParams.get('search');

    let query = `
      SELECT h.*, p.property_name, p.gateway_ip
      FROM monitoring_history h
      JOIN properties p ON h.property_id = p.property_id
      WHERE 1=1
    `;
    const params = [];

    if (status && status !== 'All') {
      query += ` AND h.event_type = ?`;
      params.push(status);
    }

    if (search) {
      query += ` AND (h.property_id LIKE ? OR p.property_name LIKE ? OR p.gateway_ip LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    query += ` ORDER BY h.created_at DESC LIMIT ?`;
    params.push(limit);

    const history = db.prepare(query).all(...params);
    return NextResponse.json(history);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
