import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const username = request.headers.get('x-user-username');
  const role = request.headers.get('x-user-role');

  if (!username) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return NextResponse.json({ username, role });
}
