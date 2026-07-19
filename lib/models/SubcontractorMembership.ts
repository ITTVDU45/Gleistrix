import mongoose, { Schema, models } from 'mongoose'

/**
 * Mitgliedschaft eines Benutzerkontos in einem Subunternehmen.
 * Ein Subunternehmen kann mehrere Benutzer haben; ein Benutzer gehört
 * (fachlich) zu genau einem Subunternehmen.
 */
const SubcontractorMembershipSchema = new Schema(
  {
    subcontractorCompanyId: {
      type: Schema.Types.ObjectId,
      ref: 'Subcompany',
      required: true,
      index: true,
    },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    role: {
      type: String,
      enum: ['SUBCONTRACTOR_OWNER', 'SUBCONTRACTOR_USER'],
      required: true,
    },
    /** Granulare Permissions; leer = Rollen-Defaults (siehe lib/subunternehmen/permissions.ts) */
    permissions: [{ type: String }],
    status: {
      type: String,
      enum: ['invited', 'active', 'disabled'],
      default: 'invited',
      index: true,
    },
    invitedByUserId: { type: Schema.Types.ObjectId, ref: 'User' },
    invitedAt: { type: Date },
    acceptedAt: { type: Date },
  },
  { timestamps: true }
)

// Keine doppelte Membership pro Benutzer und Subunternehmen
SubcontractorMembershipSchema.index(
  { subcontractorCompanyId: 1, userId: 1 },
  { unique: true }
)

export default models.SubcontractorMembership ||
  mongoose.model('SubcontractorMembership', SubcontractorMembershipSchema, 'subcontractor_memberships')
