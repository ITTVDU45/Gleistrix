import { NextRequest, NextResponse } from "next/server"
import dbConnect from "../../../../lib/dbConnect"
import InviteToken from "../../../../lib/models/InviteToken"
import { nanoid } from "nanoid"
import User from "../../../../lib/models/User"
import { sendInviteEmailResult } from "../../../../lib/mailer"
import { z } from "zod"
import mongoose from "mongoose"
import { requireAdminUser } from "../../../../lib/auth/requireAdminUser"

async function resolveInviteCreatorId(adminId: string): Promise<mongoose.Types.ObjectId | null> {
  if (adminId !== "env-superadmin") {
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

export async function POST(req: NextRequest) {
  try {
    const adminAuth = await requireAdminUser(req)
    if (!adminAuth.ok) {
      return NextResponse.json(
        { error: adminAuth.status === 403 ? "Nur Admins können Benutzer einladen" : adminAuth.error },
        { status: adminAuth.status }
      )
    }

    await dbConnect()

    const createdBy = await resolveInviteCreatorId(adminAuth.user.id)
    if (!createdBy) {
      return NextResponse.json(
        { error: "Für den Superadmin konnte kein Admin-Benutzer in der Datenbank als Ersteller zugeordnet werden." },
        { status: 500 }
      )
    }

    const csrf = req.headers.get("x-csrf-intent")
    if (process.env.NODE_ENV === "production" && csrf !== "invite:create-user") {
      return NextResponse.json({ error: "Ungültige Anforderung" }, { status: 400 })
    }

    const schema = z.object({
      firstName: z.string().min(1),
      lastName: z.string().min(1),
      email: z.string().email(),
      phone: z.string().optional().or(z.literal("")),
      role: z.enum(["user", "lager"]).optional().default("user"),
      resend: z.boolean().optional().default(false),
      modules: z.array(z.string()).optional(),
    })
    const parseResult = schema.safeParse(await req.json())
    if (!parseResult.success) {
      return NextResponse.json({ error: "Validierungsfehler", issues: parseResult.error.flatten() }, { status: 400 })
    }

    const { firstName, lastName, email, phone, role, resend, modules } = parseResult.data

    const existingUser = await User.findOne({ email })
    if (existingUser) {
      return NextResponse.json({ error: "Ein Benutzer mit dieser E-Mail existiert bereits" }, { status: 409 })
    }

    if (resend) {
      await InviteToken.deleteMany({ email })
    } else {
      const existingInvite = await InviteToken.findOne({
        email,
        used: false,
        expiresAt: { $gt: new Date() },
      })
      if (existingInvite) {
        return NextResponse.json(
          {
            error: "Eine gültige Einladung für diese E-Mail wurde bereits gesendet",
            message: "Die Einladung ist noch 24 Stunden gültig. Bitte warten Sie, bis sie abgelaufen ist.",
          },
          { status: 409 }
        )
      }

      await InviteToken.deleteMany({
        email,
        $or: [{ used: true }, { expiresAt: { $lt: new Date() } }],
      })
    }

    const inviteTokenValue = nanoid(32)
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)

    const inviteToken = new InviteToken({
      email,
      role,
      token: inviteTokenValue,
      used: false,
      expiresAt,
      createdBy,
      name: `${firstName} ${lastName}`,
      firstName,
      lastName,
      phone,
      modules: modules ?? [],
    })

    await inviteToken.save()

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin
    const inviteLink = `${baseUrl}/auth/set-password?token=${inviteTokenValue}`
    const emailResult = await sendInviteEmailResult(email, `${firstName} ${lastName}`, role, inviteLink, expiresAt)

    if (emailResult.ok) {
      console.log("=== USER EINLADUNG GESENDET ===")
      console.log(`An: ${email}`)
      console.log(`Name: ${firstName} ${lastName}`)
      console.log(`Rolle: ${role}`)
      console.log("==================================")
    } else {
      console.warn("=== E-MAIL VERSAND FEHLGESCHLAGEN ===", emailResult.error)
      console.log(`An: ${email}`)
      console.log(`Token/Link für manuellen Versand: ${inviteLink}`)
      console.log("=====================================")
    }

    return NextResponse.json(
      {
        message: emailResult.ok
          ? "Benutzer-Einladung erfolgreich gesendet"
          : "Einladung angelegt, E-Mail konnte nicht zugestellt werden.",
        emailSent: emailResult.ok,
        emailError: emailResult.error,
        invite: {
          email,
          name: `${firstName} ${lastName}`,
          role,
          expiresAt,
        },
      },
      { status: 201 }
    )
  } catch (error) {
    console.error("Create user invite error:", error)
    return NextResponse.json({ error: "Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut." }, { status: 500 })
  }
}
