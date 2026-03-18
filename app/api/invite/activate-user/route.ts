import { NextRequest, NextResponse } from "next/server"
import dbConnect from "../../../../lib/dbConnect"
import InviteToken from "../../../../lib/models/InviteToken"
import User from "../../../../lib/models/User"
import { getToken } from "next-auth/jwt"
import mongoose from "mongoose"
import { hash } from "bcryptjs"
import { z } from "zod"

/**
 * Admin aktiviert eine ausstehende Einladung: erstellt den User mit dem angegebenen
 * Passwort und markiert den InviteToken als verwendet.
 */
export async function POST(req: NextRequest) {
  try {
    await dbConnect()

    const sessionToken = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
    if (!sessionToken) {
      return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 })
    }
    const db = mongoose.connection?.db
    if (!db) {
      return NextResponse.json({ error: "DB nicht verbunden" }, { status: 500 })
    }
    const usersCollection = db.collection("users")
    const currentUserId = sessionToken.id as string | undefined
    if (!currentUserId) {
      return NextResponse.json({ error: "Ungültiges Token" }, { status: 401 })
    }
    let objectId: mongoose.Types.ObjectId
    try {
      objectId = new mongoose.Types.ObjectId(String(currentUserId))
    } catch {
      return NextResponse.json({ error: "Ungültige Benutzer-ID" }, { status: 401 })
    }
    const currentUser = await usersCollection.findOne({ _id: objectId })
    if (!currentUser || (currentUser.role !== "admin" && currentUser.role !== "superadmin")) {
      return NextResponse.json({ error: "Nur Admins können Einladungen aktivieren" }, { status: 403 })
    }

    const csrf = req.headers.get("x-csrf-intent")
    if (process.env.NODE_ENV === "production" && csrf !== "invite:activate-user") {
      return NextResponse.json({ error: "Ungültige Anforderung" }, { status: 400 })
    }

    const schema = z.object({
      email: z.string().email(),
      password: z.string().min(6, "Passwort muss mindestens 6 Zeichen haben"),
    })
    const parsed = schema.safeParse(await req.json())
    if (!parsed.success) {
      const msg = parsed.error.errors.map((e) => e.message).join("; ")
      return NextResponse.json({ error: msg }, { status: 400 })
    }
    const { email, password } = parsed.data

    const inviteToken = await InviteToken.findOne({
      email: email.toLowerCase().trim(),
      used: false,
      expiresAt: { $gte: new Date() },
    }).sort({ createdAt: -1 })

    if (!inviteToken) {
      return NextResponse.json(
        { error: "Keine gültige ausstehende Einladung für diese E-Mail gefunden." },
        { status: 404 }
      )
    }

    const existingUser = await User.findOne({ email: inviteToken.email })
    if (existingUser) {
      inviteToken.used = true
      await inviteToken.save()
      return NextResponse.json(
        { error: "Ein Benutzer mit dieser E-Mail existiert bereits." },
        { status: 409 }
      )
    }

    const hashedPassword = await hash(password, 12)
    const fullName =
      inviteToken.name || `${inviteToken.firstName || ""} ${inviteToken.lastName || ""}`.trim()

    const newUser = new User({
      email: inviteToken.email,
      name: fullName,
      password: hashedPassword,
      role: inviteToken.role,
      firstName: inviteToken.firstName,
      lastName: inviteToken.lastName,
      phone: inviteToken.phone,
      isActive: true,
      createdBy: inviteToken.createdBy,
      modules: inviteToken.modules ?? [],
    })
    await newUser.save()

    inviteToken.used = true
    await inviteToken.save()

    return NextResponse.json(
      {
        message: "Benutzer erfolgreich aktiviert.",
        user: {
          email: newUser.email,
          name: newUser.name,
          role: newUser.role,
        },
      },
      { status: 201 }
    )
  } catch (error) {
    console.error("Activate user error:", error)
    return NextResponse.json(
      { error: "Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut." },
      { status: 500 }
    )
  }
}
