import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { decrypt } from '@/lib/crypto';
import { UnifiClient } from '@/lib/unifi';

export async function GET(request: Request, context: any) {
  const params = await context.params;
  const id = params.id;
  const role = request.headers.get('x-user-role');
  if (role !== 'SUPER_ADMIN' && role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  try {
    const controller = db.prepare('SELECT url, username, password_enc FROM unifi_controllers WHERE id = ?').get(id) as any;
    if (!controller) {
      return NextResponse.json({ error: 'Controller not found' }, { status: 404 });
    }

    const password = decrypt(controller.password_enc);
    const client = new UnifiClient(controller.url);
    const loggedIn = await client.login(controller.username, password);

    if (!loggedIn) {
      return NextResponse.json({ error: 'Failed to authenticate with controller' }, { status: 401 });
    }

    const sites = await client.getSites();
    return NextResponse.json(sites);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
