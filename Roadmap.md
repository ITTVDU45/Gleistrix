// Roadmap zur Erstellung eines React-Dashboards für Zeiterfassung

// 1. Projektstruktur
- /src
  - /components
    - Sidebar.jsx
    - ProjectTable.jsx
    - ProjectDetail.jsx
    - EmployeeTable.jsx
    - TabsPerDay.jsx
    - TimeEntryTable.jsx
  - /pages
    - Dashboard.jsx
    - Projects.jsx
    - ProjectDetail.jsx
    - Employees.jsx
    - EmployeeDetail.jsx
  - /api (Mock- oder echte API-Logik)
  - /utils
  - App.jsx
  - main.jsx (Vite) / index.js (CRA)

// 2. Seitenleiste
- Sidebar mit Menüpunkten:
  - Übersicht
  - Projekte
  - Mitarbeiter
  => Routing via React Router (v6)

// 3. Projekte ("/projects")
### Funktionen:
- Neues Projekt anlegen (Modal oder eigene Seite)
- Tabelle mit Projekten (siehe unten)
- Detailansicht über Button ("Ansehen")
- Projekt löschen ("Löschen" Button)

### Tabelle-Spalten:
- Auftraggeber
- Baustelle
- Auftragsnummer
- SAP Nummer
- Status
- Projekttage (berechnet)
- Datum Beginn
- Datum Ende
- Aktionen (Einsicht / Löschen / Bearbeiten)

// 4. Projekt-Detailseite ("/projects/:id")
### Kachel 1: Projektübersicht
- Auftraggeber
- Baustelle
- Auftragsnummer
- SAP Nummer
- Telefonnummer
- Status
- ATWs im Einsatz?
- Anzahl ATWs

### Kachel 2: Zeiten / Mitarbeiter
- Tab-Switch für jeden Projekttag: Tag1, Tag2, Tag3 etc.
- Tabelle mit:
  - Uhrzeit Start
  - Uhrzeit Ende
  - Name
  - Funktion
  - Stunden (berechnet)
  - Extra
  - Fahrtstunden
  - Material / Bemerkungen (freies Eingabefeld)

// 5. Mitarbeiterseite ("/employees")
### Funktionen:
- Mitarbeiter anlegen (Formular / Modal)
- Liste der Mitarbeiter (mit Namen & Funktion)
- Verlinkung zur Detailansicht

// 6. Mitarbeiterdetailseite ("/employees/:id")
### Inhalte:
- Monatsansicht der gearbeiteten Stunden
- Liste der Projekte, auf denen gearbeitet wurde
- Position pro Projekt

// 7. Zustand / State-Management
- Kontext oder Redux (optional)
- Alternativ: lokale States + Lifting

// 8. Datenstruktur (vereinfachtes Beispiel)
```js
Projekt = {
  id, auftraggeber, baustelle, auftragsnummer, sapNummer,
  telefonnummer, status, atwsImEinsatz, anzahlAtws,
  datumBeginn, datumEnde,
  mitarbeiterZeiten: {
    'Tag1': [ { start, ende, name, funktion, extra, stunden, fahrtstunden, bemerkung } ],
    'Tag2': [...]
  }
}

Mitarbeiter = {
  id, name, funktion, einsaetze: [
    { projektId, datum, stunden }
  ]
}
```

// 9. Technologien
- React
- React Router
- Tailwind CSS oder Material UI
- Zustand / Redux optional
- Formulare mit React Hook Form
- evtl. Backend mit Node/Express + MongoDB/Supabase/JSON-Server

// 10. Erweiterbar (für später)
- Nachtzulagen
- Automatisierte Stundenberechnung
- Gleitzeitmodelle
- PDF-Export
- Auslastungsvisualisierung (Diagramm / Balken)

// 11. Deployment
- Vite / CRA
- Deployment z.B. über Vercel, Netlify, Docker

// Ende der ersten Iteration
