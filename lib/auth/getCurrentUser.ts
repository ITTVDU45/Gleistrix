import { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';
import dbConnect from '../dbConnect';
import mongoose from 'mongoose';

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

  await dbConnect();
  const users = mongoose.connection.db.collection('users');
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


