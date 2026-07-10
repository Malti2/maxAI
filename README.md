# maxAI 🚀

**maxAI** ist die Plattform. **Max** ist der Name der KI – dein persönlicher Assistent mit eigenem ChatGPT-ähnlichem Interface, betrieben von Azure OpenAI.

## Features

- **4 Modelle**: Max Lite ◈, Max Pro ◆, Max Beast ⬡, Auto ✦
- **3 Persönlichkeiten**: Casual (locker & direkt), Assistant (ausgewogen), Professional (formell)
- **Apple-ähnliches Design**: Runde Ecken, Glaseffekte, saubere Typographie
- **Chat-Verlauf**: Suche, Anheften, Löschen
- **Streaming**: Antworten werden in Echtzeit ausgegeben
- **Login + Registrierung**: JWT-basiert mit Refresh Tokens
- **Onboarding**: Schritt-für-Schritt Setup beim ersten Login (inkl. Persönlichkeitswahl)
- **Einstellungen**: Profil, Theme (Hell/Dunkel/System), Persönlichkeit, Standardmodell, Systemanweisung
- **Markdown**: Volle Unterstützung inkl. Code-Highlighting
- **Auto-Modus**: Wählt automatisch das passende Modell je nach Komplexität

## Persönlichkeiten

Max kann in drei Persönlichkeiten antworten. Die Wahl legt Identität, Tonfall und Formatierung fest; eine optionale eigene Systemanweisung wird zusätzlich obendrauf gelegt.

| Persönlichkeit | Stil | Beschreibung |
|----------------|------|--------------|
| **Casual** | locker & direkt | Wie eine Nachricht von einem cleveren Freund – kleingeschrieben, kurz, ohne Floskeln, keine Emojis |
| **Assistant** | ausgewogen (Standard) | Freundlich und klar mit sauberer Markdown-Formatierung |
| **Professional** | formell & präzise | Sachlich, strukturiert und geschäftstauglich |

Die Persönlichkeit wird pro Benutzer gespeichert (`User.personality`, Standard: `assistant`) und serverseitig als System-Prompt gesetzt (`backend/src/services/personalities.ts`).

## Schnellstart (VPS)

### 1. Voraussetzungen

```bash
# Docker installieren (falls nicht vorhanden)
curl -fsSL https://get.docker.com | sh
systemctl enable docker && systemctl start docker
```

### 2. Konfiguration

```bash
cp .env.example .env
nano .env  # Azure API Keys und Secrets eintragen
```

**Wichtige Variablen in `.env`:**

| Variable | Beschreibung |
|----------|-------------|
| `POSTGRES_PASSWORD` | Sicheres Datenbankpasswort |
| `JWT_SECRET` | Zufälliger Schlüssel (`openssl rand -hex 64`) |
| `AZURE_ENDPOINT` | Azure OpenAI Endpoint URL |
| `AZURE_API_KEY` | Azure API Key |
| `AZURE_DEPLOYMENT_LITE` | Deployment-Name für Max Lite (z.B. `gpt-4o-mini`) |
| `AZURE_DEPLOYMENT_PRO` | Deployment-Name für Max Pro (z.B. `gpt-4o`) |
| `AZURE_DEPLOYMENT_BEAST` | Deployment-Name für Max Beast |

### 3. Starten

```bash
bash setup.sh
# oder manuell:
docker compose up -d
```

## Architektur

```
├── frontend/        React + TypeScript + Tailwind CSS (Vite)
├── backend/         Node.js + Express + TypeScript
│   ├── src/
│   │   ├── routes/  auth.ts, chat.ts, settings.ts
│   │   ├── services/ azure.ts (OpenAI Streaming), personalities.ts (System-Prompts)
│   │   └── prisma/  schema.prisma
├── nginx/           Reverse Proxy Konfiguration
└── docker-compose.yml
```

## Modelle

| Modell | Farbe | Verwendung |
|--------|-------|-----------|
| Max Lite ◈ | Blau | Kurze, einfache Anfragen |
| Max Pro ◆ | Violett | Komplexe Aufgaben |
| Max Beast ⬡ | Orange | Maximale Leistung |
| Max Auto ✦ | Grün | Automatische Auswahl |

## Entwicklung

```bash
# Backend
cd backend && npm install
npm run dev

# Frontend (neues Terminal)
cd frontend && npm install
npm run dev
```

## Nützliche Befehle

```bash
docker compose logs -f backend    # Backend-Logs
docker compose logs -f frontend   # Frontend-Logs
docker compose restart backend    # Backend neu starten
docker compose down               # Alles stoppen
docker compose up -d --build      # Mit Rebuild starten
```
