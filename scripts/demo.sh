#!/bin/bash
# CampusWatch — Scripted Demo Walkthrough
# Run this script to walk through all features step by step.

set -e

BASE_A="http://localhost:3001"
BASE_B="http://localhost:3002"
BASE_C="http://localhost:3003"

BLUE='\033[0;34m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

pause() {
  echo ""
  echo -e "${YELLOW}Press Enter to continue...${NC}"
  read -r
}

echo -e "${BLUE}╔══════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║       CampusWatch — Live Demo Script        ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════╝${NC}"
echo ""

# ── Step 1: Health Check ──────────────────────────────────────
echo -e "${GREEN}[Step 1] Checking cluster health...${NC}"
echo "Node A:"
curl -s "$BASE_A/health" | python3 -m json.tool 2>/dev/null || echo "  Node A is down"
echo ""
echo "Node B:"
curl -s "$BASE_B/health" | python3 -m json.tool 2>/dev/null || echo "  Node B is down"
echo ""
echo "Node C:"
curl -s "$BASE_C/health" | python3 -m json.tool 2>/dev/null || echo "  Node C is down"
pause

# ── Step 2: Mark Attendance (via leader) ──────────────────────
echo -e "${GREEN}[Step 2] Marking attendance via Node A...${NC}"
curl -s -X POST "$BASE_A/api/attendance" \
  -H 'Content-Type: application/json' \
  -d '{"studentId":"S001","date":"2026-08-23","present":true,"markedBy":"T001"}' | python3 -m json.tool
echo ""
echo "Verifying replication on Node B:"
curl -s "$BASE_B/api/attendance?date=2026-08-23" | python3 -m json.tool
echo ""
echo "Verifying replication on Node C:"
curl -s "$BASE_C/api/attendance?date=2026-08-23" | python3 -m json.tool
pause

# ── Step 3: Create Booking Request ────────────────────────────
echo -e "${GREEN}[Step 3] Student S001 booking Lab-1...${NC}"
BOOKING_RESPONSE=$(curl -s -X POST "$BASE_A/api/booking" \
  -H 'Content-Type: application/json' \
  -d '{"resource":"Lab-1","date":"2026-08-24","timeSlot":"10:00-12:00","requestedBy":"S001"}')
echo "$BOOKING_RESPONSE" | python3 -m json.tool
BOOKING_ID=$(echo "$BOOKING_RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null || echo "unknown")
echo "Booking ID: $BOOKING_ID"
pause

# ── Step 4: HOD Approves Booking ──────────────────────────────
echo -e "${GREEN}[Step 4] HOD approving booking $BOOKING_ID...${NC}"
curl -s -X PATCH "$BASE_A/api/booking/$BOOKING_ID" \
  -H 'Content-Type: application/json' \
  -d '{"decision":"approved","decidedBy":"HOD001"}' | python3 -m json.tool
echo ""
echo "Verifying booking status on Node C:"
curl -s "$BASE_C/api/booking/$BOOKING_ID" | python3 -m json.tool
pause

# ── Step 5: Kill a Node (Failover) ───────────────────────────
echo -e "${RED}[Step 5] Killing Node B...${NC}"
echo "Run in another terminal: docker compose stop node-b"
echo "Then watch the Admin Dashboard at http://localhost:3000/admin"
echo ""
echo "Expected:"
echo "  - Gossip detects node-b dead within ~3 seconds"
echo "  - If node-b was leader, re-election happens within ~3 seconds"
echo "  - Attendance/booking still works on remaining 2 nodes"
pause

# ── Step 6: Write While Node Down ─────────────────────────────
echo -e "${GREEN}[Step 6] Marking more attendance while node-b is down...${NC}"
curl -s -X POST "$BASE_A/api/attendance" \
  -H 'Content-Type: application/json' \
  -d '{"studentId":"S002","date":"2026-08-23","present":true,"markedBy":"T001"}' | python3 -m json.tool
echo ""
echo "Replicated on Node C (but not node-b, it's down):"
curl -s "$BASE_C/api/attendance?date=2026-08-23" | python3 -m json.tool
pause

# ── Step 7: Restart Node (Catch-up) ──────────────────────────
echo -e "${GREEN}[Step 7] Restart node-b and watch catch-up...${NC}"
echo "Run in another terminal: docker compose start node-b"
echo "Then check node-b's data after a few seconds:"
echo ""
echo "  curl http://localhost:3002/api/attendance?date=2026-08-23"
echo ""
echo "Expected: node-b catches up and shows ALL attendance records"
pause

echo -e "${BLUE}╔══════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║          Demo Complete! 🎉                   ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════╝${NC}"
