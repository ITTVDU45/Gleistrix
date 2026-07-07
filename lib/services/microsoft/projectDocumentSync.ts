import dbConnect from '@/lib/dbConnect'
import IntegrationConfig from '@/lib/models/IntegrationConfig'
import { ensureFolder, uploadSmallFile } from './onedrive-sync'

/**
 * Spiegelt Projektdokumente zusätzlich nach OneDrive – in einen pro Projekt
 * eigenen Ordner (`{Basis-Ordner}/{Projektordner}`). Ordnername aus dem in den
 * Einstellungen konfigurierten Template (Variablen: projektnummer, projektname,
 * auftraggeber). Best effort: wirft nie in den Aufrufer zurück.
 */

interface ProjectLike {
  name?: string
  auftraggeber?: string
  auftragsnummer?: string
}

export interface DocSyncResult {
  uploaded: boolean
  webUrl?: string
  /** Grund, falls nicht hochgeladen: 'not_connected' | 'no_onedrive_module' | Fehlertext. */
  reason?: string
}

// In OneDrive unzulässige Zeichen ersetzen; Länge begrenzen.
function sanitizeSegment(s: string): string {
  return (s || '')
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120)
}

function renderTemplate(tpl: string, p: ProjectLike): string {
  return tpl
    .replace(/\{\{\s*projektnummer\s*\}\}/gi, p.auftragsnummer || '')
    .replace(/\{\{\s*projektname\s*\}\}/gi, p.name || '')
    .replace(/\{\{\s*auftraggeber\s*\}\}/gi, p.auftraggeber || '')
}

async function loadStorageSettings() {
  await dbConnect()
  const doc = (await IntegrationConfig.findOne({ integrationId: 'microsoft' }).lean()) as Record<string, unknown> | null
  const config = (doc?.config as Record<string, unknown>) || {}
  const modules = (config.enabledModules as string[]) || []
  const storage = (config.storage as Record<string, unknown>) || {}
  return {
    connected: doc?.status === 'connected',
    onedriveEnabled: modules.includes('onedrive'),
    baseFolderName: (storage.baseFolderName as string) || 'Gleistrix ERP',
    template: (storage.projectFolderNameTemplate as string) || '{{projektnummer}}_{{projektname}}',
  }
}

/** Lädt ein einzelnes Dokument in den Projektordner in OneDrive. */
export async function syncProjectDocumentToOneDrive(params: {
  project: ProjectLike
  fileName: string
  content: Buffer | Uint8Array
  contentType?: string
}): Promise<DocSyncResult> {
  try {
    const s = await loadStorageSettings()
    if (!s.connected) return { uploaded: false, reason: 'not_connected' }
    if (!s.onedriveEnabled) return { uploaded: false, reason: 'no_onedrive_module' }

    const base = sanitizeSegment(s.baseFolderName) || 'Gleistrix ERP'
    const folderName = sanitizeSegment(renderTemplate(s.template, params.project)) || 'Projekt'
    const folderPath = `${base}/${folderName}`

    await ensureFolder(folderPath)
    const fileName = sanitizeSegment(params.fileName) || 'dokument'
    const item = await uploadSmallFile(
      folderPath,
      fileName,
      params.content,
      params.contentType || 'application/octet-stream'
    )
    return { uploaded: true, webUrl: item.webUrl }
  } catch (err) {
    console.error('[Projekt→OneDrive] Dokument-Sync fehlgeschlagen:', err)
    return { uploaded: false, reason: err instanceof Error ? err.message : 'Unbekannter Fehler' }
  }
}
