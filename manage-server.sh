#!/bin/bash

# Configuration
APP_DIR="$HOME/webapp/sesa0001"
PID_FILE="$APP_DIR/.nextjs.pid"
LOG_FILE="$APP_DIR/.nextjs.log"
PORT=55678

# Source bash profile and NVM (more complete sourcing)
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"  # This loads nvm
[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"  # This loads nvm bash_completion

# Ensure nvm is available
if ! command -v nvm &> /dev/null; then
    echo "NVM is not available. Attempting to load from default location..."
    source "$HOME/.nvm/nvm.sh"
fi

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if the server is running
check_status() {
    if [ -f "$PID_FILE" ]; then
        pid=$(cat "$PID_FILE")
        if ps -p "$pid" > /dev/null; then
            echo -e "${GREEN}Next.js server is running (PID: $pid)${NC}"
            return 0
        else
            rm "$PID_FILE"
            echo -e "${RED}Next.js server is not running (stale PID file removed)${NC}"
            return 1
        fi
    else
        echo -e "${RED}Next.js server is not running${NC}"
        return 1
    fi
}

# Start the server
start_server() {
    if check_status > /dev/null; then
        echo -e "${YELLOW}Server is already running!${NC}"
        return
    fi
    
    echo -e "${GREEN}Starting Next.js server...${NC}"
    cd "$APP_DIR" || exit
    
    # Debug information
    echo "Current PATH: $PATH"
    echo "Node version: $(node --version)"
    echo "NPM version: $(npm --version)"
    
    # Use node directly instead of nvm if already on correct version
    if [[ "$(node --version)" == "v18"* ]]; then
        echo "Already using Node.js 18"
    else
        nvm use 18
    fi
    
    # Install dependencies if needed
    echo "Checking and installing dependencies..."
    npm install
    
    # Build and start with explicit host binding
    echo "Building Next.js application..."
    npm run build
    
    echo "Starting server..."
    NODE_ENV=production HOST=0.0.0.0 PORT=45678 npm run start > "$LOG_FILE" 2>&1 &
    
    # Store PID and wait to ensure process is running
    local pid=$!
    echo $pid > "$PID_FILE"
    
    # Wait a moment and check if process is still running
    sleep 5
    if ps -p $pid > /dev/null; then
        echo -e "${GREEN}Server started successfully (PID: $pid)${NC}"
        echo -e "${GREEN}Server logs are available at: $LOG_FILE${NC}"
        echo -e "${GREEN}Access the website at: http://$(hostname -I | awk '{print $1}'):45678${NC}"
    else
        echo -e "${RED}Server failed to start. Checking logs:${NC}"
        tail -n 10 "$LOG_FILE"
        rm "$PID_FILE"
        return 1
    fi
}

# Stop the server
stop_server() {
    local any_process_killed=false

    # First try to kill by PID file
    if [ -f "$PID_FILE" ]; then
        pid=$(cat "$PID_FILE")
        echo -e "${YELLOW}Stopping Next.js server (PID: $pid)...${NC}"
        
        # Kill the main process and its children
        pkill -P "$pid" 2>/dev/null && any_process_killed=true
        kill -9 "$pid" 2>/dev/null && any_process_killed=true
        rm "$PID_FILE"
    fi

    # Then try to kill by port
    if pid_on_port=$(fuser ${PORT}/tcp 2>/dev/null); then
        echo -e "${YELLOW}Killing process on port ${PORT} (PID: ${pid_on_port})...${NC}"
        fuser -k ${PORT}/tcp 2>/dev/null && any_process_killed=true
    fi

    # Finally try to kill any node process using this port
    if pids=$(pkill -f "node.*${PORT}" 2>/dev/null); then
        echo -e "${YELLOW}Killing Node.js processes using port ${PORT}...${NC}"
        any_process_killed=true
    fi

    # Wait a moment for processes to die
    sleep 2

    # Verify everything is stopped
    if lsof -i:${PORT} >/dev/null 2>&1; then
        echo -e "${RED}Warning: Port ${PORT} is still in use${NC}"
        return 1
    else
        echo -e "\n${GREEN}All processes stopped and port ${PORT} is free${NC}"
    fi

    if [ "$any_process_killed" = true ]; then
        echo -e "${GREEN}Server stopped successfully${NC}"
    else
        echo -e "${YELLOW}No running processes found to stop${NC}"
    fi
}

# Restart the server
restart_server() {
    echo "Restarting Next.js server..."
    stop_server
    sleep 2
    start_server
}

# Show server logs
show_logs() {
    if [ -f "$LOG_FILE" ]; then
        tail -f "$LOG_FILE"
    else
        echo -e "${RED}No log file found${NC}"
    fi
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
        restart_server
        ;;
    status)
        check_status
        ;;
    logs)
        show_logs
        ;;
    *)
        echo "Usage: $0 {start|stop|restart|status|logs}"
        exit 1
        ;;
esac

exit 0 
