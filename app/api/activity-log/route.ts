import { NextRequest, NextResponse } from "next/server"
export const runtime = "nodejs"
import dbConnect from "../../../lib/dbConnect"
import ActivityLog from "../../../lib/models/ActivityLog"
import mongoose from "mongoose"
import { requireAdminUser } from "../../../lib/auth/requireAdminUser"

export async function GET(req: NextRequest) {
  try {
    const adminAuth = await requireAdminUser(req)
    if (!adminAuth.ok) {
      return NextResponse.json({ error: adminAuth.error }, { status: adminAuth.status })
    }

    await dbConnect()

    const { searchParams } = new URL(req.url)
    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "20")
    const module = searchParams.get("module")
    const actionType = searchParams.get("actionType")
    const userId = searchParams.get("userId")
    const dateFrom = searchParams.get("dateFrom")
    const dateTo = searchParams.get("dateTo")
    const search = searchParams.get("search")

    const filter: any = {}

    if (module) {
      const modules = module.split(",")
      filter.module = modules.length > 1 ? { $in: modules } : module
    }

    if (actionType) {
      const actionTypes = actionType.split(",")
      filter.actionType = actionTypes.length > 1 ? { $in: actionTypes } : actionType
    }

    if (userId) {
      try {
        filter["performedBy.userId"] = new mongoose.Types.ObjectId(String(userId))
      } catch {
        return NextResponse.json({ error: "Ungueltige Benutzer-ID" }, { status: 400 })
      }
    }

    if (dateFrom || dateTo) {
      const parseDate = (value: string, endOfDay = false) => {
        let date = new Date(value)
        if (Number.isNaN(date.getTime())) {
          const match = value.match(/^([0-3]?\d)\.([01]?\d)\.(\d{4})$/)
          if (match) {
            const day = parseInt(match[1], 10)
            const month = parseInt(match[2], 10) - 1
            const year = parseInt(match[3], 10)
            date = new Date(year, month, day)
          }
        }
        if (Number.isNaN(date.getTime())) return null
        if (endOfDay) date.setHours(23, 59, 59, 999)
        else date.setHours(0, 0, 0, 0)
        return date
      }

      const tsFilter: any = {}
      if (dateFrom) {
        const parsed = parseDate(dateFrom, false)
        if (parsed) tsFilter.$gte = parsed
      }
      if (dateTo) {
        const parsed = parseDate(dateTo, true)
        if (parsed) tsFilter.$lte = parsed
      }
      if (Object.keys(tsFilter).length > 0) {
        filter.timestamp = tsFilter
      }
    }

    if (search) {
      filter.$or = [
        { "performedBy.name": { $regex: search, $options: "i" } },
        { "details.description": { $regex: search, $options: "i" } },
      ]
    }

    const skip = (page - 1) * limit

    const logs = await ActivityLog.find(filter)
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit)

    const total = await ActivityLog.countDocuments(filter)

    const formattedLogs = logs.map((log: any) => {
      let userIdStr: string | null = null
      const raw = log?.performedBy?.userId
      if (typeof raw === "string") userIdStr = raw
      else if (raw && typeof raw.toString === "function") userIdStr = raw.toString()
      else if (raw && raw._id && typeof raw._id.toString === "function") userIdStr = raw._id.toString()

      return {
        id: log._id,
        timestamp: log.timestamp,
        actionType: log.actionType,
        module: log.module,
        performedBy: {
          userId: userIdStr,
          name: log.performedBy.name,
          role: log.performedBy.role,
        },
        details: log.details,
      }
    })

    return NextResponse.json({
      success: true,
      logs: formattedLogs,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error("Error fetching activity logs:", error)
    return NextResponse.json({ error: "Fehler beim Laden der Activity Logs" }, { status: 500 })
  }
}
