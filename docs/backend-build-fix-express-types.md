# Backend-Build-Fehler: `req.params` als `string | string[]`

> Erklärungsdokument zur Draft-PR. Es erklärt die Änderung von Grund auf —
> überspring Abschnitte, die du schon kennst.

**Kurzfassung:** Das Backend läuft auf **Express 4**, die Typen waren aber auf
**`@types/express` ^5.0.0** gepinnt. In den 5.x-Typen ist `req.params` als
`Record<string, string | string[]>` deklariert. Dadurch war `req.params.id`
plötzlich `string | string[]` und passte nicht mehr in die Prisma-`where`-Filter.
Der Fix ist eine Zeile: `@types/express` auf `^4.17.21` pinnen — damit
verschwinden alle 15 Build-Fehler, ohne eine einzige Änderung am
Anwendungscode.

## Hintergrund

### Für Einsteiger/-innen: woher kommen die Typen von `req.params`?

Express ist reines JavaScript und bringt keine TypeScript-Typen mit. Die Typen
kommen aus dem Community-Paket `@types/express` (DefinitelyTyped), das seinerseits
`@types/express-serve-static-core` nutzt. Dort steht, vereinfacht:

```ts
export interface Request<P = ParamsDictionary, ...> {
  params: P;
  // ...
}
```

Schreibt man — wie in maxAI — einen Handler ohne explizite Generics, greift der
Default `ParamsDictionary`. Und genau dieser Hilfstyp hat sich zwischen der 4er-
und der 5er-Linie verändert:

```ts
// @types/express-serve-static-core 4.x
export interface ParamsDictionary { [key: string]: string }

// @types/express-serve-static-core 5.1.x
export interface ParamsDictionary {
  [key: string]: string | string[];
  [key: number]: string;
}
```

Der Grund für die Verbreiterung: Express 5 kennt Wildcard-Routen
(`/files/*splat`) und wiederholte Parameter, die als Array ankommen können. Für
Routen wie `/conversations/:id` ist der Wert immer ein einzelner String — der Typ
weiß das aber nicht.

### Die zweite Zutat: Prismas generierte Typen

Prisma generiert aus `prisma/schema.prisma` einen vollständig typisierten Client.
Für ein `String`-Feld erwartet ein `where` entweder einen String oder ein
Filter-Objekt:

```ts
id?: string | StringFilter<"Conversation">
```

Ein `string[]` ist dort nicht erlaubt — daher die `TS2322`-Fehler.

Wichtig ist außerdem, wie Prisma den **Rückgabetyp** bestimmt:

```ts
findFirst<T extends ConversationFindFirstArgs>(
  args?: SelectSubset<T, ConversationFindFirstArgs>
): Prisma__ConversationClient<GetResult<$ConversationPayload, T, "findFirst"> | null>
```

Der Rückgabetyp wird aus dem *konkret übergebenen* Argument `T` abgeleitet —
inklusive `include: { messages: ... }`. Deshalb hatte der Fehler eine
Folgewirkung (siehe „Intuition").

### Der betroffene Code

`backend/src/routes/chat.ts` ist die zentrale Chat-Route: Konversationen
auflisten, lesen, umbenennen, anpinnen, löschen, Nachrichten senden
(SSE-Streaming), regenerieren, editieren und Reaktionen setzen. Fast jeder
Handler beginnt mit demselben Muster:

```ts
const conv = await prisma.conversation.findFirst({
  where: { id: req.params.id, userId: req.userId },
  include: { messages: { orderBy: { createdAt: 'asc' } } },
});
```

Ein einziger falsch typisierter Ausdruck (`req.params.id`) tauchte damit an
dreizehn Stellen auf.

## Intuition

Stell dir den Compiler-Dialog konkret vor, für den Request
`GET /conversations/abc-123`:

> **Laufzeit:** `req.params.id === "abc-123"` — ein String, immer.
> **Typ-Ebene (mit 5.x-Typen):** `req.params.id: string | string[]` — könnte auch
> `["abc", "123"]` sein.
> **Prisma:** „`where.id` akzeptiert `string` oder `StringFilter`, aber niemals
> ein Array." → **TS2322**

Der interessante Teil ist der Dominoeffekt bei den drei `TS2339`-Fehlern
(„Property 'messages' does not exist"). Da das Argument-Objekt wegen des
Array-Anteils die Constraint `ConversationFindFirstArgs` nicht mehr erfüllt, kann
TypeScript `T` nicht aus dem Argument ableiten und fällt auf die Constraint
selbst zurück. Damit verliert der Rückgabetyp die `include`-Information und
schrumpft auf die nackten Spalten der Tabelle:

```
{ model: string; id: string; createdAt: Date; updatedAt: Date;
  userId: string; title: string; pinned: boolean }
```

Kein `messages` mehr — obwohl der Code inhaltlich völlig korrekt ist. Anders
gesagt: **Es gab nie zwei Probleme, sondern eines mit zwei Symptomen.** Wer die
`messages`-Fehler einzeln „reparieren" würde (etwa mit `as any`), würde die
eigentliche Ursache verdecken.

Und die Ursache steht in `package.json`:

```
express:         ^4.21.1   → installiert 4.22.2
@types/express:  ^5.0.0    → installiert 5.0.6 (+ serve-static-core 5.1.2)
```

Die Typen beschrieben also eine andere Bibliothek als die, die tatsächlich läuft.
Dass der Fehler erst jetzt auftrat, liegt am Caret-Range:
`@types/express-serve-static-core` 5.1.x hat `ParamsDictionary` nachträglich
verbreitert. Das Lockfile enthielt bereits 5.1.2 — deshalb schlug auch das
`npm ci` im Docker-Build reproduzierbar fehl.

## Code

Die Änderung besteht aus einer Zeile in `backend/package.json` plus dem daraus
folgenden Lockfile-Update:

```diff
   "devDependencies": {
     "@types/bcryptjs": "^2.4.6",
     "@types/cors": "^2.8.17",
-    "@types/express": "^5.0.0",
+    "@types/express": "^4.17.21",
     "@types/jsonwebtoken": "^9.0.7",
```

Aufgelöst wird damit:

| Paket | vorher | nachher |
| --- | --- | --- |
| `express` (Runtime) | 4.22.2 | 4.22.2 (unverändert) |
| `@types/express` | 5.0.6 | 4.17.25 |
| `@types/express-serve-static-core` | 5.1.2 | 4.19.9 |

Am Anwendungscode war **keine** Änderung nötig: `req.params.id` ist mit den
4er-Typen wieder `string`, alle Prisma-`where`-Klauseln passen, und weil die
Argumente die Constraint erfüllen, leitet Prisma den Rückgabetyp wieder aus dem
`include` ab — `conv.messages` existiert wieder.

> **Wartungshinweis:** `@types/express` und `express` müssen zusammen versioniert
> werden. Wer später auf Express 5 geht, hebt **beide** Pakete gemeinsam an und
> muss dann die Route-Parameter im Code explizit verengen (siehe Alternative 1).

## Verifizierung

Eine Besonderheit dieses Bugs: Er ist **nur mit generierten Prisma-Typen
sichtbar**. Ohne erfolgreiches `prisma generate` ist `PrismaClient` in
`node_modules/.prisma/client/index.d.ts` lediglich als `any` deklariert — dann
läuft `tsc` fehlerfrei durch und der Fehler tritt erst im Docker-Build auf. Der
Reproduktionsschritt lautet also immer: **erst generieren, dann bauen.**

Durchgeführte Prüfungen:

1. **Fehler reproduziert** — nach `npm ci` und `prisma generate` liefert
   `npm run build` exakt die 15 gemeldeten Fehler (TS2322 in `findFirst`,
   `findUnique`, `updateMany`, `update` und `message.findFirst`; TS2339 auf
   `conv.messages` an drei Stellen).
2. **Clean-Install-Gegenprobe** — in einem frischen Verzeichnis mit dem neuen
   Lockfile: `npm ci` installiert `@types/express` 4.17.25 /
   `serve-static-core` 4.19.9, `tsc --noEmit` läuft ohne Ausgabe durch. Damit ist
   auch der Docker-`npm ci`-Pfad abgedeckt.
3. **Testsuite grün** — `npm test`: 279 + 19 + 23 + 20 + 55 = **396 Tests, 0
   Fehler** (chatMode, buildModelHistory, units, generation, websearch).

So prüfst du es selbst nach:

```bash
cd backend
npm ci
npx prisma generate     # zwingend: sonst ist PrismaClient "any"
npm run build           # erwartet: keine Ausgabe
npm test                # erwartet: alles passed
```

Oder direkt auf dem Weg, auf dem der Fehler aufgetreten ist:

```bash
docker compose build backend
```

## Alternativen

### Alternative 1: Express 5 als Ziel — Runtime anheben statt Typen zurücknehmen

Statt die Typen zurückzunehmen, könnte man `express` auf 5.x aktualisieren und
die Parameter im Code verengen (z. B. `Request<{ id: string }>` pro Route).

| Pro | Contra |
| --- | --- |
| Zukunftsgerichtet; Express 4 ist im Wartungsmodus | Express 5 bringt Breaking Changes (Router-Matching, `*` → `*splat`, Promise-Handling, entfernte Methoden) |
| Typen und Runtime stimmen ebenfalls überein | Größerer Testaufwand für alle Routen und Middleware, inkl. Auth und SSE |
| Explizite Route-Generics dokumentieren die erwarteten Parameter | Löst den akuten Build-Fehler nicht, sondern verschiebt ihn in eine Migration |

### Alternative 2: Fehler im Code umgehen (Casts oder Helper)

Die 5er-Typen behalten und an jeder Stelle `req.params.id as string` schreiben
oder eine Funktion `paramId(req, 'id')` einführen.

| Pro | Contra |
| --- | --- |
| Keine Änderung an den Abhängigkeiten | Typen beschreiben weiterhin eine andere Express-Version als die installierte — die Ursache bleibt |
| Funktioniert unabhängig von der Typen-Version | 13 zusätzliche Casts allein in `chat.ts`, mit jeder neuen Route kommen weitere hinzu |
| Nützliches Muster, falls später doch Express 5 kommt | Casts unterdrücken auch echte Fehler und helfen bei weiteren 5.x-Typänderungen (Response, Handler) nicht |

## Vorgeschlagene Gesprächspartner/-innen

- **Malte Höpers** (`7b21569`, `1025636`, `d3be5f3`) — Autor der ursprünglichen
  maxAI-Implementierung und des Chat-Mode-Features in `chat.ts`. Er kann am
  besten einschätzen, ob langfristig ein Express-5-Upgrade angestrebt wird und
  welche Routen dabei besondere Aufmerksamkeit brauchen (SSE-Streaming,
  Reaktionen, Reply-Logik).

Alle jüngeren Commits an `backend/package.json` und `backend/src/routes/chat.ts`
(u. a. `57eb0e3`, `43584cd`, `a639370`) stammen von KI-Agenten, nicht von
Menschen. Menschlicher Kontext existiert im Wesentlichen nur bei Malte — ein
kurzer Review durch ihn ist daher sinnvoll.

## Quiz

<details>
<summary>1. Warum wurde <code>req.params.id</code> plötzlich als <code>string | string[]</code> typisiert?</summary>

- A) Express 4.22 hat sein Verhalten geändert und liefert jetzt Arrays.
- B) `@types/express-serve-static-core` 5.1.x hat `ParamsDictionary` auf
  `{ [key: string]: string | string[] }` verbreitert — und `@types/express` war
  auf `^5.0.0` gepinnt.
- C) Weil in `chat.ts` mehrere Parameter (`:id` und `:messageId`) in einer Route
  vorkommen.
- D) Weil `AuthRequest` das `params`-Feld überschreibt.

**Richtig: B.** Die Verbreiterung existiert nur auf Typ-Ebene und stammt aus der
5er-Linie der Typen (Express 5 erlaubt Wildcards/wiederholte Parameter). A ist
falsch, denn die Runtime blieb Express 4.22 und liefert weiterhin Strings. C ist
falsch — die Anzahl der Parameter spielt keine Rolle, die Index-Signatur gilt für
alle. D ist falsch: `AuthRequest` ergänzt nur `userId?: string`.
</details>

<details>
<summary>2. Warum meldete der Compiler zusätzlich „Property 'messages' does not exist"?</summary>

- A) Das `include` war falsch geschrieben.
- B) Die Relation `messages` fehlt im Prisma-Schema.
- C) Weil das Argument die Constraint `ConversationFindFirstArgs` nicht erfüllte,
  konnte `T` nicht aus dem Argument abgeleitet werden — der Rückgabetyp fiel auf
  die Basis-Spalten ohne `include` zurück.
- D) Weil `orderBy: { createdAt: 'asc' }` mit `take` nicht kombinierbar ist.

**Richtig: C.** Prisma leitet den Rückgabetyp aus dem konkreten Argument ab;
scheitert die Inferenz, bleibt nur der Default-Payload. A und B sind falsch —
Schema und Aufruf sind korrekt, was man daran sieht, dass der Fehler ohne jede
Code-Änderung verschwindet. D ist falsch, diese Kombination ist erlaubt und wird
in `chat.ts` bewusst genutzt.
</details>

<details>
<summary>3. Warum lief <code>npm run build</code> in einer Umgebung ohne generierten Prisma-Client fehlerfrei?</summary>

- A) Docker nutzt eine andere TypeScript-Version.
- B) Ohne erfolgreiches `prisma generate` ist `PrismaClient` als `any`
  deklariert — dann prüft `tsc` die `where`-Argumente überhaupt nicht.
- C) `tsconfig.json` schließt `src/routes` im lokalen Build aus.
- D) Der Docker-Build verwendet `strict: true`, der lokale nicht.

**Richtig: B.** Der Stub-Client macht die Fehler unsichtbar; deshalb gehört
`prisma generate` zwingend zur Reproduktion. A ist falsch, TypeScript kommt in
beiden Fällen aus dem Lockfile. C ist falsch (`include: ["src/**/*"]`). D ist
falsch — `strict` steht in derselben `tsconfig.json` für beide.
</details>

<details>
<summary>4. Welche Aussage über den Fix trifft zu?</summary>

- A) Es wurden 13 `as string`-Casts in `chat.ts` eingefügt.
- B) Die Prisma-Query wurde auf `findUnique` umgestellt.
- C) Nur `@types/express` (und dadurch das Lockfile) wurde geändert; der
  Anwendungscode blieb unverändert.
- D) Die Runtime-Abhängigkeit `express` wurde auf 5 aktualisiert.

**Richtig: C.** Genau darin liegt der Reiz: Da die Ursache eine
Versions-Inkonsistenz war, genügt eine Zeile in `package.json`. A wäre
Alternative 2 und würde die Ursache verdecken. D wäre Alternative 1 mit
erheblichen Breaking Changes. B löst nichts — der Filter-Typ wäre weiterhin
unverträglich mit `string[]`.
</details>

<details>
<summary>5. Was ist die praktische Lehre für die Zukunft?</summary>

- A) `skipLibCheck` sollte abgeschaltet werden.
- B) `@types/*`-Pakete müssen in ihrer Major-Version zur installierten
  Runtime-Bibliothek passen, sonst beschreiben sie eine andere Bibliothek als die
  laufende.
- C) Caret-Ranges (`^`) sollten grundsätzlich vermieden werden.
- D) Prisma-Aufrufe sollten immer über eigene Wrapper-Funktionen laufen.

**Richtig: B.** Die Major-Version der Typen ist an die Major-Version der
Bibliothek gekoppelt. A hätte hier nichts geändert (der Fehler liegt im eigenen
Code, nicht in `.d.ts`-Dateien). C ist überzogen — Caret-Ranges sind üblich; das
Problem war die falsche Major-Version, nicht der Range. D ändert nichts an der
Typinkompatibilität, sondern verschiebt sie nur.
</details>
