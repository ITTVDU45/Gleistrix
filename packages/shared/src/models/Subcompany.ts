import mongoose from 'mongoose'

/**
 * Subunternehmen als Organisation. Bestehende Felder (Disposition) bleiben
 * unverändert; die Portal-/Rechnungsstammdaten sind optionale Erweiterungen.
 * Es existiert bewusst nur diese eine Collection für Subunternehmen.
 */
const subcompanySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true },
    employeeCount: { type: Number, required: true, min: 1 },
    address: { type: String, default: '' },
    phone: { type: String, default: '' },
    email: { type: String, default: '' },
    bankAccount: { type: String, default: '' },
    notes: { type: String, default: '' },

    // ===== Portal-Erweiterung (Rechnungs-/Stammdaten) =====
    legalName: { type: String },
    billingAddress: {
      street: { type: String },
      postalCode: { type: String },
      city: { type: String },
      country: { type: String },
    },
    contactName: { type: String },
    contactEmail: { type: String },
    contactPhone: { type: String },
    taxNumber: { type: String },
    vatId: { type: String },
    iban: { type: String },
    bic: { type: String },
    bankName: { type: String },
    defaultPaymentTermDays: { type: Number },
    defaultVatRate: { type: Number },
    invoiceNumberPrefix: { type: String },
    /** Vereinbarte Stundensätze je Funktion (Basis der Rechnungsvorschläge im Portal) */
    functionRates: {
      type: [
        new mongoose.Schema(
          {
            funktion: { type: String, required: true },
            hourlyRate: { type: Number, required: true, min: 0 },
          },
          { _id: false }
        ),
      ],
      default: [],
    },
    /** Zuschläge in Prozent auf den Funktions-Stundensatz */
    surchargeRates: {
      nachtProzent: { type: Number, min: 0, max: 1000 },
      sonntagProzent: { type: Number, min: 0, max: 1000 },
      feiertagProzent: { type: Number, min: 0, max: 1000 },
    },
    /** Referenz auf SubcontractorDocument (Firmenlogo) */
    logoDocumentId: { type: mongoose.Schema.Types.ObjectId, ref: 'SubcontractorDocument' },
    status: {
      type: String,
      enum: ['active', 'inactive', 'blocked'],
      default: 'active',
    },
  },
  { timestamps: true }
)

// In Dev/Hot-Reload kann ein altes Model ohne die neuen Felder im Cache liegen.
const existingSubcompanyModel = mongoose.models.Subcompany
if (existingSubcompanyModel && !existingSubcompanyModel.schema.path('functionRates')) {
  delete (mongoose.models as Record<string, unknown>).Subcompany
}

export const Subcompany =
  mongoose.models.Subcompany || mongoose.model('Subcompany', subcompanySchema)
