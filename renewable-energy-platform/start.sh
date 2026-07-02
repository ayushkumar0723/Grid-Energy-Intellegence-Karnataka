#!/bin/bash
set -e
GREEN='\033[0;32m'; BLUE='\033[0;34m'; YELLOW='\033[1;33m'; NC='\033[0m'
echo -e "${BLUE}  ⚡ Grid Energy Intelligence — Karnataka${NC}"
if ! command -v python3 &>/dev/null; then echo "ERROR: python3 not found"; exit 1; fi
if ! command -v node &>/dev/null; then echo "ERROR: node not found"; exit 1; fi
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo -e "${YELLOW}[1/4] Setting up Python backend...${NC}"
cd "$SCRIPT_DIR/backend"
if [ ! -d "venv" ]; then python3 -m venv venv; fi
source venv/bin/activate 2>/dev/null || source venv/Scripts/activate 2>/dev/null
pip install -q -r requirements.txt
echo -e "${GREEN}✓ Backend ready${NC}"

echo -e "${YELLOW}[2/4] Starting backend on http://localhost:8000${NC}"
python main.py &
BACKEND_PID=$!
sleep 2
echo -e "${GREEN}✓ Backend started (PID: $BACKEND_PID)${NC}"

echo -e "${YELLOW}[3/4] Setting up React frontend...${NC}"
cd "$SCRIPT_DIR/frontend"
if [ ! -d "node_modules" ]; then npm install; fi
echo -e "${GREEN}✓ Frontend ready${NC}"

echo -e "${YELLOW}[4/4] Starting frontend on http://localhost:5173${NC}"
npm run dev &
FRONTEND_PID=$!

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Dashboard:  http://localhost:5173${NC}"
echo -e "${GREEN}  API Docs:   http://localhost:8000/docs${NC}"
echo -e "${GREEN}  KPTCL raw:  http://localhost:8000/api/kptcl/raw${NC}"
echo -e "${GREEN}========================================${NC}"

cleanup() { kill $BACKEND_PID 2>/dev/null; kill $FRONTEND_PID 2>/dev/null; }
trap cleanup INT TERM
wait
