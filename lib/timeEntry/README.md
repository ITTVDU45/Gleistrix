# TimeEntry Module

Modulare, wiederverwendbare Utilities für die Zeiteintrag-Funktionalität.

## Struktur

```
lib/timeEntry/
├── index.ts              # Zentrale Exports
├── types.ts              # TypeScript-Typen
├── calculateTimeValues.ts # Berechnungsfunktionen
├── buildTimeEntry.ts     # Entry-Builder
├── batchProcessor.ts     # Parallele Batch-Verarbeitung
└── README.md             # Diese Dokumentation
```

## Verwendung

```typescript
import { 
  buildTimeEntry, 
  processBatch, 
  calculateSundayHours,
  type TimeEntryWithSunday 
} from '@/lib/timeEntry'
```

## Module

### `types.ts`
- `TimeEntryWithSunday` - Erweiterter TimeEntry-Typ
- `BuildEntryParams` - Parameter für Entry-Erstellung
- `BatchResult<T>` - Ergebnis eines Batch-Prozesses
- `BatchProgressCallback` - Fortschritts-Callback

### `calculateTimeValues.ts`
- `calculateHoursForDay(startISO, endISO)` - Arbeitsstunden berechnen
- `calculateNightBonus(startISO, endISO, pause)` - Nachtzulage (23:00-06:00)
- `calculateSundayHours(startISO, endISO)` - Sonntagsstunden
- `calculateHolidayHours(...)` - Feiertagsstunden
- `parseNumber(value, defaultValue)` - String zu Zahl parsen

### `buildTimeEntry.ts`
- `buildTimeEntry(params)` - Einzelnen TimeEntry erstellen
- `buildTimeEntriesForDays(...)` - Mehrere Entries für Tage
- `prepareBatchPayloads(...)` - Batch-Payloads vorbereiten

### `batchProcessor.ts`
- `processBatch(tasks, names, onProgress, retryConfig)` - Parallele Ausführung mit Promise.allSettled + Retry
- `processBatchWithRateLimit(...)` - Mit Concurrency-Limit + Retry
- `formatBatchErrorReport(result)` - Fehlerbericht formatieren
- `RetryConfig` - Konfiguration für Retry-Verhalten

**Retry-Logik (automatisch):**
- Max. 3 Versuche bei transienten Fehlern
- Exponentielles Backoff (500ms, 1s, 2s, ...)
- Erkennt Netzwerkfehler, Timeouts, 5xx-Fehler

## Beispiel: Parallele Mitarbeiter-Verarbeitung

```typescript
// Tasks für jeden Mitarbeiter erstellen
const tasks = employees.map((name) => async () => {
  const entry = buildTimeEntry({
    name,
    day: '2024-01-15',
    startTime: '08:00',
    endTime: '16:00',
    funktion: 'SIPO',
    pause: '0,5',
    extra: '0',
    fahrtstunden: '0',
    bemerkung: '',
    isMultiDay: false,
    isHoliday: false,
    isSunday: false
  })
  return await saveToApi(entry)
})

// Parallel ausführen
const result = await processBatch(tasks, employees)

if (!result.success) {
  console.log(formatBatchErrorReport(result))
}
```

## Performance

**Vorher (sequentiell):**
- 5 Mitarbeiter × 10 Tage = 50 API-Calls (~10s)

**Nachher (parallel):**
- 5 Mitarbeiter parallel = 5 API-Calls (~400ms)

**Geschwindigkeitssteigerung: ~25x**
