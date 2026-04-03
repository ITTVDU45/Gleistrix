import { NextRequest, NextResponse } from "next/server"
import dbConnect from "../../../lib/dbConnect"
import mongoose from "mongoose"
import { requireAdminUser } from "../../../lib/auth/requireAdminUser"

export async function GET(req: NextRequest) {
  try {
    const adminAuth = await requireAdminUser(req)
    if (!adminAuth.ok) {
      return NextResponse.json({ error: adminAuth.error }, { status: adminAuth.status })
    }

    await dbConnect()

    const db = mongoose.connection.db
    if (!db) {
      return NextResponse.json({ error: "Datenbankverbindung nicht verfuegbar" }, { status: 500 })
    }

    const usersCollection = db.collection("users")
    const query =
      adminAuth.user.id === "env-superadmin"
        ? {}
        : { _id: { $ne: new mongoose.Types.ObjectId(adminAuth.user.id) } }

    const users = await usersCollection
      .find(query)
      .project({ name: 1, email: 1, role: 1, firstName: 1, lastName: 1, phone: 1, isActive: 1, lastLogin: 1, createdAt: 1, modules: 1 })
      .sort({ createdAt: -1 })
      .toArray()

    return NextResponse.json(
      {
        users: users.map((user: any) => ({
          id: user._id?.toString?.() || user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          firstName: user.firstName,
          lastName: user.lastName,
          phone: user.phone,
          isActive: user.isActive,
          lastLogin: user.lastLogin,
          createdAt: user.createdAt,
          modules: user.modules ?? [],
        })),
      },
      { status: 200 }
    )
  } catch (error) {
    console.error("Get users error:", error)
    return NextResponse.json({ error: "Ein Fehler ist aufgetreten" }, { status: 500 })
  }
}