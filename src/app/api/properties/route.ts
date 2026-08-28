import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { logAuditAction } from '@/lib/audit';

export async function GET() {
  try {
    const properties = db.prepare(`
      SELECT p.*, 
             COALESCE(m.current_status, 'NOT_CHECKED') as current_status,
             m.last_check, m.last_success, m.last_failure, m.response_time, 
             m.failure_count, m.downtime_start, m.total_downtime_seconds,
             (SELECT status FROM alerts a WHERE a.property_id = p.property_id ORDER BY a.created_at DESC LIMIT 1) as last_alert_status,
             (SELECT alert_type FROM alerts a WHERE a.property_id = p.property_id ORDER BY a.created_at DESC LIMIT 1) as last_alert_type
      FROM properties p
      LEFT JOIN monitoring_state m ON p.property_id = m.property_id
      ORDER BY p.created_at DESC
    `).all();
    return NextResponse.json(properties);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch properties' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { property_id, property_name, gateway_ip, enabled, notes } = body;

    if (!property_id || !property_name || !gateway_ip) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // IP validation
    const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (!ipv4Regex.test(gateway_ip)) {
      return NextResponse.json({ error: 'Invalid IPv4 address' }, { status: 400 });
    }

    // Check duplicate ID
    const existingId = db.prepare('SELECT id FROM properties WHERE property_id = ?').get(property_id);
    if (existingId) {
      return NextResponse.json({ error: 'Property ID already exists' }, { status: 400 });
    }

    const stmt = db.prepare(`
      INSERT INTO properties (property_id, property_name, gateway_ip, enabled, notes)
      VALUES (?, ?, ?, ?, ?)
    `);
    
    const info = stmt.run(property_id, property_name, gateway_ip, enabled ? 1 : 0, notes || null);
    
    // Create initial monitoring state
    const stateStmt = db.prepare(`
      INSERT INTO monitoring_state (property_id, current_status)
      VALUES (?, 'NOT_CHECKED')
    `);
    stateStmt.run(property_id);

    logAuditAction(request, 'PROPERTY_ADDED', `ID: ${property_id}, Name: ${property_name}, IP: ${gateway_ip}`);

    return NextResponse.json({ success: true, id: info.lastInsertRowid });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
