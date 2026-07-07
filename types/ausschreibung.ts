/**
 * Ausschreibung / Angebot – projektbezogene LV-Aufnahme.
 *
 * Verknüpft ein Projekt mit einem geparsten GAEB-LV (BoQ) bzw. hält perspektivisch
 * auch manuell erfasste Positionen. Die eigentlichen Positionen liegen in der
 * GaebBillOfQuantities (boqId); dieses Modell ist die projektseitige Sicht.
 */

export type AusschreibungSource = 'gaeb' | 'manuell'
export type AusschreibungKind = 'ausschreibung' | 'angebot'

export interface Ausschreibung {
  _id: string
  projectId: string
  kind: AusschreibungKind
  source: AusschreibungSource
  name: string
  version?: string
  phase?: string
  /** Referenzen auf den GAEB-Import (falls source = 'gaeb') */
  importJobId?: string
  boqId?: string
  fileId?: string
  positionCount: number
  netSum?: number
  currency: string
  createdByUserId?: string
  /** ISO-Zeitstempel */
  createdAt: string
  updatedAt: string
}
