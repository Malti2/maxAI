#!/bin/bash
# ============================================
# maxAI - Setup script for Ubuntu VPS
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
    echo -e "${YELLOW}⚠️  No .env file found.${NC}"
    echo -e "Creating .env from .env.example..."
    cp .env.example .env
    echo -e "${RED}➤  Please fill in the .env file before continuing!${NC}"
    echo -e "   nano .env"
    exit 1
fi

# Check for Docker
if ! command -v docker &> /dev/null; then
    echo -e "${YELLOW}Installing Docker...${NC}"
    curl -fsSL https://get.docker.com | sh
    systemctl enable docker
    systemctl start docker
fi

# Check for Docker Compose
if ! docker compose version &> /dev/null; then
    echo -e "${YELLOW}Installing Docker Compose...${NC}"
    apt-get install -y docker-compose-plugin
fi

echo -e "${GREEN}✓ Docker is available${NC}"

# Build & start
echo -e "\n${BLUE}🔨 Building containers...${NC}"
docker compose build

echo -e "\n${BLUE}🚀 Starting containers...${NC}"
docker compose up -d

echo -e "\n${GREEN}✅ maxAI is running!${NC}"
echo -e "   Open http://$(hostname -I | awk '{print $1}') in your browser"
echo ""
echo -e "Useful commands:"
echo -e "  ${YELLOW}docker compose logs -f${NC}        - Show logs"
echo -e "  ${YELLOW}docker compose restart${NC}         - Restart"
echo -e "  ${YELLOW}docker compose down${NC}            - Stop"
echo -e "  ${YELLOW}docker compose pull && docker compose up -d${NC} - Update"
