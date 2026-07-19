import { NextRequest, NextResponse } from 'next/server'
import dbConnect from '@/lib/dbConnect'
import ReceivedInvoice from '@/lib/models/ReceivedInvoice'
import { Subcompany } from '@/lib/models/Subcompany'
import { requireAdminUser } from '@/lib/auth/requireAdminUser'
import { isFeatureEnabled } from '@/lib/featureFlags'
import { serializeInvoiceForAdmin } from '@/lib/subunternehmen/serialize'
import { logger } from '@/lib/logger'

const MAX_LIMIT = 100

/**
 * Erhaltene Rechnungen (intern): Liste mit Filtern, Suche, Sortierung und
 * Pagination. Nur für Admins.
 */
export async function GET(req: NextRequest) {
  try {
    const adminAuth = await requireAdminUser(req)
    if (!adminAuth.ok) {
      return NextResponse.json({ error: adminAuth.error }, { status: adminAuth.status })
    }
    if (!(await isFeatureEnabled('receivedInvoicesEnabled'))) {
      return NextResponse.json({ error: 'Erhaltene Rechnungen sind deaktiviert' }, { status: 403 })
    }

    await dbConnect()
    const { searchParams } = new URL(req.url)

    const query: Record<string, unknown> = {
      // Entwürfe der Subunternehmen sind intern erst nach dem Einreichen sichtbar
      status: { $ne: 'DRAFT' },
    }

    const status = searchParams.get('status')
    if (status) query.status = status

    const companyId = searchParams.get('companyId')
    if (companyId) query.subcontractorCompanyId = companyId

    const projectId = searchParams.get('projectId')
    if (projectId) query.projectIds = projectId

    const search = searchParams.get('search')?.trim()
    if (search) query.invoiceNumber = { $regex: search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' }

    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')
    if (dateFrom || dateTo) {
      query.invoiceDate = {
        ...(dateFrom ? { $gte: new Date(dateFrom) } : {}),
        ...(dateTo ? { $lte: new Date(`${dateTo}T23:59:59.999Z`) } : {}),
      }
    }

    const dueFrom = searchParams.get('dueFrom')
    const dueTo = searchParams.get('dueTo')
    if (dueFrom || dueTo) {
      query.dueDate = {
        ...(dueFrom ? { $gte: new Date(dueFrom) } : {}),
        ...(dueTo ? { $lte: new Date(`${dueTo}T23:59:59.999Z`) } : {}),
      }
    }

    const minAmount = Number(searchParams.get('minAmount'))
    const maxAmount = Number(searchParams.get('maxAmount'))
    if (Number.isFinite(minAmount) || Number.isFinite(maxAmount)) {
      query.totalGross = {
        ...(Number.isFinite(minAmount) ? { $gte: minAmount } : {}),
        ...(Number.isFinite(maxAmount) ? { $lte: maxAmount } : {}),
      }
    }

    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1)
    const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(searchParams.get('limit') || '25', 10) || 25))
    const sortField = ['submittedAt', 'invoiceDate', 'dueDate', 'totalGross', 'invoiceNumber'].includes(
      searchParams.get('sort') || ''
    )
      ? (searchParams.get('sort') as string)
      : 'submittedAt'
    const sortDir = searchParams.get('dir') === 'asc' ? 1 : -1

    const [total, invoices] = await Promise.all([
      ReceivedInvoice.countDocuments(query),
      ReceivedInvoice.find(query)
        .sort({ [sortField]: sortDir })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
    ])

    const companyIds = Array.from(
      new Set((invoices as Array<Record<string, any>>).map((i) => String(i.subcontractorCompanyId)))
    )
    const companies = await Subcompany.find({ _id: { $in: companyIds } }).select('name').lean()
    const nameById = new Map((companies as Array<Record<string, any>>).map((c) => [String(c._id), String(c.name)]))

    return NextResponse.json({
      success: true,
      invoices: (invoices as Array<Record<string, any>>).map((doc) => ({
        ...serializeInvoiceForAdmin(doc),
        subcontractorCompanyName: nameById.get(String(doc.subcontractorCompanyId)) || '–',
      })),
      meta: { total, page, limit },
    })
  } catch (error) {
    logger.error('Erhaltene Rechnungen konnten nicht geladen werden', error)
    return NextResponse.json({ error: 'Fehler beim Laden der Rechnungen' }, { status: 500 })
  }
}
