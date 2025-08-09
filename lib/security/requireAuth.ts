import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';

export type Role = 'superadmin' | 'admin' | 'user';

export async function requireAuth(req: NextRequest, allowed: Role[] = ['user','admin','superadmin']) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token) return { ok: false as const, status: 401, error: 'Nicht angemeldet' };
  const role = (token as any).role as Role | undefined;
  if (!role || !allowed.includes(role)) return { ok: false as const, status: 403, error: 'Keine Berechtigung' };
  return { ok: true as const, token };
}


