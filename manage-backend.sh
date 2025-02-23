#!/bin/bash

# Configuration
BACKEND_DIR="server_backend"
PORT=55600

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Kill any process using our port
kill_port() {
    echo -e "${YELLOW}Killing any process on port ${PORT}...${NC}"
    fuser -k ${PORT}/tcp 2>/dev/null
    sleep 2
}

# Start the server
start_server() {
    kill_port
    cd "$BACKEND_DIR" || exit
    
    echo -e "${GREEN}Setting up server...${NC}"
    npm install
    
    echo -e "${GREEN}Building...${NC}"
    npm run build
    
    echo -e "${GREEN}Starting production server...${NC}"
    NODE_ENV=production nohup node dist/server.js >/dev/null 2>&1 &
    
    echo -e "${GREEN}Server started in background${NC}"
}

# Stop the server
stop_server() {
    echo -e "${YELLOW}Stopping backend server...${NC}"
    kill_port
    echo -e "${GREEN}Server stopped${NC}"
}

# Command handling
case "$1" in
    start)
        start_server
        ;;
    stop)
        stop_server
        ;;
    restart)
        stop_server
        sleep 2
        start_server
        ;;
    *)
        echo "Usage: $0 {start|stop|restart}"
        exit 1
        ;;
esac

exit 0 