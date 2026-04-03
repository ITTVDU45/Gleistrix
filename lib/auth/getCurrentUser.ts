import { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';
import dbConnect from '../dbConnect';
import mongoose from 'mongoose';
import { ENV_SUPERADMIN_JWT_ID, isEnvSuperadminJwtToken } from './envSuperadmin';

export interface CurrentUser {
  _id: any;
  id: string;
  email?: string;
  name?: string;
  role?: string;
}

export async function getCurrentUser(req: NextRequest): Promise<CurrentUser | null> {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token?.id) return null;

  if (isEnvSuperadminJwtToken(token as { id?: string; role?: string })) {
    return {
      _id: ENV_SUPERADMIN_JWT_ID,
      id: ENV_SUPERADMIN_JWT_ID,
      email: (token as { email?: string }).email,
      name: (token as { name?: string }).name || 'Super Admin',
      role: 'superadmin',
    };
  }

  await dbConnect();
  const db = mongoose.connection.db;
  if (!db) {
    return null;
  }
  const users = db.collection('users');
  let objectId: any;
  try {
    objectId = new mongoose.Types.ObjectId(String(token.id));
  } catch {
    return null;
  }
  const user = await users.findOne({ _id: objectId });
  if (!user) return null;
  return { _id: user._id, id: String(user._id), email: user.email, name: user.name, role: user.role };
}


