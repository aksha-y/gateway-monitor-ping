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
  const role = request.headers.get('x-user-role');
  if (role === 'MONITOR') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { 
      property_id, property_name, enabled, notes,
      monitoring_method, gateway_ip,
      controller_id, site_id, site_name, device_mac, device_id, gateway_name
    } = body;

    if (!property_id || !property_name) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const method = monitoring_method || 'ICMP';

    if (method === 'ICMP') {
      if (!gateway_ip) return NextResponse.json({ error: 'Gateway IP required for ICMP' }, { status: 400 });
      const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
      if (!ipv4Regex.test(gateway_ip)) {
        return NextResponse.json({ error: 'Invalid IPv4 address' }, { status: 400 });
      }
    } else if (method === 'UNIFI_CONTROLLER') {
      if (!controller_id || !site_id || (!device_mac && !device_id)) {
        return NextResponse.json({ error: 'Missing controller configuration fields' }, { status: 400 });
      }
    }

    const existingId = db.prepare('SELECT id FROM properties WHERE property_id = ?').get(property_id);
    if (existingId) {
      return NextResponse.json({ error: 'Property ID already exists' }, { status: 400 });
    }

    const stmt = db.prepare(`
      INSERT INTO properties (
        property_id, property_name, monitoring_method, gateway_ip, 
        controller_id, site_id, site_name, device_mac, device_id, gateway_name, 
        enabled, notes
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    const info = stmt.run(
      property_id, property_name, method, method === 'ICMP' ? gateway_ip : "",
      controller_id || null, site_id || null, site_name || null, device_mac || null, device_id || null, gateway_name || null,
      enabled ? 1 : 0, notes || null
    );
    
    db.prepare(`
      INSERT INTO monitoring_state (property_id, current_status)
      VALUES (?, 'NOT_CHECKED')
    `).run(property_id);

    logAuditAction(request, 'PROPERTY_ADDED', `ID: ${property_id}, Name: ${property_name}, Method: ${method}`);

    return NextResponse.json({ success: true, id: info.lastInsertRowid });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
