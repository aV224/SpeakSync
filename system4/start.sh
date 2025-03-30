#!/bin/bash
# Start script for Gaana with Claude Code integration
# This script starts the server with proper configuration and initialization

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Print header
echo -e "${GREEN}==============================="
echo "  Starting Gaana Server"
echo -e "===============================${NC}"

# Set working directory to script location
cd "$(dirname "$0")"

# Update project configuration
echo -e "\n${YELLOW}Updating project configuration...${NC}"
if node scripts/update-projects.js; then
  echo -e "${GREEN}Project configuration updated successfully${NC}"
else
  echo -e "${RED}Error updating project configuration${NC}"
  # Continue anyway
fi

# Make sure scripts have execute permissions
echo -e "\n${YELLOW}Setting execute permissions on scripts...${NC}"
chmod +x scripts/*.js scripts/*.sh

# Create temp directory if it doesn't exist
if [ ! -d "temp" ]; then
  echo -e "\n${YELLOW}Creating temp directory...${NC}"
  mkdir -p temp
fi

# Check if port 5001 is already in use
echo -e "\n${YELLOW}Checking port 5001...${NC}"
if lsof -i :5001 > /dev/null; then
  echo -e "${RED}Port 5001 is already in use. Stopping existing processes...${NC}"
  pkill -f "node.*PORT=5001" || true
  # Give processes time to shut down
  sleep 1
fi

# Start the server
echo -e "\n${GREEN}Starting server on port 5001...${NC}"
PORT=5001 npm start