import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET() {
  try {
    const health = db.prepare('SELECT last_worker_heartbeat FROM system_health WHERE id = 1').get() as any;
    const smtp = db.prepare('SELECT host FROM smtp_settings WHERE id = 1').get() as any;
    
    const countQuery = db.prepare('SELECT COUNT(*) as c FROM properties WHERE enabled = 1').get() as { c: number };

    const now = new Date().getTime();
    let workerStatus = 'STOPPED';
    
    if (health?.last_worker_heartbeat) {
      const hbTime = new Date(health.last_worker_heartbeat).getTime();
      if (now - hbTime < 120000) { // If heartbeat is less than 2 minutes old
        workerStatus = 'RUNNING';
      } else {
        workerStatus = 'STALLED';
      }
    }

    return NextResponse.json({
      worker: workerStatus,
      lastHeartbeat: health?.last_worker_heartbeat || null,
      database: 'CONNECTED',
      smtp: smtp && smtp.host ? 'CONFIGURED' : 'UNCONFIGURED',
      monitoredGateways: countQuery.c
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
