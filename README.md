# MH-ZEITERFASSUNG – Setup & Betrieb

## Voraussetzungen
- Node.js 18+
- MongoDB (Atlas oder lokal) – Datenbankname: `MHZeiterfassung`
- SMTP Zugang (für Benachrichtigungen/Einladungen)

## .env.local konfigurieren
Erstelle `.env.local` im Projektwurzelverzeichnis und trage Folgendes ein:

```
# NextAuth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=generate_a_strong_secret

# MongoDB
MONGODB_URI=mongodb+srv://USER:PASS@HOST/dbname

# WebSocket (Client)
NEXT_PUBLIC_WS_URL=ws://localhost:3001

# E-Mail (SMTP)
EMAIL_SERVER=smtp.example.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=no-reply@example.com
EMAIL_PASS=app_password_or_secret
EMAIL_FROM=Mülheimer Wachdienst
EMAIL_REPLY_TO=info@example.com
```

## Development starten
```
# 1) Dependencies
npm install

# 2) Next.js App
npm run dev

# 3) WebSocket-Server in separatem Terminal
cd server
npm install
npm run dev
```

## WebSocket-Server
- Läuft standardmäßig auf Port `3001`.
- Port ändern: Umgebungsvariable `WS_PORT` im Ordner `server/` setzen und `NEXT_PUBLIC_WS_URL` im Frontend anpassen.

## Benachrichtigungseinstellungen
- Einstellungen → Profil → „Benachrichtigungen“: Schalter aktivieren/deaktivieren, Empfänger-E-Mail pro Regel konfigurierbar.
- Standard‑Regel: E-Mail bei Status „geleistet“ (inkl. PDF) an Buchhaltung.

## Wichtige Hinweise
- Authentifizierung: Einheitlich NextAuth (JWT). API-Routen verwenden `getToken()`.
- PDFs: Für Status „geleistet“ wird eine kurze Projektdetail‑PDF serverseitig erzeugt und per Mail versendet.
- Produktion: Logging reduzieren und SMTP-Einstellungen validieren.


## API Sicherheit (Sofortmaßnahmen)

- Globale Security-Header via `next.config.js` (CSP, X-Frame-Options, etc.)
- Einfache Rate-Limitierung in `middleware.ts` (pro IP, nur mutierende /api-Methoden)
- CSRF-Intent-Header für mutierende API-Calls (in DEV optional, in PROD Pflicht)
- Rollenprüfungen vereinheitlicht (`lib/security/requireAuth.ts`)

### CSRF-Intent Header verwenden

Beispiel:

```ts
await fetch('/api/employees', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-csrf-intent': 'employees:create'
  },
  body: JSON.stringify({ name: 'Max Mustermann', status: 'aktiv' })
})
```

Für weitere Endpunkte:
- Zeiten: `project-times:create|update|delete`
- Technik: `project-technik:create|update|delete`
- Fahrzeuge (zu Projekt): `project-vehicle:assign|update|unassign`
- Fahrzeuge (Stammdaten): `vehicles:create|update|delete`
- Mitarbeiter: `employees:create|update|delete`
- Benutzerrolle: `users:update-role`

