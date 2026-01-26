# MH-ZEITERFASSUNG – Setup & Betrieb

## Voraussetzungen
- Node.js 18+
- **pnpm** (Projekt-Package-Manager) – z. B. `npm install -g pnpm`
- MongoDB (Atlas oder lokal) – Datenbankname: `MHZeiterfassung`
- SMTP Zugang (für Benachrichtigungen/Einladungen)

## .env.local konfigurieren

**Ohne `MONGODB_URI` startet die App, aber `/api/auth/*` wirft 500** („Bitte MONGODB_URI in .env.local setzen“).

**Das Projekt nutzt `.env.production` für alle Environments.** Ein Symlink `.env.local` → `.env.production` ist vorhanden, sodass Next.js in Dev-Mode automatisch die Config lädt.

Alle Variablen sind in `.env.production` definiert. Bei Bedarf dort anpassen.

## Development starten

**Das Projekt nutzt pnpm** (`packageManager` in `package.json`). Bitte **pnpm** verwenden, nicht npm – sonst entstehen Lockfile-Konflikte und Fehler wie „Next.js package not found“.

```
# 1) Dependencies (Projektwurzel)
pnpm install

# 2) Next.js App
pnpm dev

# 3) WebSocket-Server in separatem Terminal
cd server
pnpm install
pnpm dev
```

Falls „Next.js package not found“ (Turbopack) auftritt: `node_modules` war unvollständig (nur `.pnpm/`, keine Root-Symlinks). Mit `node-linker=hoisted` (`.npmrc`) wird eine flache `node_modules` erzeugt. Dann:

```bash
rm -rf node_modules .next
pnpm install
pnpm dev
```

Falls Turbopack weiterhin Probleme macht: `pnpm run dev:webpack` (Webpack statt Turbopack).

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

