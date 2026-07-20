import mongoose from 'mongoose'
import { computeExternalCompanyIds } from '../timeEntry/externalCompanies'

const technikEntrySchema = new mongoose.Schema({
  id: String,
  name: String,
  anzahl: Number,
  meterlaenge: Number,
  bemerkung: String
}, { _id: false })

const timeEntrySchema = new mongoose.Schema({
  id: String,
  name: String,
  funktion: {
    type: String,
    enum: ['SIPO', 'HFE', 'Monteur/bediener', 'Sakra', 'BüP', 'HiBa', 'SAS', 'Bahnerder']
  },
  start: String,
  ende: String,
  stunden: Number,
  fahrtstunden: Number,
  pause: String,
  extra: Number,
  nachtzulage: String,
  sonntag: Number,
  feiertag: Number,
  bemerkung: String
}, { _id: false })

const vehicleAssignmentSchema = new mongoose.Schema({
  id: String,
  type: String,
  licensePlate: String,
  kilometers: String
}, { _id: false })

const projectSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  auftraggeber: {
    type: String,
    required: true
  },
  baustelle: {
    type: String,
    required: true
  },
  auftragsnummer: {
    type: String,
    required: true
  },
  sapNummer: {
    type: String,
    required: true
  },
  telefonnummer: {
    type: String,
    required: true
  },
  // Ansprechpartner-Stammdaten (getrennt: Name / E-Mail; Telefon = telefonnummer)
  ansprechpartner: {
    type: String,
    default: ''
  },
  ansprechpartnerEmail: {
    type: String,
    default: ''
  },
  // DB-Leistungsanfrage-Details (aus dem Import; frei anzeigbar)
  leistungsanfrage: {
    type: {
      anfragedatum: { type: String, default: '' },
      rueckmeldefrist: { type: String, default: '' },
      leistungszeitraum: { type: String, default: '' },
      dvaVersicherung: { type: String, default: '' },
      rvFamilie: { type: String, default: '' },
      raumlos: { type: String, default: '' },
      summe: { type: String, default: '' },
      aufgaben: { type: String, default: '' },
    },
    default: undefined,
  },
  // Manuell/importiert pflegbare Leistungen (Phasen mit Positionen)
  leistungen: {
    type: [
      {
        id: { type: String },
        subtitel: { type: String, default: '' },
        titel: { type: String, default: '' },
        positionen: {
          type: [
            {
              id: { type: String },
              nummer: { type: String, default: '' },
              bezeichnung: { type: String, default: '' },
              beschreibung: { type: String, default: '' },
              menge: { type: String, default: '' },
              einheit: { type: String, default: '' },
              einzelpreis: { type: String, default: '' },
              gesamtsumme: { type: String, default: '' },
            },
          ],
          default: [],
        },
      },
    ],
    default: undefined,
  },
  status: {
    type: String,
    enum: ['aktiv', 'abgeschlossen', 'fertiggestellt', 'geleistet', 'teilweise_abgerechnet', 'kein Status'],
    default: 'aktiv'
  },
  atwsImEinsatz: {
    type: Boolean,
    default: false
  },
  anzahlAtws: {
    type: Number,
    default: 0
  },
  gesamtMeterlaenge: {
    type: Number,
    default: 0
  },
  datumBeginn: {
    type: String,
    required: true
  },
  datumEnde: {
    type: String,
    required: true
  },
  technik: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  mitarbeiterZeiten: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  fahrzeuge: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
  ,
  dokumente: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
  ,
  abgerechneteTage: {
    type: [String],
    default: []
  },
  /**
   * Materialisierte Subunternehmen-IDs aus mitarbeiterZeiten (indiziert).
   * Wird im pre-save-Hook bzw. via syncProjectExternalCompanyIds gepflegt –
   * niemals manuell setzen.
   */
  externalCompanyIds: {
    type: [String],
    default: [],
    index: true
  }
}, {
  timestamps: true,
  strict: false
})

// Materialisiertes Feld bei jedem save() aktuell halten (Mixed-Feld ist
// nicht indizierbar; Portal-Queries laufen über externalCompanyIds).
projectSchema.pre('save', function (next) {
  try {
    this.set('externalCompanyIds', computeExternalCompanyIds(this.get('mitarbeiterZeiten')))
  } catch {
    // Materialisierung darf das Speichern nie verhindern
  }
  next()
})

/**
 * Getyptes Project-Dokument. Die dynamischen Felder (Mixed-Schema,
 * datums-keyed) sind bewusst als Record<string, any> typisiert; die
 * Index-Signatur bewahrt das `strict: false`-Verhalten, sodass bestehende
 * Zugriffe auf weitere Felder nicht brechen.
 */
export interface ProjectDoc extends mongoose.Document {
  technik: Record<string, any>
  fahrzeuge: Record<string, any>
  mitarbeiterZeiten: Record<string, any>
  dokumente?: Record<string, any>
  gesamtMeterlaenge?: number
  atwsImEinsatz?: boolean
  anzahlAtws?: number
  abgerechneteTage?: string[]
  markModified(path: string): void
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any
}

// In Dev/Hot-Reload kann ein altes Model ohne externalCompanyIds im Cache liegen
const existingProjectModel = mongoose.models.Project
if (existingProjectModel && !existingProjectModel.schema.path('externalCompanyIds')) {
  delete (mongoose.models as Record<string, unknown>).Project
}

// Prüfe, ob das Model bereits existiert, bevor es erstellt wird
export const Project: mongoose.Model<ProjectDoc> =
  (mongoose.models.Project as mongoose.Model<ProjectDoc>) ||
  mongoose.model<ProjectDoc>('Project', projectSchema as mongoose.Schema<ProjectDoc>) 