import mongoose from 'mongoose';

async function run() {
  await mongoose.connect('mongodb://localhost:27017/mh-zeiterfassung');
  await mongoose.connection.collection('projects').insertOne({
    name: "Testprojekt 1",
    auftraggeber: "Max Mustermann",
    baustelle: "Musterstraße 1",
    auftragsnummer: "A-12345",
    sapNummer: "SAP-98765",
    telefonnummer: "01234-567890",
    status: "aktiv",
    atwsImEinsatz: true,
    anzahlAtws: 2,
    gesamtMeterlaenge: 150,
    datumBeginn: "2025-07-01",
    datumEnde: "2025-07-10",
    technik: {
      "2025-07-03": [
        {
          id: "1",
          name: "ATWS",
          anzahl: 1,
          meterlaenge: 100,
          bemerkung: "Test-Eintrag"
        }
      ],
      "2025-07-04": [
        {
          id: "2",
          name: "ATWS",
          anzahl: 1,
          meterlaenge: 50,
          bemerkung: ""
        }
      ]
    },
    mitarbeiterZeiten: {},
    fahrzeuge: {}
  });
  console.log('Testprojekt eingefügt!');
  process.exit();
}

run(); 