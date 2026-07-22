import mongoose, { Document, Schema, models } from 'mongoose'

export interface IEmployeeFinanceRate extends Document {
  employeeId: mongoose.Types.ObjectId
  funktion: string
  validFrom: Date
  baseHourlyCents: number
  travelHourlyCents: number
  nightSurchargePercent: number
  sundaySurchargePercent: number
  holidaySurchargePercent: number
  note?: string
  createdBy?: mongoose.Types.ObjectId
  createdAt: Date
  updatedAt: Date
}

const EmployeeFinanceRateSchema = new Schema<IEmployeeFinanceRate>({
  employeeId: { type: Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
  funktion: { type: String, required: true, trim: true, maxlength: 60, index: true },
  validFrom: { type: Date, required: true, index: true },
  baseHourlyCents: { type: Number, required: true, min: 0 },
  travelHourlyCents: { type: Number, required: true, min: 0, default: 0 },
  nightSurchargePercent: { type: Number, min: 0, default: 0 },
  sundaySurchargePercent: { type: Number, min: 0, default: 0 },
  holidaySurchargePercent: { type: Number, min: 0, default: 0 },
  note: { type: String, trim: true, maxlength: 500 },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true })

// Ein Satz je Mitarbeiter + Funktion + Gültigkeitsdatum (strikt funktionsbezogen)
EmployeeFinanceRateSchema.index({ employeeId: 1, funktion: 1, validFrom: 1 }, { unique: true })

export default models.EmployeeFinanceRate || mongoose.model<IEmployeeFinanceRate>('EmployeeFinanceRate', EmployeeFinanceRateSchema)
