import { NextResponse } from 'next/server';
import ping from 'ping';

export async function POST(request: Request) {
  try {
    const { ip } = await request.json();

    if (!ip) {
      return NextResponse.json({ error: 'IP address is required' }, { status: 400 });
    }

    // Ping the IP
    const res = await ping.promise.probe(ip, {
      timeout: 2,
    });

    return NextResponse.json({
      reachable: res.alive,
      time: typeof res.time === 'number' ? res.time : null,
      packetLoss: res.packetLoss,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
