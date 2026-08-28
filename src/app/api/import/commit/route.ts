import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function POST(request: Request) {
  try {
    const { properties } = await request.json();
    if (!properties || !Array.isArray(properties)) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    let inserted = 0;

    const insertProp = db.prepare(`
      INSERT INTO properties (property_id, property_name, gateway_ip, enabled)
      VALUES (?, ?, ?, 1)
    `);

    const insertState = db.prepare(`
      INSERT INTO monitoring_state (property_id, current_status)
      VALUES (?, 'NOT_CHECKED')
    `);

    db.transaction(() => {
      for (const prop of properties) {
        if (prop.status === 'VALID' || prop.status === 'WARNING') {
          // We assume warning (duplicate IP) is allowed by user if they commit
          // However duplicate ID will throw an error since property_id is UNIQUE
          try {
            insertProp.run(prop.property_id, prop.property_name, prop.gateway_ip);
            insertState.run(prop.property_id);
            inserted++;
          } catch (e: any) {
            console.error(`Failed to import ${prop.property_id}:`, e.message);
            // Ignore duplicates if they somehow slipped through validation
          }
        }
      }
    })();

    return NextResponse.json({ success: true, inserted });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
