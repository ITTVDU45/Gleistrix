import { NextRequest } from "next/server"
import { getToken } from "next-auth/jwt"
import mongoose from "mongoose"
import dbConnect from "../dbConnect"
import { ENV_SUPERADMIN_JWT_ID, isEnvSuperadminJwtToken } from "./envSuperadmin"

export interface AdminUser {
  _id: string
  id: string
  email?: string
  name: string
  role: "admin" | "superadmin"
}

export type AdminAuthResult =
  | { ok: true; user: AdminUser }
  | { ok: false; status: number; error: string }

export async function requireAdminUser(req: NextRequest): Promise<AdminAuthResult> {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
  if (!token) {
    return { ok: false, status: 401, error: "Nicht angemeldet" }
  }

  if (isEnvSuperadminJwtToken(token as { id?: string; role?: string })) {
    return {
      ok: true,
      user: {
        _id: ENV_SUPERADMIN_JWT_ID,
        id: ENV_SUPERADMIN_JWT_ID,
        email: (token as { email?: string }).email,
        name: (token as { name?: string }).name || "Super Admin",
        role: "superadmin",
      },
    }
  }

  const currentUserId = token.id as string | undefined
  if (!currentUserId) {
    return { ok: false, status: 401, error: "Ungueltiges Token" }
  }

  await dbConnect()
  const db = mongoose.connection.db
  if (!db) {
    return { ok: false, status: 500, error: "Datenbankverbindung nicht verfuegbar" }
  }

  let objectId: mongoose.Types.ObjectId
  try {
    objectId = new mongoose.Types.ObjectId(String(currentUserId))
  } catch {
    return { ok: false, status: 401, error: "Ungueltige Benutzer-ID" }
  }

  const currentUser = await db.collection("users").findOne({ _id: objectId })
  if (!currentUser || (currentUser.role !== "admin" && currentUser.role !== "superadmin")) {
    return { ok: false, status: 403, error: "Keine Berechtigung" }
  }

  return {
    ok: true,
    user: {
      _id: String(currentUser._id),
      id: String(currentUser._id),
      email: currentUser.email,
      name: currentUser.name || "Admin",
      role: currentUser.role,
    },
  }
}