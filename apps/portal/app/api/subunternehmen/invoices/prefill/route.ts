import { NextRequest, NextResponse } from 'next/server'
import dbConnect from '@/lib/dbConnect'
import { requireSubcontractor } from '@/lib/subunternehmen/access'
import { getAssignmentMapForCompany } from '@/lib/subunternehmen/invoiceValidation'
import { rateForFunktion, surchargeUnitPrice, type CompanyWithRates, type SurchargeKind } from '@/lib/subunternehmen/rates'
import type { SubcontractorAssignment } from '@/types/subunternehmen'
import { logger } from '@/lib/logger'

interface SuggestedLineItem {
  type: 'HOURS' | 'SURCHARGE'
  description: string
  projectId: string
  assignmentKey?: string
  serviceDate: string
  quantity: number
  unit: 'h'
  unitPrice: number
  vatRate: number
  surchargeType?: string
  surchargePercentage?: number
}

/**
 * Automatische Positionsübernahme: schlägt für bestätigte, noch nicht
 * abgerechnete Einsätze Rechnungspositionen vor (Stunden + Zuschläge).
 * Einzelpreise kommen aus den im Admin-Bereich hinterlegten Funktionspreisen
 * des Subunternehmens (Stunden × Stundensatz, Zuschläge optional prozentual)
 * und bleiben im Editor manuell änderbar.
 */
function suggestLineItems(
  a: SubcontractorAssignment,
  vatRate: number,
  company: CompanyWithRates
): SuggestedLineItem[] {
  const hourlyRate = rateForFunktion(company, a.funktion) ?? 0
  const base: SuggestedLineItem = {
    type: 'HOURS',
    description: `${a.projectName}${a.projectNumber ? ` (${a.projectNumber})` : ''} – ${a.count}× ${a.funktion}, ${a.day}`,
    projectId: a.projectId,
    assignmentKey: a.assignmentKey,
    serviceDate: a.day,
    quantity: a.stundenTotal,
    unit: 'h',
    unitPrice: hourlyRate,
    vatRate,
  }
  const items: SuggestedLineItem[] = [base]

  const surcharges: Array<[number, string, SurchargeKind | undefined]> = [
    [a.nachtzulageTotal, 'Nachtstunden', 'nacht'],
    [a.sonntagsstundenTotal, 'Sonntagsstunden', 'sonntag'],
    [a.feiertagTotal, 'Feiertagsstunden', 'feiertag'],
    [a.extraTotal, 'Sonstige Zuschläge', undefined],
  ]
  for (const [hours, label, kind] of surcharges) {
    if (hours > 0) {
      const price = surchargeUnitPrice(company, a.funktion, kind)
      items.push({
        type: 'SURCHARGE',
        description: `${label} – ${a.funktion}, ${a.day}`,
        projectId: a.projectId,
        // Zuschlagszeilen referenzieren den Einsatz bewusst NICHT als
        // assignmentKey, damit die Basisposition die Doppelabrechnungs-
        // Erkennung trägt und Zuschläge ergänzend möglich bleiben.
        serviceDate: a.day,
        quantity: hours,
        unit: 'h',
        unitPrice: price.unitPrice,
        vatRate,
        surchargeType: label,
        surchargePercentage: price.percentage,
      })
    }
  }
  return items
}

export async function GET(req: NextRequest) {
  try {
    const auth = await requireSubcontractor(req, 'subcontractor.invoices.create')
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

    await dbConnect()
    const { ctx } = auth
    const { searchParams } = new URL(req.url)
    const projectId = searchParams.get('projectId') || undefined
    const keysParam = searchParams.get('keys') || ''
    const requestedKeys = keysParam
      .split(',')
      .map((k) => k.trim())
      .filter(Boolean)

    const assignmentMap = await getAssignmentMapForCompany(ctx.companyId)
    const vatRate = typeof ctx.company.defaultVatRate === 'number' ? ctx.company.defaultVatRate : 19
    const companyRates = ctx.company as CompanyWithRates

    let assignments = Array.from(assignmentMap.values()).filter((a) => a.status === 'bestaetigt')
    if (projectId) assignments = assignments.filter((a) => a.projectId === projectId)
    if (requestedKeys.length > 0) {
      const keySet = new Set(requestedKeys)
      assignments = assignments.filter((a) => keySet.has(a.assignmentKey))
    }
    assignments.sort((a, b) => a.day.localeCompare(b.day))

    const lineItems = assignments.flatMap((a) => suggestLineItems(a, vatRate, companyRates))

    // Einsätze in der Auswahl-Tabelle mit hinterlegtem Satz anreichern
    const assignmentsWithRates = assignments.map((a) => ({
      ...a,
      hourlyRate: rateForFunktion(companyRates, a.funktion),
    }))

    return NextResponse.json({
      success: true,
      assignments: assignmentsWithRates,
      lineItems,
      defaultVatRate: vatRate,
      defaultPaymentTermDays: ctx.company.defaultPaymentTermDays ?? undefined,
      /** Funktionen ohne hinterlegten Preis (Hinweis im Editor) */
      missingRates: Array.from(
        new Set(
          assignments
            .filter((a) => rateForFunktion(companyRates, a.funktion) === undefined)
            .map((a) => a.funktion)
        )
      ),
    })
  } catch (error) {
    logger.error('Portal: Positionsvorschläge konnten nicht geladen werden', error)
    return NextResponse.json({ error: 'Fehler beim Laden der Positionsvorschläge' }, { status: 500 })
  }
}
