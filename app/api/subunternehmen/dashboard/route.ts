import { NextRequest, NextResponse } from 'next/server'
import dbConnect from '@/lib/dbConnect'
import { requireSubcontractor } from '@/lib/subunternehmen/access'
import ReceivedInvoice from '@/lib/models/ReceivedInvoice'
import SubcontractorDocument from '@/lib/models/SubcontractorDocument'
import {
  findProjectsForCompany,
  getInvoicedKeysForCompany,
  todayIsoDate,
  missingCompanyFieldsForInvoicing,
} from '@/lib/subunternehmen/queries'
import { toSubcontractorAssignments, sumAssignments } from '@/lib/subunternehmen/assignments'
import { logger } from '@/lib/logger'

/** Aggregierte Kennzahlen für das Portal-Dashboard. */
export async function GET(req: NextRequest) {
  try {
    const auth = await requireSubcontractor(req)
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

    await dbConnect()
    const { ctx } = auth
    const today = todayIsoDate()

    const [projects, invoiced, invoices, recentDocuments] = await Promise.all([
      findProjectsForCompany(ctx.companyId),
      getInvoicedKeysForCompany(ctx.companyId),
      ReceivedInvoice.find({ subcontractorCompanyId: ctx.companyId })
        .select('invoiceNumber status totalGross submittedAt changeRequestMessage updatedAt')
        .sort({ updatedAt: -1 })
        .lean(),
      SubcontractorDocument.find({ subcontractorCompanyId: ctx.companyId, type: { $ne: 'INTERNAL_REVIEW' } })
        .select('name type createdAt source')
        .sort({ createdAt: -1 })
        .limit(5)
        .lean(),
    ])

    const assignments = projects.flatMap((p) =>
      toSubcontractorAssignments(p, String(ctx.companyId), {
        today,
        invoicedKeys: invoiced.invoicedKeys,
        invoiceNumbersByKey: invoiced.invoiceNumbersByKey,
      })
    )

    const upcoming = assignments
      .filter((a) => a.status === 'geplant')
      .sort((a, b) => a.day.localeCompare(b.day))
      .slice(0, 5)
    const billable = assignments.filter((a) => a.status === 'bestaetigt')
    const billableSums = sumAssignments(billable)

    const invoiceList = invoices as unknown as Array<{
      _id: unknown
      invoiceNumber: string
      status: string
      totalGross?: number
      changeRequestMessage?: string
      updatedAt?: Date
    }>
    const countByStatus = (statuses: string[]) =>
      invoiceList.filter((i) => statuses.includes(i.status)).length

    return NextResponse.json({
      success: true,
      dashboard: {
        companyName: ctx.companyName,
        activeProjects: projects.filter((p) => p.status === 'aktiv').length,
        totalProjects: projects.length,
        upcomingAssignments: upcoming,
        billableAssignmentsCount: billable.length,
        billableHours: billableSums.stunden,
        invoices: {
          drafts: countByStatus(['DRAFT']),
          submitted: countByStatus(['SUBMITTED', 'UNDER_REVIEW']),
          changesRequested: countByStatus(['CHANGES_REQUESTED']),
          approved: countByStatus(['APPROVED', 'SCHEDULED_FOR_PAYMENT']),
          paid: countByStatus(['PAID']),
          recent: invoiceList.slice(0, 5).map((i) => ({
            id: String(i._id),
            invoiceNumber: i.invoiceNumber,
            status: i.status,
            totalGross: i.totalGross ?? 0,
            changeRequestMessage: i.changeRequestMessage || undefined,
          })),
        },
        recentDocuments: (recentDocuments as Array<Record<string, unknown>>).map((d) => ({
          id: String(d._id),
          name: String(d.name || ''),
          type: d.type,
          source: d.source,
          createdAt: d.createdAt,
        })),
        missingForInvoicing: missingCompanyFieldsForInvoicing(ctx.company),
      },
    })
  } catch (error) {
    logger.error('Portal: Dashboard konnte nicht geladen werden', error)
    return NextResponse.json({ error: 'Fehler beim Laden des Dashboards' }, { status: 500 })
  }
}
