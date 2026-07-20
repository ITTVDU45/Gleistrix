/**
 * Typdefinitionen für die mobile Lager-App.
 * Aus LagerMobileApp.tsx extrahiert (reine Typen, kein Laufzeitcode).
 */

export type ProjectOption = { value: string; label: string }

export type MobileView =
  | 'home'
  | 'eingang'
  | 'ausgang'
  | 'lieferschein'
  | 'bestand'
  | 'bewegungen'
  | 'wartung'
  | 'inventur'
  | 'produkte'
  | 'lieferanten'

export type MovementEntryMode = 'select' | 'qr' | 'manual'

export type MaintenanceRow = {
  _id?: string
  artikelId?: { bezeichnung?: string; artikelnummer?: string } | string
  wartungsart?: string
  faelligkeitsdatum?: string
  status?: string
}

export type InventoryPosition = {
  artikelId?: { _id?: string; bezeichnung?: string; artikelnummer?: string; barcode?: string; serialTracking?: string } | string
  sollMenge?: number
  istMenge?: number
  differenz?: number
}

export type InventoryScanEvent = {
  artikelId?: string
  code?: string
  scannedAt?: string
  sessionId?: string
}

export type InventoryRow = {
  _id?: string
  name?: string
  beschreibung?: string
  typ?: string
  stichtag?: string
  zeitraumVon?: string | null
  zeitraumBis?: string | null
  status?: string
  kategorien?: string[]
  artikelIds?: string[]
  abgeschlossenAm?: string | null
  activeScanSessionId?: string | null
  lastScanAt?: string | null
  scanEvents?: InventoryScanEvent[]
  positionen?: InventoryPosition[]
}

export type InventoryFocusType = 'alle' | 'kategorien' | 'artikel'

export type InventoryFormState = {
  name: string
  beschreibung: string
  stichtag: string
  zeitraumVon: string
  zeitraumBis: string
  fokusTyp: InventoryFocusType
  kategorien: string[]
  artikelIds: string[]
  unitIds: string[]
}

export type InventoryEditForm = InventoryFormState

export type OpenOutgoingDeliveryNote = {
  _id: string
  nummer: string
  datum?: string
  empfaenger?: { name?: string }
}

export type DeliveryNotePosition = {
  artikelId?: { _id?: string; id?: string; bezeichnung?: string; artikelnummer?: string } | string
  bezeichnung?: string
  menge?: number
}

export type DeliveryNoteRow = {
  _id: string
  nummer: string
  typ: 'eingang' | 'ausgang'
  datum?: string
  status?: 'entwurf' | 'abgeschlossen'
  empfaenger?: { name?: string; adresse?: string }
  positionen?: DeliveryNotePosition[]
}

export type DeliveryNoteQrPayload = {
  deliveryNoteId: string
  typ: 'eingang' | 'ausgang'
  nummer?: string
}

export type DeliveryNoteEditForm = {
  datum: string
  status: 'entwurf' | 'abgeschlossen'
  empfaengerName: string
  empfaengerAdresse: string
}

export type IncomingItem = {
  id: string
  artikelId: string
  menge: number
}

export type EvidencePhoto = {
  dataUrl: string
  filename: string
  capturedAt: string
}

export type InventoryCreateForm = InventoryFormState
