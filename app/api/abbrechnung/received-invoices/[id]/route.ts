import { NextRequest, NextResponse } from 'next/server'
import mongoose from 'mongoose'
import dbConnect from '@/lib/dbConnect'
import ReceivedInvoice from '@/lib/models/ReceivedInvoice'
import SubcontractorDocument from '@/lib/models/SubcontractorDocument'
import { Subcompany } from '@/lib/models/Subcompany'
import { requireAdminUser } from '@/lib/auth/requireAdminUser'
import { isFeatureEnabled } from '@/lib/featureFlags'
import { serializeInvoiceForAdmin } from '@/lib/subunternehmen/serialize'
import { getAssignmentMapForCompany } from '@/lib/subunternehmen/invoiceValidation'
import { serializeCompanyForPortal } from '@/lib/subunternehmen/queries'
import { logger } from '@/lib/logger'

/**
 * Rechnungsdetail für die interne Prüfung inkl. Vergleichsbereich
 * (disponierte/bestätigte Einsätze vs. Rechnungspositionen).
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const adminAuth = await requireAdminUser(req)
    if (!adminAuth.ok) {
      return NextResponse.json({ error: adminAuth.error }, { status: adminAuth.status })
    }
    if (!(await isFeatureEnabled('receivedInvoicesEnabled'))) {
      return NextResponse.json({ error: 'Erhaltene Rechnungen sind deaktiviert' }, { status: 403 })
    }

    await dbConnect()
    const { id } = await params
    if (!mongoose.isValidObjectId(id)) {
      return NextResponse.json({ error: 'Rechnung nicht gefunden' }, { status: 404 })
    }

    const invoice = await ReceivedInvoice.findById(id).lean() as Record<string, any> | null
    if (!invoice || invoice.status === 'DRAFT') {
      return NextResponse.json({ error: 'Rechnung nicht gefunden' }, { status: 404 })
    }

    const [company, documents, assignmentMap] = await Promise.all([
      Subcompany.findById(invoice.subcontractorCompanyId).lean() as Promise<Record<string, any> | null>,
      SubcontractorDocument.find({
        invoiceId: invoice._id,
        // Defense-in-Depth: nur Dokumente des Rechnungsstellers anzeigen
        subcontractorCompanyId: invoice.subcontractorCompanyId,
      })
        .sort({ createdAt: -1 })
        .lean(),
      getAssignmentMapForCompany(invoice.subcontractorCompanyId),
    ])

    // Vergleichsbereich: Einsätze der verknüpften Projekte
    const projectIdSet = new Set((invoice.projectIds || []).map((p: unknown) => String(p)))
    const referencedKeys = new Set(
      (invoice.lineItems || [])
        .map((li: { assignmentKey?: string }) => li.assignmentKey)
        .filter(Boolean) as string[]
    )
    const comparisonAssignments = Array.from(assignmentMap.values())
      .filter((a) => projectIdSet.size === 0 || projectIdSet.has(a.projectId))
      .map((a) => ({
        ...a,
        referencedInInvoice: referencedKeys.has(a.assignmentKey),
      }))
      .sort((a, b) => a.day.localeCompare(b.day))

    // Abweichungen erkennen
    const deviations: string[] = [...(invoice.warnings || [])]
    for (const li of invoice.lineItems || []) {
      if (!li.assignmentKey) continue
      const assignment = assignmentMap.get(li.assignmentKey)
      if (!assignment) {
        deviations.push(`Position "${li.description}": zugehöriger Einsatz nicht (mehr) in der Disposition`)
        continue
      }
      if (li.type === 'HOURS' && li.unit === 'h' && Math.abs(li.quantity - assignment.stundenTotal) > 0.01) {
        deviations.push(
          `Position "${li.description}": ${li.quantity} h abgerechnet, ${assignment.stundenTotal} h bestätigt`
        )
      }
    }

    return NextResponse.json({
      success: true,
      invoice: serializeInvoiceForAdmin(invoice),
      company: company
        ? { ...serializeCompanyForPortal(company), notes: undefined }
        : null,
      documents: (documents as Array<Record<string, any>>).map((d) => ({
        id: String(d._id),
        name: d.name,
        type: d.type,
        contentType: d.contentType,
        size: d.size,
        source: d.source,
        createdAt: d.createdAt,
      })),
      comparison: {
        assignments: comparisonAssignments,
        deviations,
      },
    })
  } catch (error) {
    logger.error('Erhaltene Rechnung konnte nicht geladen werden', error)
    return NextResponse.json({ error: 'Fehler beim Laden der Rechnung' }, { status: 500 })
  }
}
