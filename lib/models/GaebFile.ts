import mongoose from 'mongoose'

/**
 * Metadaten einer hochgeladenen GAEB-Rohdatei. Die eigentliche Datei liegt in
 * MinIO (storageKey). sha256 dient der Dubletten-/Idempotenzerkennung.
 */
const gaebFileSchema = new mongoose.Schema(
  {
    originalName: { type: String, required: true },
    storageKey: { type: String, required: true },
    bucket: { type: String, required: true },
    sizeBytes: { type: Number, required: true },
    mimeType: { type: String, default: '' },
    sha256: { type: String, required: true, index: true },
    uploadedByUserId: { type: String, default: null },
  },
  { timestamps: true }
)

export default mongoose.models.GaebFile || mongoose.model('GaebFile', gaebFileSchema)
