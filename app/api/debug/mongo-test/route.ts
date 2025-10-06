import { NextResponse } from 'next/server';
import mongoose from 'mongoose';

export async function GET() {
  const uri = process.env.MONGODB_URI;
  if (!uri) return NextResponse.json({ ok: false, error: 'MONGODB_URI not set' }, { status: 500 });

  try {
    const conn = await mongoose.createConnection(uri, { serverSelectionTimeoutMS: 5000 }).asPromise();
    await conn.close();
    return NextResponse.json({ ok: true, msg: 'connected' });
  } catch (err: any) {
    // Sanitize error message: do not leak credentials
    const message = err?.message || String(err);
    const sanitized = message.replace(/(mongodb\+srv:\/\/)(.*?)(@)/, '$1<REDACTED>@');
    return NextResponse.json({ ok: false, error: sanitized }, { status: 500 });
  }
}


