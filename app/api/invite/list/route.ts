import { NextRequest, NextResponse } from "next/server"
import dbConnect from "../../../../lib/dbConnect"
import InviteToken from "../../../../lib/models/InviteToken"
import { requireAdminUser } from "../../../../lib/auth/requireAdminUser"

export async function GET(req: NextRequest) {
  try {
    const adminAuth = await requireAdminUser(req)
    if (!adminAuth.ok) {
      return NextResponse.json({ error: adminAuth.error }, { status: adminAuth.status })
    }

    await dbConnect()

    const invites = await InviteToken.find({ used: false })
      .populate("createdBy", "name")
      .sort({ createdAt: -1 })

    console.log("=== EINLADUNGEN GELADEN ===")
    console.log(`Anzahl: ${invites.length}`)
    console.log(`Geladen von: ${adminAuth.user.name} (${adminAuth.user.role})`)
    console.log("==========================")

    return NextResponse.json(
      {
        invites: invites.map((invite: any) => ({
          id: invite._id,
          email: invite.email,
          name: invite.name,
          role: invite.role,
          firstName: invite.firstName,
          lastName: invite.lastName,
          phone: invite.phone,
          used: invite.used,
          expiresAt: invite.expiresAt,
          createdAt: invite.createdAt,
          createdBy: invite.createdBy?.name || "Unbekannt",
        })),
      },
      { status: 200 }
    )
  } catch (error) {
    console.error("Get invites error:", error)
    return NextResponse.json({ error: "Ein Fehler ist aufgetreten" }, { status: 500 })
  }
}
