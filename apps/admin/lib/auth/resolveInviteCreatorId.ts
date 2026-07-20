import mongoose from "mongoose"
import { ENV_SUPERADMIN_JWT_ID } from "./envSuperadmin"

/**
 * Ordnet einen Admin für InviteToken.createdBy zu (optional).
 * ENV-Super-Admin hat keine Mongo-_id – ohne passenden DB-User wird null geliefert;
 * Einladungen dürfen dann ohne createdBy gespeichert werden.
 */
export async function resolveInviteCreatorId(adminId: string): Promise<mongoose.Types.ObjectId | null> {
  if (adminId !== ENV_SUPERADMIN_JWT_ID) {
    try {
      return new mongoose.Types.ObjectId(adminId)
    } catch {
      return null
    }
  }

  const db = mongoose.connection.db
  if (!db) return null

  const users = db.collection("users")
  const configuredEmail = process.env.SUPERADMIN_EMAIL?.trim().toLowerCase()

  if (configuredEmail) {
    const matchingUser = await users.findOne(
      { email: configuredEmail, role: { $in: ["superadmin", "admin"] } },
      { projection: { _id: 1 } }
    )
    if (matchingUser?._id) {
      return matchingUser._id as mongoose.Types.ObjectId
    }
  }

  const fallbackAdmin = await users.findOne(
    { role: { $in: ["superadmin", "admin"] } },
    { projection: { _id: 1 }, sort: { role: -1, createdAt: 1 } }
  )

  return (fallbackAdmin?._id as mongoose.Types.ObjectId | undefined) ?? null
}
