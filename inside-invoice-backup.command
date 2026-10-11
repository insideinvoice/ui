#!/bin/bash

# Inside Invoice - Local Database Backup Script
# Double-click this file to run (make executable: chmod +x inside-invoice-backup.command)
# 
# What it does:
# 1. Asks for your email and password (same as UI login)
# 2. Validates against the backend
# 3. If admin, downloads a raw SQL dump to ~/Desktop/InsideInvoice-Backups/
# 4. The .sql file can be restored with: psql -d yourdb -f backup.sql
#
# Test credentials: invoiceinside / insideinvoice

set -e

# ─── Configuration ─────────────────────────────────────────────────────
API_BASE="https://api.insideinvoice.in/api"  # Production
# API_BASE="http://localhost:8080/api"      # Local development (uncomment for local)
BACKUP_DIR="$HOME/Desktop/InsideInvoice-Backups"
TIMESTAMP=$(date +"%Y-%m-%d-%H-%M")
BACKUP_FILE="$BACKUP_DIR/insideinvoice-$TIMESTAMP.sql"
# ────────────────────────────────────────────────────────────────────────

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║     Inside Invoice - Local Database Backup                    ║${NC}"
echo -e "${BLUE}║     Downloads raw SQL dump to ~/Desktop/InsideInvoice-Backups/║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Create backup directory
mkdir -p "$BACKUP_DIR"

# ─── Step 1: Get credentials ─────────────────────────────────────────
echo -e "${YELLOW}Please enter your Inside Invoice login credentials:${NC}"
echo -e "${YELLOW}(Same as you use to login to the web app)${NC}"
echo ""

read -p "Email: " EMAIL
if [ -z "$EMAIL" ]; then
    echo -e "${RED}Error: Email cannot be empty${NC}"
    exit 1
fi

# Read password silently
read -s -p "Password: " PASSWORD
echo ""
if [ -z "$PASSWORD" ]; then
    echo -e "${RED}Error: Password cannot be empty${NC}"
    exit 1
fi

echo ""
echo -e "${BLUE}Validating credentials...${NC}"

# ─── Step 2: Login to get JWT ────────────────────────────────────────
LOGIN_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}" \
    "$API_BASE/backup/login")

HTTP_CODE=$(echo "$LOGIN_RESPONSE" | tail -n1)
BODY=$(echo "$LOGIN_RESPONSE" | head -n -1)

if [ "$HTTP_CODE" -ne 200 ]; then
    ERROR_MSG=$(echo "$BODY" | sed -n 's/.*"message":"\([^"]*\)".*/\1/p')
    echo -e "${RED}✗ Login failed: ${ERROR_MSG:-Invalid credentials}${NC}"
    exit 1
fi

# Extract JWT token from response
TOKEN=$(echo "$BODY" | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')
if [ -z "$TOKEN" ] || [ "$TOKEN" = "null" ]; then
    echo -e "${RED}✗ Failed to extract token from response${NC}"
    echo "Response: $BODY"
    exit 1
fi

echo -e "${GREEN}✓ Login successful${NC}"
echo -e "${BLUE}Downloading backup...${NC}"

# ─── Step 3: Download raw SQL dump ───────────────────────────────────
DOWNLOAD_RESPONSE=$(curl -s -w "\n%{http_code}" -X GET \
    -H "Authorization: Bearer $TOKEN" \
    -H "Accept: application/octet-stream" \
    "$API_BASE/backup/download" \
    -o "$BACKUP_FILE")

HTTP_CODE=$(echo "$DOWNLOAD_RESPONSE" | tail -n1)

if [ "$HTTP_CODE" -eq 200 ]; then
    FILE_SIZE=$(ls -lh "$BACKUP_FILE" | awk '{print $5}')
    echo -e "${GREEN}✓ Backup downloaded successfully!${NC}"
    echo -e "${GREEN}  File: $BACKUP_FILE${NC}"
    echo -e "${GREEN}  Size: $FILE_SIZE${NC}"
    echo ""
    echo -e "${BLUE}To restore this backup:${NC}"
    echo -e "  ${YELLOW}psql -d your_database_name -f \"$BACKUP_FILE\"${NC}"
    echo ""
    echo -e "${BLUE}Or with pg_restore (if using custom format):${NC}"
    echo -e "  ${YELLOW}pg_restore -d your_database_name \"$BACKUP_FILE\"${NC}"
elif [ "$HTTP_CODE" -eq 401 ]; then
    echo -e "${RED}✗ Session expired. Please run the script again.${NC}"
    rm -f "$BACKUP_FILE"
    exit 1
elif [ "$HTTP_CODE" -eq 403 ]; then
    echo -e "${RED}✗ Access denied. Only admin users can download raw backups.${NC}"
    rm -f "$BACKUP_FILE"
    exit 1
else
    echo -e "${RED}✗ Download failed (HTTP $HTTP_CODE)${NC}"
    rm -f "$BACKUP_FILE"
    exit 1
fi

echo -e "${GREEN}Done! Backup saved to Desktop/InsideInvoice-Backups/${NC}"
echo ""
read -p "Press Enter to close..."