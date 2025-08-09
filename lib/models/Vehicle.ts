import mongoose from 'mongoose'

const vehicleSchema = new mongoose.Schema({
  type: {
    type: String,
    required: true
  },
  licensePlate: {
    type: String,
    required: true
  },
  fuelAmount: {
    type: String,
    default: ''
  },
  damages: {
    type: String,
    default: ''
  },
  kilometers: {
    type: String,
    default: ''
  },
  projectCount: {
    type: Number,
    default: 0
  },
  manualStatus: {
    type: String,
    enum: ['verfügbar', 'wartung', 'nicht_verfügbar'],
    default: 'verfügbar'
  },
  statusNote: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
})

// Prüfe, ob das Model bereits existiert, bevor es erstellt wird
export const Vehicle = mongoose.models.Vehicle || mongoose.model('Vehicle', vehicleSchema) 