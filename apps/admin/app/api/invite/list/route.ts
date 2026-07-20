import { NextRequest, NextResponse } from "next/server"
import dbConnect from "@/lib/dbConnect"
import InviteToken from "@/lib/models/InviteToken"
import { requireAdminUser } from "../../../../lib/auth/requireAdminUser"
import { logger } from "@/lib/logger"

export async function GET(req: NextRequest) {
  try {
    const adminAuth = await requireAdminUser(req)
    if (!adminAuth.ok) {
      return NextResponse.json({ error: adminAuth.error }, { status: adminAuth.status })
    }

    await dbConnect()

    // Subunternehmen-Einladungen haben eine eigene Verwaltung (/api/invite/subcontractor)
    const invites = await InviteToken.find({ used: false, invitationType: { $ne: 'SUBCONTRACTOR' } })
      .populate("createdBy", "name")
      .sort({ createdAt: -1 })

    logger.debug("Einladungen geladen", { count: invites.length, by: adminAuth.user.role })

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
          createdBy: (() => {
            const cb = (invite as { createdBy?: { name?: string } | null }).createdBy
            if (cb == null) return "Super-Admin (Umgebung)"
            const n = typeof cb === "object" && cb && "name" in cb ? String(cb.name ?? "").trim() : ""
            return n || "Unbekannt"
          })(),
        })),
      },
      { status: 200 }
    )
  } catch (error) {
    logger.error("Get invites error", error)
    return NextResponse.json({ error: "Ein Fehler ist aufgetreten" }, { status: 500 })
  }
}
