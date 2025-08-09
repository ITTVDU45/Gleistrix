import ActivityLog from '@/lib/models/ActivityLog'
import mongoose from 'mongoose'
import { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'

export async function logActivity(req: NextRequest, actionType: string, module: string, description: string, extra?: any) {
  try {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    if (!token) return;
    const userId = (token as any).id;
    const name = (token as any).name || (token as any).email || 'Unbekannt';
    const role = (token as any).role || 'user';
    const performedBy = {
      userId: new mongoose.Types.ObjectId(String(userId)),
      name,
      role
    } as any;
    await ActivityLog.create({
      timestamp: new Date(),
      actionType,
      module,
      performedBy,
      details: { description, ...(extra || {}) }
    })
  } catch (e) {
    console.error('logActivity error:', e)
  }
}


