import { NextRequest, NextResponse } from "next/server"
import dbConnect from "../../../../lib/dbConnect"
import InviteToken from "../../../../lib/models/InviteToken"
import { z } from "zod"
import { requireAdminUser } from "../../../../lib/auth/requireAdminUser"

export async function DELETE(req: NextRequest) {
  try {
    const adminAuth = await requireAdminUser(req)
    if (!adminAuth.ok) {
      return NextResponse.json({ error: adminAuth.error }, { status: adminAuth.status })
    }

    await dbConnect()

    const csrf = req.headers.get("x-csrf-intent")
    if (process.env.NODE_ENV === "production" && csrf !== "invite:delete-all") {
      return NextResponse.json({ error: "Ungültige Anforderung" }, { status: 400 })
    }

    const schema = z.object({ email: z.string().email() })
    const parseResult = schema.safeParse(await req.json())
    if (!parseResult.success) {
      return NextResponse.json({ error: "Validierungsfehler", issues: parseResult.error.flatten() }, { status: 400 })
    }

    const { email } = parseResult.data
    const result = await InviteToken.deleteMany({ email })

    console.log("=== ALLE EINLADUNGEN GELÖSCHT ===")
    console.log(`E-Mail: ${email}`)
    console.log(`Gelöschte Einladungen: ${result.deletedCount}`)
    console.log(`Gelöscht von: ${adminAuth.user.name} (${adminAuth.user.role})`)
    console.log("==================================")

    return NextResponse.json(
      {
        message: `${result.deletedCount} Einladung(en) gelöscht`,
        deletedCount: result.deletedCount,
      },
      { status: 200 }
    )
  } catch (error) {
    console.error("Delete all invites error:", error)
    return NextResponse.json({ error: "Ein Fehler ist aufgetreten" }, { status: 500 })
  }
}
