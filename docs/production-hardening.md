# maxAI — Produktionsreife: generischer AI-Provider, einfache Installation, De-Branding

> Erklärungsdokument zur Draft-PR [#4 „Production hardening: generic AI provider, simpler install, de-brand"](https://github.com/Malti2/maxAI/pull/4). Es erklärt die Änderungen von Grund auf — überspringe Abschnitte, die du schon kennst.

## Hintergrund

**maxAI** ist eine selbstgehostete Chat-Anwendung. **Max** ist der Name der KI, **maxAI** die Plattform. Der Stack besteht aus:

- **Frontend** (`frontend/`): React + TypeScript + Tailwind, gebaut mit Vite. Login, Onboarding, Chat, Einstellungen, Admin-Bereich.
- **Backend** (`backend/`): Node.js + Express + TypeScript. Spricht mit dem KI-Anbieter, speichert über **Prisma** in PostgreSQL und streamt Antworten per **Server-Sent-Events (SSE)** an den Browser.
- **Infrastruktur**: `docker-compose.yml` orchestrierte bisher **vier** Container (postgres, backend, frontend, ein separater nginx-Reverse-Proxy mit erzwungenem HTTPS/Self-Signed-Zertifikat). `setup.sh` war der geführte Installer.

Die Ausgangslage hatte vier Probleme, die einem produktionsreifen, eigenständigen Produkt im Weg standen:

1. **Ein Build-Fehler.** `frontend/src/components/chat/ChatInput.tsx` nutzte `api.patch(...)`, ohne `api` zu importieren. Der Produktions-Build (`tsc -b && vite build`) brach ab (`TS2304: Cannot find name 'api'`), und die Modell-Synchronisierung beim Senden hätte zur Laufzeit einen `ReferenceError` geworfen.
2. **Feste Bindung an Azure OpenAI.** Anbieter-Endpunkt, Deployment-Namen und API-Version waren Azure-spezifisch — inklusive Azure-Beschriftungen im Admin-Bereich.
3. **Geschützte Namen.** UI, Styles, Doku und Konfiguration enthielten Verweise auf ChatGPT, Apple, iMessage, iOS, SF-Schriften und Azure.
4. **Komplexe Installation.** Zwei nginx-Konfigurationen, ein separater Proxy-Container und erzwungenes HTTPS mit Self-Signed-Zertifikaten (Browser-Warnungen) machten den Erststart unnötig kompliziert.

## Intuition

Die Kernidee: maxAI von einem Azure-gebundenen Klon zu einem **eigenständigen Produkt** machen, das gegen **jeden Chat-Completions-kompatiblen Endpunkt** läuft und sich mit **einem Befehl** auf einem frischen Ubuntu-Server installieren lässt.

- Statt „Azure-Endpoint + Deployment + API-Version" gibt es jetzt pro Modell-Stufe drei einfache Angaben: **Basis-URL**, **Modellname**, **API-Key** (plus einen globalen Default). Das deckt gehostete Anbieter, selbstgehostete Gateways und lokale Modellserver gleichermaßen ab — sie alle sprechen dasselbe Protokoll.
- Statt vier Containern und zwei nginx-Konfigs gibt es **einen** Web-Container, der die App ausliefert **und** `/api` an das Backend weiterreicht. Ein Port, ein Origin, kein erzwungenes Self-Signed-TLS.

**Beispiel:** Ein Nutzer trägt im Admin-Bereich nur `https://api.openai.com/v1`, das Modell `gpt-4o` und einen Key ein — Max Pro läuft. Zeigt er die Basis-URL stattdessen auf einen lokalen Modellserver, ändert sich am Code nichts.

## Codeänderungen

### Generischer AI-Provider (Backend)

- `backend/src/services/azure.ts` → **`ai.ts`**. Der Client wird jetzt generisch erzeugt: `new OpenAI({ apiKey, baseURL })` und `client.chat.completions.create({ model, ... })` — kein Azure-spezifischer `deployment`-Pfad und keine `api-version`-Query mehr.
- `backend/src/services/config.ts` löst die Provider-Konfiguration weiterhin in der Reihenfolge **DB-Einstellung → Umgebungsvariable → Default** auf, nun aber über neutrale Schlüssel (`provider.{tier}.baseURL|apiKey|model`) und `AI_*`-Umgebungsvariablen. Fehlt eine Basis-URL, greift ein sinnvoller Default. API-Keys bleiben **verschlüsselt** gespeichert (`lib/crypto.ts`, AES-256-GCM).
- Admin-API (`routes/admin.ts`) und Admin-UI (`components/admin/AdminPanel.tsx`) zeigen jetzt pro Stufe **Basis-URL / Modell / Key** statt Azure-Feldern; das „Azure API version"-Feld entfällt.

```ts
// services/ai.ts – generischer, Chat-Completions-kompatibler Client
function createClient(mc: ResolvedProviderModel): OpenAI {
  if (!mc.baseURL || !mc.apiKey) {
    throw new Error('The AI provider is not configured. Add your API base URL and key …');
  }
  return new OpenAI({ apiKey: mc.apiKey, baseURL: mc.baseURL.replace(/\/+$/, '') });
}
```

### Build-Fehler behoben

- `ChatInput.tsx` importiert jetzt `api` (`import api from '../../lib/api'`). Damit baut das Frontend wieder, und die Modell-Synchronisierung beim Senden funktioniert.

### De-Branding

- Sämtliche Verweise auf **Azure, ChatGPT, Apple, iMessage, iOS, SF-Schriften** aus UI, Styles, Doku und Konfiguration entfernt.
- Neutraler System-Schriftstack (`'Inter', system-ui, …`), CSS-Variablen `--imsg-*` → `--bubble-*`, neutrale Kommentare/Texte.
- `README.md`, `docs/personalities.md` und `docs/chat-mode.md` neu bzw. sauber geschrieben; das historische `redesign-2.0.md`, das übrig gebliebene `fixes_summary.md` und veraltete Screenshots (einer zeigte das alte „Azure OpenAI"-Admin-Panel) entfernt.

### Einfachere Installation & Infrastruktur

- Der separate Reverse-Proxy-Container entfällt. Der **Web-Container** (`frontend/nginx.conf`) liefert die SPA aus **und** proxied `/api` + `/health` ans Backend — inklusive SSE-Streaming (`proxy_buffering off`, lange Timeouts) und Rate-Limiting.
- `docker-compose.yml`: **postgres + backend + web** auf **einem** öffentlichen Port (Standard `80`), HTTP von Haus aus. TLS wird über einen vorgelagerten Proxy dokumentiert.
- `setup.sh` neu geschrieben: Ubuntu/Debian-freundlich, sudo-fähige Docker-Erkennung, geführte Abfragen, Secrets werden generiert und über Neustarts hinweg erhalten.
- **`prisma` ist jetzt Runtime-Abhängigkeit**, damit `prisma migrate deploy` beim Containerstart zuverlässig ohne Laufzeit-Download läuft.
- `.dockerignore` für Backend und Frontend ergänzt; MIT-`LICENSE` hinzugefügt.

Der vollständige Diff (44 Dateien, +537 / −1247) liegt in der [Draft-PR #4](https://github.com/Malti2/maxAI/pull/4).

## Verifizierung

**Automatisierte Prüfungen (ausgeführt, bestanden):**

- Backend-Build `npm run build` (tsc) — sauber.
- Backend-Tests `npm test` — **319 Zusicherungen bestanden** (chatMode-Parser 279, buildModelHistory 19, units 21).
- Frontend-Lint `npm run lint` (oxlint) — 0 Warnungen, 0 Fehler.
- Frontend-Build `npm run build` (tsc + vite) — sauber.

**Laufzeit-Prüfungen (ohne Docker durchführbar):**

- Der **echte** kompilierte `ai.ts` wurde gegen einen lokalen, OpenAI-kompatiblen Mock-Server gefahren: Streaming, Auto-Modell-Routing (kurze Eingabe → Lite), Token-Zählung, Konnektivitätstest und der „nicht konfiguriert"-Fehlerpfad — alle korrekt.
- Das Backend startet; `/health`, 404-Handler, Sicherheits-Header, CORS-Preflight, Auth-Guard (401), ungültiger JSON-Body (400) und die Produktions-Env-Validierung (kurzer `JWT_SECRET` bricht sauber ab) verhalten sich korrekt.

**Bekannte Einschränkung:** Ein vollständiger Container- und Browser-End-to-End-Test war **in der Build-Sandbox** nicht möglich, weil deren Egress-Allowlist die Docker-Image-CDN, den Prisma-Engine-Host und Browser-Downloads mit HTTP 403 blockiert. Auf einem normalen Ubuntu-Host (dem Zielsystem) funktioniert all das.

**So prüfst du manuell (auf einem Ubuntu-Host):**

1. `git clone … && cd maxAI && bash setup.sh` — Docker wird bei Bedarf installiert, Secrets erzeugt, Abfragen durchlaufen, Stack gebaut und gestartet.
2. Gedruckte URL öffnen, mit dem Admin-Konto anmelden, Onboarding durchlaufen.
3. **Einstellungen → Admin**: Basis-URL, Modell und Key setzen, „Test connections" ausführen.
4. Eine Nachricht senden → Antwort streamt live; **Auto**, Regenerate, Edit, Chat Mode (Tapbacks/Replies) prüfen.

## Alternativen

**Wie der KI-Anbieter angebunden wird**

| Generischer Chat-Completions-Client (gewählt) | Azure-spezifisch beibehalten |
|---|---|
| Eigenständig, keine geschützten Namen in der UI | Verweist auf Microsoft-/Azure-Marke |
| Läuft gegen jeden kompatiblen Endpunkt (gehostet, selbstgehostet, lokal) | An einen Anbieter gebunden |
| Einfachere Konfiguration (URL/Modell/Key) | Zusätzliche Deployment-/API-Version-Konzepte |

**HTTPS beim Erststart**

| HTTP auf einem Port, TLS über vorgelagerten Proxy (gewählt) | Erzwungenes Self-Signed-TLS im Stack |
|---|---|
| „Läuft sofort", keine Browser-Warnungen | Zertifikat-Handling + Warnungen beim Erststart |
| Standard-Muster für produktive Deployments (Proxy/Caddy davor) | Doppelte nginx-Konfiguration, mehr bewegliche Teile |

## Relevante Gesprächspartner

- **Malte Höpers (@Malti2)** — hat maxAI vollständig geschrieben (Initial-Implementierung, Redesign, Installer/Admin, Chat Mode, Persönlichkeiten). Die berührten Kernbereiche (`services/`, `routes/`, Admin-UI, `setup.sh`, `docker-compose.yml`) stammen von ihm bzw. aus früheren Agenten-Läufen; er ist die einzige verlässliche Anlaufstelle für Prompt-Fluss, Provider-Anbindung und Deploy-Design.
