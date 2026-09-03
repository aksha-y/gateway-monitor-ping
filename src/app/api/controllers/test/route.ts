import { NextResponse } from 'next/server';
import { UnifiClient } from '@/lib/unifi';

export async function POST(request: Request) {
  const role = request.headers.get('x-user-role');
  if (role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  try {
    const { url, username, password } = await request.json();
    
    if (!url || !username || !password) {
      return NextResponse.json({ error: 'Missing credentials' }, { status: 400 });
    }

    const client = new UnifiClient(url);
    const loggedIn = await client.login(username, password);

    if (!loggedIn) {
      return NextResponse.json({ error: 'Authentication failed' }, { status: 401 });
    }

    // Try fetching sites to verify full API access
    const sites = await client.getSites();

    return NextResponse.json({ success: true, sitesCount: sites.length });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
