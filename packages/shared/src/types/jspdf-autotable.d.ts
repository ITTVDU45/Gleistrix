import 'jspdf'

/**
 * Augmentiert den jsPDF-Typ um die vom Plugin `jspdf-autotable` zur Laufzeit
 * ergänzten Member. Dadurch entfallen `(doc as any)`-Casts für `lastAutoTable`.
 */
declare module 'jspdf' {
  interface jsPDF {
    lastAutoTable?: { finalY: number }
  }
}
