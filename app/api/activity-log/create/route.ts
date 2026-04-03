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
    if (process.env.NODE_ENV === "production" && csrf !== "activity:create") {
      return NextResponse.json({ error: "Ungueltige Anforderung" }, { status: 400 })
    }

    const schema = z.object({
      actionType: z.enum([
        "project_created","project_updated","project_deleted","project_status_changed","project_billed",
        "billing_partial","billing_full",
        "project_technology_added","project_technology_updated","project_technology_removed",
        "project_time_entry_added","project_time_entry_updated","project_time_entry_deleted",
        "project_vehicle_assigned","project_vehicle_updated","project_vehicle_unassigned",
        "project_export_pdf","project_export_csv",
        "employee_created","employee_updated","employee_deleted","employee_status_changed",
        "employee_vacation_added","employee_vacation_deleted","employee_export_pdf",
        "vehicle_created","vehicle_updated","vehicle_deleted","vehicle_export_pdf",
        "time_tracking_export_pdf","time_tracking_export_csv",
        "settings_updated","user_created","user_invited","user_status_changed","user_role_changed","user_deleted",
        "login","logout","password_changed","profile_updated"
      ] as const),
      module: z.enum(["project","employee","vehicle","time_tracking","settings","system","billing"] as const),
      details: z.object({ description: z.string().min(1) }).passthrough(),
    })
    const parseResult = schema.safeParse(await req.json())
    if (!parseResult.success) {
      return NextResponse.json({ error: "Validierungsfehler", issues: parseResult.error.flatten() }, { status: 400 })
    }

    const { actionType, module, details } = parseResult.data

    const activityLog = new ActivityLog({
      timestamp: new Date(),
      actionType,
      module,
      performedBy: {
        userId: currentUser._id,
        name: currentUser.name,
        role: currentUser.role,
      },
      details,
    })

    await activityLog.save()

    console.log(`Activity logged: ${actionType} - ${details.description}`)

    return NextResponse.json({ success: true, message: "Activity Log erstellt" })
  } catch (error) {
    console.error("Error creating activity log:", error)
    return NextResponse.json({ error: "Fehler beim Erstellen des Activity Logs" }, { status: 500 })
  }
}
