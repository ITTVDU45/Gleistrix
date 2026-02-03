import { DeliveryNote } from '@/lib/models/DeliveryNote'

/**
 * Nächste Lieferschein-Nummer im Format LFS-YYYY-NNNN (Jahr + laufende Nummer).
 */
export async function getNextDeliveryNoteNumber(): Promise<string> {
  const year = new Date().getFullYear()
  const prefix = `LFS-${year}-`
  const existing = await DeliveryNote.find({ nummer: new RegExp(`^${prefix}\\d+`) })
    .sort({ nummer: -1 })
    .limit(1)
    .select('nummer')
    .lean()
  let nextSeq = 1
  if (existing.length > 0 && existing[0].nummer) {
    const match = (existing[0].nummer as string).match(new RegExp(`${prefix}(\\d+)`))
    if (match) nextSeq = parseInt(match[1], 10) + 1
  }
  return `${prefix}${String(nextSeq).padStart(4, '0')}`
}
