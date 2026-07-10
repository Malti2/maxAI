#!/bin/bash
# ============================================
# maxAI - Setup-Skript für Ubuntu VPS
# ============================================
set -e

YELLOW='\033[1;33m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}╔══════════════════════════════════════╗${NC}"
echo -e "${BLUE}║        maxAI - Setup                 ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════╝${NC}"
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo -e "${YELLOW}⚠️  Keine .env-Datei gefunden.${NC}"
    echo -e "Erstelle .env aus .env.example..."
    cp .env.example .env
    echo -e "${RED}➤  Bitte fülle die .env-Datei aus, bevor du fortfährst!${NC}"
    echo -e "   nano .env"
    exit 1
fi

# Check for Docker
if ! command -v docker &> /dev/null; then
    echo -e "${YELLOW}Docker wird installiert...${NC}"
    curl -fsSL https://get.docker.com | sh
    systemctl enable docker
    systemctl start docker
fi

# Check for Docker Compose
if ! docker compose version &> /dev/null; then
    echo -e "${YELLOW}Docker Compose wird installiert...${NC}"
    apt-get install -y docker-compose-plugin
fi

echo -e "${GREEN}✓ Docker ist verfügbar${NC}"

# Build & start
echo -e "\n${BLUE}🔨 Container werden gebaut...${NC}"
docker compose build

echo -e "\n${BLUE}🚀 Container werden gestartet...${NC}"
docker compose up -d

echo -e "\n${GREEN}✅ maxAI läuft!${NC}"
echo -e "   Öffne http://$(hostname -I | awk '{print $1}') in deinem Browser"
echo ""
echo -e "Nützliche Befehle:"
echo -e "  ${YELLOW}docker compose logs -f${NC}        - Logs anzeigen"
echo -e "  ${YELLOW}docker compose restart${NC}         - Neu starten"
echo -e "  ${YELLOW}docker compose down${NC}            - Stoppen"
echo -e "  ${YELLOW}docker compose pull && docker compose up -d${NC} - Update"
