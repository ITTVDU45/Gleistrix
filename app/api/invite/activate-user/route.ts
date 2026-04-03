import { NextRequest, NextResponse } from "next/server"
import dbConnect from "../../../../lib/dbConnect"
import InviteToken from "../../../../lib/models/InviteToken"
import User from "../../../../lib/models/User"
import { hash } from "bcryptjs"
import { z } from "zod"
import { requireAdminUser } from "../../../../lib/auth/requireAdminUser"

export async function POST(req: NextRequest) {
  try {
    const adminAuth = await requireAdminUser(req)
    if (!adminAuth.ok) {
      return NextResponse.json(
        { error: adminAuth.status === 403 ? "Nur Admins können Einladungen aktivieren" : adminAuth.error },
        { status: adminAuth.status }
      )
    }

    await dbConnect()

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
      return NextResponse.json({ error: "Ein Benutzer mit dieser E-Mail existiert bereits." }, { status: 409 })
    }

    const hashedPassword = await hash(password, 12)
    const fullName = inviteToken.name || `${inviteToken.firstName || ""} ${inviteToken.lastName || ""}`.trim()

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
