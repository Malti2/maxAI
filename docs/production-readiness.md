# maxAI — Produktionsreife: Bugfixes & Härtung

> Erklärungsdokument zur Draft-PR. Es beschreibt drei behobene Probleme und
> die ergänzte Absicherung von Grund auf. Abschnitte, die du schon kennst,
> kannst du überspringen.

## Hintergrund

**maxAI** ist eine selbstgehostete Chat-Anwendung. **Max** ist die KI, **maxAI**
die Plattform. Der Stack:

- **Frontend** (`frontend/`): React + TypeScript + Vite, Zustand für State,
  axios für normale API-Aufrufe.
- **Backend** (`backend/`): Node.js + Express + TypeScript, Prisma/PostgreSQL,
  Antworten werden per **Server-Sent-Events (SSE)** gestreamt.
- **Auth**: kurzlebiges Access-Token (Default **15 min**) plus rotierendes
  Refresh-Token. `frontend/src/lib/api.ts` erneuert abgelaufene Access-Tokens
  automatisch über einen axios-Interceptor.

Beim Durchgehen des Codes fielen drei Dinge auf, die einem produktionsreifen
Release im Weg standen — zwei davon habe ich vor dem Fix mit einem Test
**reproduziert**, um sicherzugehen, dass es echte Bugs sind (ein dritter
vermuteter Bug erwies sich im Test als unbegründet und wurde bewusst *nicht*
angefasst).

## Intuition

Zwei der Bugs treten im ganz normalen Betrieb auf:

1. **Senden nach 15 Minuten Leerlauf schlägt fehl.** Das Streaming nutzt rohes
   `fetch`, weil ein `EventSource` keinen `Authorization`-Header setzen kann.
   Damit lief der Sendepfad aber **am Auto-Refresh vorbei**: War das
   Access-Token abgelaufen, antwortete das Backend mit `401`, und die UI zeigte
   nur „Max could not respond" — ohne Erneuerung, ohne Wiederholung.

2. **Chat-Mode-Warteschlange wurde nie zugestellt.** Im Chat Mode darf man
   weitertippen, während Max noch antwortet. Diese Nachrichten wurden als
   „pending" angezeigt und gepuffert — aber erst beim **nächsten manuellen
   Senden** verschickt (und dann in falscher Reihenfolge). Die dokumentierte
   Zusage „delivered together and Max replies to all of them at once" wurde
   also nie eingelöst.

Dazu eine Härtung: Eine öffentlich erreichbare Instanz konnte **offene
Registrierung nicht abschalten** — jede*r mit der URL konnte ein Konto anlegen
und auf Kosten des Betreibers dessen API-Budget verbrauchen.

## Codeänderungen

### 1. Token-Erneuerung auf dem Streaming-Pfad (`api.ts`, `useChat.ts`)

Der Interceptor-Refresh wurde in eine **Single-Flight-Funktion** ausgelagert,
die sich der SSE-Pfad teilt. Mehrere gleichzeitige `401` lösen so höchstens
**einen** Refresh aus.

```ts
// api.ts – von Interceptor UND fetch-Pfad genutzt
export function refreshAccessToken(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = (async () => { /* … /auth/refresh, setTokens|logout … */ })()
      .finally(() => { refreshPromise = null; });
  }
  return refreshPromise;
}
```

```ts
// useChat.ts – liest das aktuelle Token frisch und wiederholt einmal bei 401
const token = useAuthStore.getState().accessToken;
const response = await send(token);
if (response.status !== 401) return response;
const fresh = await refreshAccessToken();
return fresh ? send(fresh) : response;
```

Nebeneffekt: Das Token wird jetzt aus dem Store gelesen (`getState()`) statt aus
einer veralteten Render-Closure.

### 2. Automatische Zustellung der Chat-Mode-Warteschlange (`useChat.ts`, `ChatPage.tsx`)

Neu ist `flushQueue()`: Wenn eine Antwort fertig ist, wird der gesamte Puffer
als **eine** Folge-Runde gesendet — die erste Nachricht als `content`, der Rest
als `pendingMessages` — genau das Format, das das Backend erwartet. Der Auslöser
sitzt in `ChatPage`:

```tsx
useEffect(() => {
  if (chatModeEnabled && !isStreaming && pendingQueue.length > 0) {
    void flushQueue();
  }
}, [chatModeEnabled, isStreaming, pendingQueue, flushQueue]);
```

`flushQueue` liest die Queue über `getState()` und leert sie sofort, ist damit
robust gegen doppelte Effect-Aufrufe (React StrictMode).

### 3. Abschaltbare Registrierung (`env.ts`, `auth.ts`, `AuthPage.tsx`)

`ALLOW_REGISTRATION` (Default `true`, also **nicht brechend**). Ist es `false`,
antwortet `POST /auth/register` mit `403`; der neue öffentliche Endpoint
`GET /auth/config` teilt dem Login-Screen mit, den Sign-up-Tab auszublenden.

### 4. `uuid` → `crypto.randomUUID()` (`auth.ts`)

Die einzige Verwendung (Refresh-Token) läuft nun über Nodes eingebaute Funktion.
Eine Abhängigkeit weniger und `npm audit` ist sauber (0 Findings).

### 5. Tests & CI

Neue jsdom-basierte **vitest**-Suite (`frontend/src/test/`) und eine
**GitHub-Actions**-Pipeline (`.github/workflows/ci.yml`), die Backend und
Frontend bei jedem Push/PR baut, testet und lintet.

## Verifizierung

Alle Prüfungen laufen lokal grün:

| Prüfung | Ergebnis |
|---|---|
| Backend `tsc` Build | ✓ |
| Backend Tests (`chatMode`, `buildModelHistory`, `units`) | 319 Assertions, 0 Fehler |
| Backend `npm audit` | 0 Findings |
| Frontend `oxlint` | 0 Warnungen, 0 Fehler |
| Frontend `vitest` | 6 Dateien, 12 Tests grün |
| Frontend `tsc -b && vite build` | ✓ |
| Frontend `npm audit` | 0 Findings |

**Reproduktion der Bugs vor dem Fix:** Für Bug 1 zeigte ein Test, dass ein
abgelaufenes Token zu „Something went wrong" ohne Wiederherstellung führte; für
Bug 2, dass die Queue nie zugestellt wurde. Nach dem Fix belegen dieselben Tests
das korrekte Verhalten (Refresh + Retry bzw. automatische Zustellung).

**Widerlegte Vermutung:** Zunächst schien der Wechsel zwischen Konversationen in
der Sidebar keine Nachrichten zu laden (vermuteter Effect-Guard-Bug). Ein
Integrationstest bewies das Gegenteil — dank Zustands `useSyncExternalStore`
greift die Logik korrekt. Der Code wurde deshalb **nicht** verändert; der Test
bleibt als Regressionsschutz erhalten.

**Bekannte Einschränkung:** Ein vollständiger End-to-End-Lauf (echter Browser +
Postgres + KI-Anbieter) war in der Build-Umgebung nicht möglich (Prisma-Engine-
Download und Browser-Installation waren dort gesperrt). Die Fixes wurden
stattdessen mit gezielten jsdom-Integrationstests abgesichert, die die realen
Komponenten, Stores und Hooks gegen einen gemockten Netzwerk-/SSE-Layer prüfen.

### Manuell nachprüfen

- **Token-Refresh:** einloggen, Tab > 15 min offen lassen (oder `ACCESS_TOKEN_TTL`
  auf `10s` setzen), dann eine Nachricht senden → Max antwortet, statt zu
  scheitern.
- **Chat Mode:** in den Einstellungen aktivieren; während Max antwortet, zwei
  weitere Nachrichten senden → nach der ersten Antwort werden beide gemeinsam
  und in Reihenfolge zugestellt und beantwortet.
- **Registrierung:** `ALLOW_REGISTRATION=false` setzen und neu starten → der
  Sign-up-Tab verschwindet; `POST /auth/register` liefert `403`.

## Alternativen

| Ansatz | Bewertung |
|---|---|
| SSE-Auth: Token proaktiv vor jedem Senden erneuern | Zusätzlicher Netz-Roundtrip pro Nachricht; die 401-getriebene Wiederholung ist sparsamer und deckt denselben Fall ab. |
| Chat-Queue: erst beim nächsten manuellen Senden mitschicken (Status quo) | Widerspricht der dokumentierten Zusage, stellt Nachrichten verspätet und in falscher Reihenfolge zu. |
| Registrierung standardmäßig deaktivieren | Sicherer, aber brechend für bestehende Setups; Default `true` + Opt-out ist der risikoärmere Weg. |

## Relevante Gesprächspartner

Die betroffenen Bereiche (`useChat.ts`, `api.ts`, `auth.ts`) stammen im
Wesentlichen vom Maintainer **Malte** — er kann die beabsichtigte Chat-Mode-
Semantik und die gewünschte Registrierungs-Policy am besten einordnen.
