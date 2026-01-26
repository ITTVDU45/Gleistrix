import mongoose from 'mongoose';

const employeeSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  miNumber: {
    type: Number,
    required: true,
    unique: true
  },
  position: {
    type: String,
    default: ''
  },
  email: {
    type: String,
    default: ''
  },
  phone: {
    type: String,
    default: ''
  },
  status: {
    type: String,
    enum: ['aktiv', 'nicht aktiv', 'urlaub'],
    default: 'aktiv'
  },
  elbaId: {
    type: String,
    default: ''
  },
  address: {
    type: String,
    default: ''
  },
  postalCode: {
    type: String,
    default: ''
  },
  city: {
    type: String,
    default: ''
  },
  vacationDays: {
    type: [{
      startDate: {
        type: Date,
        required: true
      },
      endDate: {
        type: Date,
        required: true
      },
      reason: {
        type: String,
        default: ''
      },
      approved: {
        type: Boolean,
        default: true
      },
      id: {
        type: String,
        required: true
      }
    }],
    default: []
  },
  einsaetze: [{
    projektId: { type: String, index: true },
    datum: { type: String, index: true },
    stunden: Number,
    fahrtstunden: {
      type: Number,
      default: 0
    },
    funktion: String,
    entryId: { type: String, index: true } // Referenz zum Zeiteintrag-ID im Projekt
  }]
}, {
  timestamps: true
});

// Prüfe, ob das Model bereits existiert, bevor es erstellt wird
export const Employee = mongoose.models.Employee || mongoose.model('Employee', employeeSchema); 