import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import db from '@/lib/db';
import { decrypt } from '@/lib/crypto';

export async function POST(request: Request) {
  try {
    const { to } = await request.json();
    if (!to) {
      return NextResponse.json({ error: 'Recipient email is required' }, { status: 400 });
    }

    const settings = db.prepare('SELECT * FROM smtp_settings WHERE id = 1').get() as any;
    if (!settings || !settings.host) {
      return NextResponse.json({ error: 'SMTP settings are not configured' }, { status: 400 });
    }

    const password = decrypt(settings.password_enc);

    let secure = false;
    let requireTLS = false;
    if (settings.security === 'SSL/TLS') secure = true;
    if (settings.security === 'STARTTLS') requireTLS = true;

    const transporter = nodemailer.createTransport({
      host: settings.host,
      port: settings.port,
      secure,
      requireTLS,
      auth: {
        user: settings.username,
        pass: password
      }
    });

    const info = await transporter.sendMail({
      from: settings.from_name ? `"${settings.from_name}" <${settings.from_email}>` : settings.from_email,
      to,
      replyTo: settings.reply_to || undefined,
      subject: 'Test Email - UniFi Gateway Monitor',
      text: 'This is a test email from your UniFi Gateway Monitor. If you received this, your SMTP settings are working correctly.',
      html: '<b>This is a test email</b> from your UniFi Gateway Monitor. If you received this, your SMTP settings are working correctly.'
    });

    return NextResponse.json({ success: true, messageId: info.messageId });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'SMTP connection failed' }, { status: 500 });
  }
}
