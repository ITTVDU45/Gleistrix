import { NextRequest, NextResponse } from "next/server"
import dbConnect from "../../../../lib/dbConnect"
import ActivityLog from "../../../../lib/models/ActivityLog"
import { z } from "zod"
import { getCurrentUser } from "../../../../lib/auth/getCurrentUser"

export async function POST(req: NextRequest) {
  try {
    await dbConnect()

    const currentUser = await getCurrentUser(req)
    if (!currentUser) {
      return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 })
    }

    const csrf = req.headers.get("x-csrf-intent")
    if (process.env.NODE_ENV === "production" && csrf !== "activity:pdf-export") {
      return NextResponse.json({ error: "Ungueltige Anforderung" }, { status: 400 })
    }

    const schema = z.object({
      module: z.string().min(1),
      entityId: z.string().optional(),
      entityName: z.string().optional(),
      exportType: z.string().min(1),
      details: z.record(z.any()).optional(),
    })
    const parseResult = schema.safeParse(await req.json())
    if (!parseResult.success) {
      return NextResponse.json({ error: "Validierungsfehler", issues: parseResult.error.flatten() }, { status: 400 })
    }

    const { module, entityId, entityName, exportType, details } = parseResult.data

    const entityLabel =
      module === "project"
        ? "Projekt"
        : module === "employee"
          ? "Mitarbeiter"
          : module === "vehicle"
            ? "Fahrzeug"
            : module

    const activityLog = new ActivityLog({
      timestamp: new Date(),
      actionType: `${module}_export_pdf`,
      module,
      performedBy: {
        userId: currentUser._id,
        name: currentUser.name,
        role: currentUser.role,
      },
      details: {
        entityId,
        description: `PDF Export fuer ${entityLabel}${entityName ? ` \"${entityName}\"` : ""} erstellt`,
        context: {
          exportType,
          entityName,
          ...details,
        },
      },
    })

    await activityLog.save()

    console.log(`PDF Export logged: ${module} - ${entityName || "Uebersicht"}`)

    return NextResponse.json({ success: true, message: "PDF Export Activity Log erstellt" })
  } catch (error) {
    console.error("Error creating PDF export activity log:", error)
    return NextResponse.json({ error: "Fehler beim Erstellen des PDF Export Activity Logs" }, { status: 500 })
  }
}
