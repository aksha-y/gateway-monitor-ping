import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const role = request.headers.get('x-user-role');
  if (role === 'MONITOR') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const { 
      property_name, enabled, notes,
      monitoring_method, gateway_ip,
      controller_id, site_id, site_name, device_mac, device_id, gateway_name
    } = body;

    let updates = [];
    let values = [];

    if (property_name !== undefined) {
      updates.push('property_name = ?');
      values.push(property_name);
    }
    
    if (monitoring_method !== undefined) {
      updates.push('monitoring_method = ?');
      values.push(monitoring_method);
      
      if (monitoring_method === 'ICMP') {
        if (gateway_ip) {
          const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
          if (!ipv4Regex.test(gateway_ip)) {
            return NextResponse.json({ error: 'Invalid IPv4 address' }, { status: 400 });
          }
          updates.push('gateway_ip = ?');
          values.push(gateway_ip);
        }
        // Nullify controller fields
        updates.push('controller_id = NULL, site_id = NULL, site_name = NULL, device_mac = NULL, device_id = NULL, gateway_name = NULL');
      } else if (monitoring_method === 'UNIFI_CONTROLLER') {
        updates.push('gateway_ip = ?');
        values.push('');
        
        if (controller_id !== undefined) { updates.push('controller_id = ?'); values.push(controller_id); }
        if (site_id !== undefined) { updates.push('site_id = ?'); values.push(site_id); }
        if (site_name !== undefined) { updates.push('site_name = ?'); values.push(site_name); }
        if (device_mac !== undefined) { updates.push('device_mac = ?'); values.push(device_mac); }
        if (device_id !== undefined) { updates.push('device_id = ?'); values.push(device_id); }
        if (gateway_name !== undefined) { updates.push('gateway_name = ?'); values.push(gateway_name); }
      }
    } else {
       // Legacy updates without changing method
       if (gateway_ip !== undefined) {
          const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
          if (!ipv4Regex.test(gateway_ip)) {
            return NextResponse.json({ error: 'Invalid IPv4 address' }, { status: 400 });
          }
          updates.push('gateway_ip = ?');
          values.push(gateway_ip);
       }
    }

    if (enabled !== undefined) {
      updates.push('enabled = ?');
      values.push(enabled ? 1 : 0);
    }
    if (notes !== undefined) {
      updates.push('notes = ?');
      values.push(notes);
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');

    const stmt = db.prepare(`
      UPDATE properties
      SET ${updates.join(', ')}
      WHERE id = ?
    `);
    
    values.push(id);
    const info = stmt.run(...values);

    if (info.changes === 0) {
      return NextResponse.json({ error: 'Property not found' }, { status: 404 });
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
  const role = request.headers.get('x-user-role');
  if (role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Unauthorized. Only SUPER_ADMIN can delete properties.' }, { status: 403 });
  }

  try {
    const { id } = await params;
    
    const prop = db.prepare('SELECT property_id FROM properties WHERE id = ?').get(id);
    if (!prop) {
       return NextResponse.json({ error: 'Property not found' }, { status: 404 });
    }
    
    const stmt = db.prepare('DELETE FROM properties WHERE id = ?');
    stmt.run(id);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
