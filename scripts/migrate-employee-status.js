// Dieses Skript setzt für alle Mitarbeiter ohne Status-Feld den Wert 'aktiv'.
// Ausführen mit: node scripts/migrate-employee-status.js

import mongoose from 'mongoose';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

// Pfad zur .env.local-Datei ermitteln
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');
const envPath = join(rootDir, '.env.local');

// Umgebungsvariablen manuell laden
const envContent = fs.readFileSync(envPath, 'utf8');
const envVars = envContent.split('\n').reduce((acc, line) => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    acc[match[1]] = match[2];
  }
  return acc;
}, {});

const dbUrl = envVars.MONGODB_URI || 'mongodb://localhost:27017/mh-zeiterfassung';

const employeeSchema = new mongoose.Schema({}, { strict: false });
const Employee = mongoose.model('Employee', employeeSchema, 'employees');

async function migrate() {
  console.log(`Verbinde mit Datenbank: ${dbUrl.replace(/\/\/([^:]+):[^@]+@/, '//***:***@')}`);
  await mongoose.connect(dbUrl);
  console.log('Verbindung hergestellt');
  
  // Zähle Mitarbeiter ohne Status
  const countWithoutStatus = await Employee.countDocuments({ status: { $exists: false } });
  console.log(`Gefunden: ${countWithoutStatus} Mitarbeiter ohne Status-Feld`);
  
  // Führe die Migration durch
  const res = await Employee.updateMany(
    { status: { $exists: false } },
    { $set: { status: 'aktiv' } }
  );
  console.log(`Mitarbeiter aktualisiert: ${res.modifiedCount}`);
  
  // Zeige alle Mitarbeiter mit ihrem Status an
  const allEmployees = await Employee.find({}, { name: 1, status: 1 });
  console.log('Aktuelle Mitarbeiter mit Status:');
  allEmployees.forEach(emp => {
    console.log(`- ${emp.name}: ${emp.status || 'kein Status'}`);
  });
  
  await mongoose.disconnect();
  console.log('Migration abgeschlossen');
}

migrate().catch(err => {
  console.error('Migration fehlgeschlagen:', err);
  process.exit(1);
}); 