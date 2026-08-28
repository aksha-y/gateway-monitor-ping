import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { property_name, gateway_ip, enabled, notes } = body;

    // Optional fields update
    let updates = [];
    let values = [];

    if (property_name !== undefined) {
      updates.push('property_name = ?');
      values.push(property_name);
    }
    if (gateway_ip !== undefined) {
      const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
      if (!ipv4Regex.test(gateway_ip)) {
        return NextResponse.json({ error: 'Invalid IPv4 address' }, { status: 400 });
      }
      updates.push('gateway_ip = ?');
      values.push(gateway_ip);
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
  try {
    const { id } = await params;
    
    // Get the property_id first
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
