import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const search = searchParams.get('search');

    let query = `
      SELECT o.*, p.property_name, p.gateway_ip,
             (SELECT status FROM alerts a WHERE a.outage_id = o.outage_id AND a.alert_type = 'DOWN' LIMIT 1) as alert_status,
             (SELECT status FROM alerts a WHERE a.outage_id = o.outage_id AND a.alert_type = 'RECOVERY' LIMIT 1) as recovery_status
      FROM outages o
      JOIN properties p ON o.property_id = p.property_id
      WHERE 1=1
    `;
    const params = [];

    if (search) {
      query += ` AND (o.property_id LIKE ? OR p.property_name LIKE ? OR o.outage_id LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    query += ` ORDER BY o.start_time DESC LIMIT ?`;
    params.push(limit);

    const outages = db.prepare(query).all(...params);
    return NextResponse.json(outages);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
