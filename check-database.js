import mongoose from 'mongoose';

// Verbindung zur Datenbank
async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/mh-zeiterfassung');
    console.log('MongoDB verbunden');
  } catch (error) {
    console.error('MongoDB Verbindungsfehler:', error);
  }
}

// Employee Schema definieren (identisch mit dem in lib/models/Employee.ts)
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
    projektId: String,
    datum: String,
    stunden: Number,
    fahrtstunden: {
      type: Number,
      default: 0
    },
    funktion: String
  }]
}, {
  timestamps: true
});

const Employee = mongoose.model('Employee', employeeSchema);

async function checkEmployee() {
  try {
    await connectDB();
    
    // Finde den Mitarbeiter mit der ID
    const employee = await Employee.findById('686cc76290a6d0f412ec114b');
    
    if (employee) {
      console.log('=== MITARBEITER IN DATENBANK ===');
      console.log('Name:', employee.name);
      console.log('Status:', employee.status);
      console.log('VacationDays:', employee.vacationDays);
      console.log('VacationDays length:', employee.vacationDays ? employee.vacationDays.length : 0);
      console.log('Raw document:', JSON.stringify(employee.toObject(), null, 2));
    } else {
      console.log('Mitarbeiter nicht gefunden');
    }
    
    await mongoose.disconnect();
  } catch (error) {
    console.error('Fehler:', error);
  }
}

checkEmployee(); 