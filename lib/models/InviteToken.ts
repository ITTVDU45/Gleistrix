import mongoose, { Schema, models } from 'mongoose';

const InviteTokenSchema = new Schema({
  email: { type: String, required: true },
  role: {
    type: String,
    enum: ['superadmin', 'admin', 'user', 'lager', 'subunternehmen'],
    required: true
  },
  /**
   * Klartext-Token (Altbestand, interne Einladungen). Subunternehmen-Einladungen
   * speichern hier den SHA-256-Hash (identisch zu `tokenHash`), damit der
   * bestehende Unique-Index ohne Migration weiter greift. Der Hash ist über die
   * Alt-Flows nicht einlösbar, da diese SUBCONTRACTOR-Einladungen ausfiltern.
   */
  token: { type: String, unique: true, sparse: true },
  /** SHA-256-Hash des Einladungstokens (neue, sichere Variante) */
  tokenHash: { type: String, unique: true, sparse: true },
  invitationType: {
    type: String,
    enum: ['INTERNAL_USER', 'EMPLOYEE', 'SUBCONTRACTOR'],
    default: 'INTERNAL_USER'
  },
  /** Zuordnung zum bestehenden Subunternehmen (keine Duplikate anlegen) */
  subcontractorCompanyId: { type: Schema.Types.ObjectId, ref: 'Subcompany' },
  /** Rolle innerhalb des Subunternehmens */
  subcontractorRole: {
    type: String,
    enum: ['SUBCONTRACTOR_OWNER', 'SUBCONTRACTOR_USER']
  },
  /** Optionale granulare Permissions für SUBCONTRACTOR_USER */
  subcontractorPermissions: [{ type: String }],
  used: { type: Boolean, default: false },
  revokedAt: { type: Date },
  expiresAt: { type: Date, required: true },
  acceptedAt: { type: Date },
  /** Optional: fehlt bei Einladungen durch ENV-Super-Admin ohne zugeordneten DB-User */
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: false },
  name: { type: String },
  firstName: { type: String },
  lastName: { type: String },
  phone: { type: String },
  modules: [{
    type: String,
    enum: ['dashboard', 'projekte', 'abrechnung', 'mitarbeiter', 'fahrzeuge', 'lager', 'zeiterfassung']
  }]
}, { timestamps: true });

InviteTokenSchema.index({ email: 1 });
InviteTokenSchema.index({ expiresAt: 1 });
InviteTokenSchema.index({ subcontractorCompanyId: 1 });

export default models.InviteToken || mongoose.model('InviteToken', InviteTokenSchema, 'inviteTokens');
