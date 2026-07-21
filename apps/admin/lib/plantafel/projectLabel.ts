/**
 * Beschriftung eines Projekt-Laufzeitbalkens in der Einsatztafel.
 * Die Auftragsnummer steht bewusst vor dem Projektnamen.
 */
export function formatProjectBarTitle(name: string, auftragsnummer?: string): string {
  return auftragsnummer ? `${auftragsnummer} · ${name}` : name
}
