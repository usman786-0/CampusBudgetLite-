# CampusBudget

Budget- und Finanzplanung für Studierende in Deutschland: Einnahmen und Ausgaben im Blick behalten, Budgets mit Warnungen, wiederkehrende Zahlungen, Sparziele, faires Teilen von WG-Kosten sowie Berichte als CSV/PDF – auf Deutsch und Englisch, DSGVO-konform und barrierearm.

**Stack:** Next.js 15 (App Router) · TypeScript (strict) · Tailwind CSS 4 + shadcn/ui · PostgreSQL + Prisma 6 · Auth.js v5 · Zod + React Hook Form · Recharts · Resend + React Email · next-intl · Vitest · Playwright · Docker

---

## Inhalt

1. [Schnellstart (lokal)](#schnellstart-lokal)
2. [Start mit Docker](#start-mit-docker)
3. [Demo-Zugangsdaten](#demo-zugangsdaten)
4. [Umgebungsvariablen](#umgebungsvariablen)
5. [Skripte](#skripte)
6. [Deployment (Vercel)](#deployment-vercel)
7. [Architektur](#architektur)
8. [Sicherheit, DSGVO und Barrierefreiheit](#sicherheit-dsgvo-und-barrierefreiheit)
9. [Tests und CI](#tests-und-ci)
10. [Vor dem Livegang](#vor-dem-livegang)

---

## Schnellstart (lokal)

**Voraussetzungen:** Node.js 24 (inkl. npm 11) und eine PostgreSQL-Datenbank (z. B. per Docker).

```bash
# 1. Abhängigkeiten installieren
npm install

# 2. Umgebungsvariablen anlegen und Secrets eintragen
cp .env.example .env
#   AUTH_SECRET, ENCRYPTION_KEY:  openssl rand -base64 32
#   CRON_SECRET:                  openssl rand -hex 24

# 3. Datenbank starten (Docker Desktop muss laufen), migrieren und Demo-Daten laden
npm run db:up
npm run db:deploy
npm run db:seed

# 4. Entwicklungsserver starten – startet die Datenbank bei Bedarf automatisch mit
npm run dev
```

Die App läuft dann unter <http://localhost:3000>. `npm run dev` führt vorher `scripts/ensure-db.mjs` aus: Zeigt `DATABASE_URL` auf `localhost`, wird der Postgres-Container aus `docker-compose.yml` gestartet (nur über `127.0.0.1:5432` erreichbar). Bei einer externen Datenbank passiert nichts.

### E-Mails (Bestätigung, Passwort-Reset, Benachrichtigungen)

Der Versanddienst wird in dieser Reihenfolge gewählt: `RESEND_API_KEY` → `SMTP_HOST` → Ausgabe in der Server-Konsole.

| Ziel | Einstellungen in `.env` |
| ---- | ----------------------- |
| **Lokales Test-Postfach (Mailpit)** – alle Mails landen unter <http://localhost:8025>, Mailpit startet automatisch mit `npm run dev` | `SMTP_HOST="127.0.0.1"`, `SMTP_PORT="1025"` |
| **Echte Zustellung über Gmail** | `SMTP_HOST="smtp.gmail.com"`, `SMTP_PORT="465"`, `SMTP_USER="du@gmail.com"`, `SMTP_PASSWORD="<App-Passwort>"`, `EMAIL_FROM="CampusBudget <du@gmail.com>"` |
| **Echte Zustellung über Resend** (empfohlen für Produktion, eigene Domain nötig) | `RESEND_API_KEY="re_…"`, `EMAIL_FROM="CampusBudget <noreply@deine-domain.de>"` |

**Gmail-App-Passwort erstellen:** Google-Konto → Sicherheit → Bestätigung in zwei Schritten aktivieren → <https://myaccount.google.com/apppasswords> → App-Passwort erzeugen (16 Zeichen, ohne Leerzeichen eintragen). Danach den Dev-Server neu starten.

Ist gar kein Dienst eingerichtet, erscheint nach der Registrierung im Entwicklungsmodus ein Button „E-Mail-Adresse jetzt bestätigen“ (in Produktion nie). Schlägt der Versand fehl, bleibt das Konto bestehen, und die Seite bietet „E-Mail erneut senden“ an.

> **Projekt im OneDrive-Ordner?** OneDrive wandelt Dateien in `.next` teilweise in Cloud-Platzhalter um. Next.js bricht dann mit `EINVAL: invalid argument, readlink …` ab. Abhilfe: den Ordner `.next` löschen (wird neu erzeugt) – dauerhaft besser ist ein Projektordner außerhalb von OneDrive (z. B. `C:\dev\CampusBudgetLite`).

> **Hinweis zu npm ≥ 11:** npm blockiert Install-Skripte, solange sie nicht freigegeben sind. Die nötigen Freigaben (Prisma, esbuild) stehen bereits unter `allowScripts` in der `package.json`.

> **E-Mails in der Entwicklung:** Ohne `RESEND_API_KEY` werden alle E-Mails (Bestätigung, Passwort-Reset, Benachrichtigungen) inklusive Links in der Server-Konsole ausgegeben.

## Start mit Docker

```bash
cp .env.example .env      # AUTH_SECRET und CRON_SECRET setzen (Pflicht)
docker compose up -d --build
```

| Service   | Aufgabe                                                                 |
| --------- | ----------------------------------------------------------------------- |
| `db`      | PostgreSQL 17 mit persistentem Volume `pgdata`                           |
| `migrate` | Einmaliger Job: `prisma migrate deploy`, bei `SEED_DEMO=true` auch Seed |
| `app`     | Next.js-Standalone-Server (Port `APP_PORT`, Standard 3000), Healthcheck |
| `cron`    | Ruft täglich `/api/cron/daily` auf (`CRON_SCHEDULE`, Standard 05:00)    |

Belege und Profilbilder liegen im Volume `uploads`. Für einen anderen Port oder eine öffentliche URL: `APP_PORT=8080 APP_URL=https://budget.example.com docker compose up -d --build`.

## Demo-Zugangsdaten

Nach `npm run db:seed` (bzw. Docker mit `SEED_DEMO=true`):

| Rolle                    | E-Mail                 | Passwort         |
| ------------------------ | ---------------------- | ---------------- |
| Demo-User                | `demo@campusbudget.de` | `CampusDemo2026` |
| Mitbewohnerin (WG-Demo)  | `mia@campusbudget.de`  | `CampusDemo2026` |
| Mitbewohner (WG-Demo)    | `tom@campusbudget.de`  | `CampusDemo2026` |

Der Demo-User hat realistische Daten der letzten 3 Monate: rund 100 Transaktionen, Fixkosten (Miete, BAföG, Deutschlandticket, Semesterbeitrag …), Budgets, drei Sparziele, die WG-Gruppe „WG Bergstraße“ und Benachrichtigungen. Der Seed ist wiederholbar und ersetzt nur die Demo-Konten.

## Umgebungsvariablen

| Variable                        | Pflicht | Beschreibung                                                                                   |
| ------------------------------- | :-----: | ---------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                  |   ✅    | PostgreSQL-Verbindungs-URL                                                                     |
| `APP_URL`                       |   ✅    | Öffentliche Basis-URL ohne `/` am Ende. Bei `https://` werden Secure-Cookies und `upgrade-insecure-requests` aktiv |
| `AUTH_SECRET`                   |   ✅    | Mind. 16 Zeichen, z. B. `openssl rand -base64 32`. Signiert Auth.js und pseudonymisiert IPs    |
| `AUTH_URL`                      |         | Für Auth.js, in der Regel identisch mit `APP_URL`                                               |
| `AUTH_TRUST_HOST`               |         | `true` hinter einem Reverse Proxy                                                              |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` |  | Google-OAuth. Der Button erscheint nur, wenn beide gesetzt sind. Redirect-URI: `<APP_URL>/api/auth/callback/google` |
| `ENCRYPTION_KEY`                | Prod ✅ | 32 Byte (Base64) für die AES-256-GCM-Verschlüsselung der 2FA-Secrets                           |
| `RESEND_API_KEY`                | Prod ✅ | API-Key von [Resend](https://resend.com). Alternativ SMTP (siehe unten), sonst Ausgabe in der Konsole |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_SECURE` | | SMTP-Versand, z. B. Gmail (`smtp.gmail.com`, Port 465) oder Mailpit (`127.0.0.1`, Port 1025). Siehe Abschnitt „E-Mails“ |
| `EMAIL_FROM`                    |         | Absender, z. B. `CampusBudget <noreply@deine-domain.de>` (Domain bei Resend verifizieren)       |
| `CRON_SECRET`                   |   ✅    | Bearer-Token für `/api/cron/daily`                                                             |
| `STORAGE_DRIVER`                |         | `local` (Standard, Dateisystem) oder `s3`                                                      |
| `UPLOAD_DIR`                    |         | Upload-Verzeichnis bei `local` (Standard `./uploads`)                                          |
| `S3_BUCKET`, `S3_REGION`, `S3_ENDPOINT`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | bei `s3` | S3-kompatibler Speicher (AWS S3, Cloudflare R2, MinIO …) |
| `NEXT_PUBLIC_PLAUSIBLE_DOMAIN`, `NEXT_PUBLIC_PLAUSIBLE_HOST` | | Optionale Analyse, wird **nur nach Einwilligung** im Cookie-Banner geladen |

Nur für `docker compose`: `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `APP_PORT`, `SEED_DEMO`, `CRON_SCHEDULE`.

## Skripte

| Befehl                           | Zweck                                         |
| -------------------------------- | --------------------------------------------- |
| `npm run dev`                    | Entwicklungsserver                            |
| `npm run build` / `npm start`    | Produktions-Build / -Server                   |
| `npm run lint`                   | ESLint                                        |
| `npm run typecheck`              | TypeScript-Prüfung                            |
| `npm run format` / `format:check` | Prettier                                     |
| `npm test`                       | Unit-Tests (Vitest)                           |
| `npm run test:e2e`               | E2E-Tests (Playwright, Desktop + Pixel 7)     |
| `npm run db:migrate`             | Neue Migration in der Entwicklung erstellen   |
| `npm run db:deploy`              | Migrationen anwenden                          |
| `npm run db:seed`                | Demo-Daten laden                              |
| `npm run db:studio`              | Prisma Studio                                 |

## Deployment (Vercel)

1. **Datenbank:** eine verwaltete PostgreSQL-Instanz anlegen (z. B. Neon, Supabase, Vercel Postgres) – idealerweise in der EU (Frankfurt).
2. **Projekt importieren:** Repository in Vercel importieren, Framework „Next.js“ wird erkannt.
3. **Umgebungsvariablen** wie oben setzen, mindestens `DATABASE_URL`, `APP_URL`, `AUTH_SECRET`, `ENCRYPTION_KEY`, `RESEND_API_KEY`, `EMAIL_FROM` und `CRON_SECRET`.
4. **Datei-Uploads:** Das Dateisystem von Vercel ist nicht persistent. Deshalb `STORAGE_DRIVER=s3` mit einem S3-kompatiblen Bucket verwenden.
5. **Migrationen:** Build Command auf `npx prisma migrate deploy && npm run build` setzen (oder Migrationen in der CI ausführen).
6. **Cron:** `vercel.json` registriert `/api/cron/daily` täglich um 05:00 UTC. Vercel sendet automatisch `Authorization: Bearer <CRON_SECRET>`.
7. **Domain** verbinden. Da `APP_URL` mit `https://` beginnt, werden Secure-Cookies und HSTS aktiv.

Andere Hosts (z. B. Hetzner oder eine eigene VM) lassen sich mit `docker compose` und einem Reverse Proxy mit TLS (Caddy, Traefik, nginx) betreiben.

## Architektur

```
src/
├─ app/[locale]/          Seiten: (marketing), (auth), (app) + 404/500
├─ app/api/               Auth.js, Cron, Belege, Avatare, Exporte, Health
├─ domain/                Reine Geschäftslogik (Geld, Datum, Budget, Split, WG-Ausgleich, Wiederholung) – vollständig unit-getestet
├─ features/<feature>/    schemas.ts (Zod) · queries.ts · actions.ts (Server Actions) · service.ts · components/
├─ components/            ui/ (shadcn), layout/, charts/, shared/, marketing/
├─ lib/                   db, env, crypto, password, totp, rate-limit, storage, uploads, audit, mail, auth/session
├─ i18n/ · emails/        next-intl-Konfiguration · React-Email-Vorlage
messages/                 de.json / en.json
prisma/                   schema.prisma, migrations/, seed.ts
e2e/ · tests/unit/        Playwright · Vitest
```

**Wichtige Entscheidungen**

- **Beträge** werden als Integer in Cent gespeichert. CHECK-Constraints in der Migration garantieren positive Beträge.
- **Mandantentrennung:** Jede Query filtert nach `userId` bzw. nach aktiver Gruppenmitgliedschaft. Server Actions prüfen Eigentum vor jeder Änderung.
- **Sitzungen** liegen serverseitig in der Tabelle `Session`, sind widerrufbar und in den Einstellungen einsehbar. E-Mail/Passwort-Login und Google-OAuth (Auth.js) teilen sich dasselbe Session-Cookie. „Angemeldet bleiben“ = 30 Tage, sonst Browser-Sitzung.
- **Prisma ohne native Engine** (`engineType = "client"` + `@prisma/adapter-pg`): läuft auf Windows on ARM, in schlanken Images und auf Vercel.
- **Rate-Limiting** über eine Postgres-Tabelle (atomares `INSERT … ON CONFLICT`), ohne Redis. Die IP-Limits sind bewusst großzügig (Hochschul-NAT), die Konto-Limits streng.
- **Cron** bucht fällige Zahlungen idempotent (optimistische Sperre auf `nextDueDate`), versendet Erinnerungen und löscht abgelaufene Daten.
- **WG-Ausgleich:** Salden pro Mitglied, reduziert auf die minimale Zahl von Überweisungen. Restcents werden deterministisch verteilt.

## Sicherheit, DSGVO und Barrierefreiheit

- **Auth:** Argon2id (OWASP-Parameter), E-Mail-Verifizierung (Token 24 h, nur als SHA-256-Hash gespeichert), Passwort-Reset (1 h, einmalig, meldet alle Sitzungen ab), TOTP-2FA mit Backup-Codes, Schutz vor User-Enumeration (identische Antworten, Timing-Ausgleich).
- **OWASP:** serverseitige Zod-Validierung jeder Eingabe, CSRF-Schutz durch Origin-Prüfung der Server Actions und SameSite-Cookies, Header (CSP, HSTS, X-Frame-Options, nosniff, Referrer-, Permissions-Policy), Schutz vor Open Redirects, CSV-Injection-Schutz im Export.
- **Uploads:** Typprüfung per Magic Bytes (JPG/PNG/WebP/PDF), Größenlimit, zufällige Dateinamen, Auslieferung nur an Berechtigte mit `Content-Security-Policy: sandbox`.
- **DSGVO:** echtes Opt-in-Cookie-Banner (Ablehnen so einfach wie Zustimmen), JSON-Datenexport, vollständige Kontolöschung (inkl. Dateien; in WG-Gruppen anonymisiert), pseudonymisierte IPs im Audit-Log, automatische Löschfristen. Vorlagen für Impressum, Datenschutzerklärung und AGB sind enthalten.
- **Barrierefreiheit (WCAG 2.2 AA):** Skip-Link, sichtbare Fokus-Stile, semantische Landmarks, ARIA-Labels, Tabellen-Alternativen zu Diagrammen, „Bewegung reduzieren“ wird respektiert, der Cookie-Banner verdeckt keine fokussierten Elemente (2.4.11), Kontraste über OKLCH-Tokens in Hell und Dunkel.

## Tests und CI

```bash
npm test                                  # 53 Unit-Tests der Geschäftslogik
npx playwright install chromium           # einmalig
npm run test:e2e                          # startet bei Bedarf den Dev-Server selbst
E2E_BASE_URL=http://localhost:3000 npm run test:e2e   # gegen einen laufenden Server
```

Die E2E-Tests decken Registrierung, Login (inkl. Fehlerfall und Logout), Routenschutz, das Anlegen und Löschen einer Transaktion sowie den Cookie-Banner ab – jeweils auf Desktop und Handy (Pixel 7). Sie setzen den Demo-Seed voraus.

**GitHub Actions** (`.github/workflows/ci.yml`): Prettier, ESLint, Typecheck und Unit-Tests → Build und E2E gegen einen Postgres-Service → Docker-Image-Build.

## Vor dem Livegang

- [ ] Platzhalter in Impressum, Datenschutzerklärung und AGB (`messages/*.json` → `legal`) ersetzen und rechtlich prüfen lassen
- [ ] Beispiel-Testimonials auf der Landingpage durch echte Stimmen ersetzen
- [ ] Absender-Domain bei Resend verifizieren
- [ ] Eigene Secrets erzeugen (`AUTH_SECRET`, `ENCRYPTION_KEY`, `CRON_SECRET`), Demo-Seed in Produktion deaktivieren (`SEED_DEMO=false`)
- [ ] Lighthouse-Audit auf der echten Domain durchführen (Ziel ≥ 90 in allen Kategorien)
- [ ] Backups der Datenbank einrichten
