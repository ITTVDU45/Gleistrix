import { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'
import dbConnect from '../dbConnect'
import mongoose from 'mongoose'
import { createHash } from 'node:crypto'
import { isEnvSuperadminJwtToken, ENV_SUPERADMIN_JWT_ID } from './envSuperadmin'

export type LockUserResolution =
  | {
      ok: true
      tokenId: string
      effectiveUserId: string
      isEnvSuperadmin: boolean
      userDoc?: any
    }
  | { ok: false; status: number; error: string }

function stableObjectIdFromToken(tokenId: string): string {
  const hex = createHash('sha1').update(tokenId).digest('hex').slice(0, 24)
  return new mongoose.Types.ObjectId(hex).toString()
}

export async function resolveLockUser(req: NextRequest): Promise<LockUserResolution> {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
  if (!token) {
    return { ok: false, status: 401, error: 'Nicht angemeldet' }
  }

  const tokenId = token.id ? String(token.id) : ''
  if (!tokenId) {
    return { ok: false, status: 401, error: 'Ungueltiges Token' }
  }

  if (isEnvSuperadminJwtToken(token as { id?: string; role?: string })) {
    await dbConnect()
    const db = mongoose.connection.db
    if (!db) {
      return { ok: false, status: 500, error: 'Datenbankverbindung nicht verfuegbar' }
    }

    const users = db.collection('users')
    const configuredEmail = process.env.SUPERADMIN_EMAIL?.trim().toLowerCase()
    let userDoc = null

    if (configuredEmail) {
      userDoc = await users.findOne({ email: configuredEmail })
    }

    if (!userDoc) {
      userDoc = await users.findOne({ role: 'superadmin' })
    }

    if (!userDoc) {
      userDoc = await users.findOne({ role: 'admin' })
    }

    if (!userDoc) {
      const fallbackId = stableObjectIdFromToken(ENV_SUPERADMIN_JWT_ID)
      return {
        ok: true,
        tokenId,
        effectiveUserId: fallbackId,
        isEnvSuperadmin: true,
      }
    }

    return {
      ok: true,
      tokenId,
      effectiveUserId: String(userDoc._id),
      isEnvSuperadmin: true,
      userDoc,
    }
  }

  return { ok: true, tokenId, effectiveUserId: tokenId, isEnvSuperadmin: false }
}