import type {
  GaebBillOfQuantities,
  GaebPosition,
  GaebAgentAnalysis,
  GaebAgentRisk,
  GaebAgentCluster,
  GaebAgentResourceSuggestion,
} from '@/types/gaeb'

/**
 * Regelbasierte GAEB-LV-Analyse (reine, deterministische Funktion).
 *
 * Erkennt Risiken/Auffälligkeiten, fehlende Angaben, gruppiert Positionen nach
 * Gewerken und leitet Ressourcen-Vorschläge sowie einen Projektanlage-Vorschlag
 * ab. Bewusst ohne externe KI – eine spätere LLM-Anreicherung kann auf dieser
 * strukturierten Ausgabe aufsetzen.
 */

const GEWERK_KEYWORDS: Record<string, string[]> = {
  Verkehrssicherung: ['absperr', 'verkehrszeichen', 'warnleucht', 'leitkegel', 'rsa', 'baustellensicherung', 'absicherung'],
  Gleisbau: ['gleis', 'schiene', 'schwelle', 'schotter', 'weiche', 'oberbau'],
  Erdarbeiten: ['erdaushub', 'aushub', 'bodenaustausch', 'verfüll', 'planum'],
  Tiefbau: ['kanal', 'rohr', 'schacht', 'entwässer', 'leitungsgraben'],
  Personal: ['stunde', 'schicht', 'sipo', 'sakra', 'büp', 'posten', 'nachtschicht'],
  Montage: ['montage', 'demontage', 'aufbau', 'abbau', 'einrichten'],
}

function classifyGewerk(text: string): string {
  const lower = text.toLowerCase()
  for (const [gewerk, keywords] of Object.entries(GEWERK_KEYWORDS)) {
    if (keywords.some((k) => lower.includes(k))) return gewerk
  }
  return 'Sonstiges'
}

function flattenPositions(boq: GaebBillOfQuantities): GaebPosition[] {
  return boq.lots.flatMap((lot) => lot.titles.flatMap((t) => t.positions))
}

export function analyzeBoq(boq: GaebBillOfQuantities): GaebAgentAnalysis {
  const positions = flattenPositions(boq)
  const total = positions.length

  const risks: GaebAgentRisk[] = []
  const missingData: string[] = []

  if (total === 0) {
    risks.push({ id: 'no-positions', title: 'Keine Positionen', hint: 'Im LV wurden keine Positionen erkannt.', level: 'hoch' })
  }

  const noPrice = positions.filter((p) => p.price?.unitPrice === undefined && p.price?.totalPrice === undefined).length
  const noQty = positions.filter((p) => p.quantity === undefined).length
  const noUnit = positions.filter((p) => !p.unit).length

  if (noPrice > 0) {
    missingData.push(`${noPrice} Position(en) ohne Preisangabe`)
    risks.push({
      id: 'missing-prices',
      title: 'Fehlende Preise',
      hint: `${noPrice} von ${total} Positionen haben keinen Preis – für die Kalkulation ergänzen.`,
      level: noPrice / Math.max(total, 1) > 0.5 ? 'hoch' : 'mittel',
    })
  }
  if (noQty > 0) {
    missingData.push(`${noQty} Position(en) ohne Menge`)
    risks.push({ id: 'missing-qty', title: 'Fehlende Mengen', hint: `${noQty} Positionen ohne Mengenangabe.`, level: 'mittel' })
  }
  if (noUnit > 0) {
    missingData.push(`${noUnit} Position(en) ohne Einheit`)
  }

  // Klumpenrisiko: einzelne Position dominiert die Summe
  if (boq.netSum && boq.netSum > 0) {
    const dominant = positions.find((p) => (p.price?.totalPrice ?? 0) > boq.netSum! * 0.4)
    if (dominant) {
      risks.push({
        id: 'concentration',
        title: 'Klumpenrisiko',
        hint: `Position „${dominant.shortText.slice(0, 60)}" macht über 40 % der Nettosumme aus – Aufwand genau prüfen.`,
        level: 'mittel',
      })
    }
  }

  // Pauschalpositionen
  const pauschal = positions.filter((p) => (p.unit ?? '').toLowerCase().includes('psch') || (p.unit ?? '').toLowerCase().includes('pausch')).length
  if (pauschal > 0) {
    risks.push({ id: 'pauschal', title: 'Pauschalpositionen', hint: `${pauschal} Pauschalposition(en) – Aufwand sorgfältig kalkulieren.`, level: 'niedrig' })
  }

  // Nacht-/Schicht-Hinweis
  const nightRelevant = positions.some((p) => `${p.shortText} ${p.longText ?? ''}`.toLowerCase().match(/nacht|schicht|sperrpause/))
  if (nightRelevant) {
    risks.push({ id: 'shift', title: 'Schicht-/Nachtarbeit', hint: 'LV enthält Schicht-/Nachtpositionen – qualifiziertes Personal und Zuschläge einplanen.', level: 'mittel' })
  }

  // Cluster nach Gewerk
  const clusterMap = new Map<string, number>()
  for (const p of positions) {
    const g = classifyGewerk(`${p.shortText} ${p.longText ?? ''}`)
    clusterMap.set(g, (clusterMap.get(g) ?? 0) + 1)
  }
  const clusters: GaebAgentCluster[] = Array.from(clusterMap.entries())
    .map(([label, positionCount], i) => ({ id: `c${i}`, label, positionCount, gewerk: label }))
    .sort((a, b) => b.positionCount - a.positionCount)

  // Ressourcen-Vorschläge (heuristisch aus Gewerken)
  const resourceSuggestions: GaebAgentResourceSuggestion[] = []
  if (clusterMap.has('Verkehrssicherung')) {
    resourceSuggestions.push(
      { type: 'mitarbeiter', label: 'Verkehrssicherer / Sicherungsposten', reason: 'Positionen im Bereich Verkehrssicherung erkannt' },
      { type: 'lagerartikel', label: 'Absperrmaterial (Schranken, Warnleuchten)', reason: 'Verkehrssicherungs-Positionen' }
    )
  }
  if (clusterMap.has('Gleisbau')) {
    resourceSuggestions.push({ type: 'fahrzeug', label: 'Zweiwegefahrzeug / Gleisbaugerät', reason: 'Gleisbau-Positionen erkannt' })
  }
  if (clusterMap.has('Personal') || nightRelevant) {
    resourceSuggestions.push({ type: 'mitarbeiter', label: 'Qualifiziertes Schichtpersonal (SiPo/BÜP)', reason: 'Personal-/Schichtpositionen erkannt' })
  }

  const summaryParts = [
    `${total} Positionen in ${boq.lots.length} Los/Losen`,
    boq.netSum !== undefined ? `Nettosumme ${boq.netSum.toLocaleString('de-DE', { style: 'currency', currency: boq.currency || 'EUR' })}` : null,
    clusters.length ? `Schwerpunkt: ${clusters[0].label}` : null,
  ].filter(Boolean)

  return {
    importJobId: boq.importJobId,
    summary: summaryParts.join(' · '),
    risks,
    missingData,
    clusters,
    resourceSuggestions: resourceSuggestions.length ? resourceSuggestions : undefined,
    projectDraft: { name: boq.projectName || 'GAEB-Projekt', positionCount: total },
    generatedAt: new Date().toISOString(),
  }
}
