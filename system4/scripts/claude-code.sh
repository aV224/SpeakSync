#!/bin/bash
# Claude Code for Gaana - Enhanced execution script with dangerous permissions
# This script enables Claude to access and modify the entire Gaana codebase

# Default values
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CLAUDE_CLI_PATH="/opt/homebrew/bin/claude"
TEMP_DIR="$PROJECT_ROOT/temp"
DEBUG=false

# Parse arguments
while [[ "$#" -gt 0 ]]; do
  case $1 in
    --prompt) PROMPT="$2"; shift ;;
    --prompt-file) PROMPT_FILE="$2"; shift ;;
    --project-dir) PROJECT_DIR="$2"; shift ;;
    --claude-path) CLAUDE_CLI_PATH="$2"; shift ;;
    --debug) DEBUG=true ;;
    *) echo "Unknown parameter: $1"; exit 1 ;;
  esac
  shift
done

# Set up logging
LOG_FILE="$TEMP_DIR/claude-code-$(date +%Y%m%d-%H%M%S).log"
mkdir -p "$TEMP_DIR"

# Logging function
log() {
  local level="$1"
  local message="$2"
  local timestamp=$(date "+%Y-%m-%d %H:%M:%S")
  echo "[$timestamp] [$level] $message" | tee -a "$LOG_FILE"
}

log "INFO" "Starting Claude Code execution for Gaana"
log "INFO" "Project root: $PROJECT_ROOT"

# Verify Claude CLI exists
if [ ! -f "$CLAUDE_CLI_PATH" ]; then
  log "ERROR" "Claude CLI not found at $CLAUDE_CLI_PATH"
  exit 1
fi

# Process prompt
if [ -n "$PROMPT_FILE" ] && [ -f "$PROMPT_FILE" ]; then
  log "INFO" "Using prompt file: $PROMPT_FILE"
  PROMPT_CONTENT=$(cat "$PROMPT_FILE")
elif [ -n "$PROMPT" ]; then
  log "INFO" "Using provided prompt"
  PROMPT_CONTENT="$PROMPT"
  
  # Save prompt to file for Claude CLI
  PROMPT_FILE="$TEMP_DIR/prompt-$(date +%Y%m%d-%H%M%S).txt"
  echo "$PROMPT_CONTENT" > "$PROMPT_FILE"
else
  log "ERROR" "No prompt provided. Use --prompt or --prompt-file"
  exit 1
fi

# Enhance prompt with additional context
ENHANCED_PROMPT_FILE="$TEMP_DIR/enhanced-prompt-$(date +%Y%m%d-%H%M%S).txt"

# Add header and project context
cat > "$ENHANCED_PROMPT_FILE" << EOF
# Claude Code for Gaana Project

## Project Context
- Project Name: Gaana
- Working Directory: $PROJECT_ROOT
- Environment: $([ -n "$NODE_ENV" ] && echo "$NODE_ENV" || echo "development")
- Timestamp: $(date "+%Y-%m-%d %H:%M:%S")

## Original Prompt
$PROMPT_CONTENT

## Important Instructions
1. You have FULL ACCESS to read and write files in the project
2. You can execute shell commands with elevated permissions
3. Follow software engineering best practices
4. Maintain code style and conventions of the existing codebase
5. Make changes safely, preserving existing functionality

## Available Tools
- File operations: read, write, create, delete files
- Directory operations: list, create directories
- Command execution: run shell commands with elevated permissions
- Code analysis: analyze the codebase structure and patterns

## Response Guidelines
- Describe your changes clearly
- Explain your reasoning for implementation choices
- If you make file changes, list the modified files
- Return any command outputs that are relevant
EOF

log "INFO" "Enhanced prompt created at $ENHANCED_PROMPT_FILE"

# Add directory structure information if in debug mode
if [ "$DEBUG" = true ]; then
  log "INFO" "Adding directory structure information (debug mode)"
  echo -e "\n## Project Structure" >> "$ENHANCED_PROMPT_FILE"
  echo "```" >> "$ENHANCED_PROMPT_FILE"
  find "$PROJECT_ROOT" -type f -not -path "*/node_modules/*" -not -path "*/.git/*" -not -path "*/temp/*" | grep -v "package-lock.json" | sort | head -n 300 >> "$ENHANCED_PROMPT_FILE"
  echo "```" >> "$ENHANCED_PROMPT_FILE"
fi

# Execute Claude with dangerous permissions
log "INFO" "Executing Claude CLI with dangerous permissions"
"$CLAUDE_CLI_PATH" --prompt --prompt-file="$ENHANCED_PROMPT_FILE" --cwd="$PROJECT_ROOT" --dangerously-skip-permissions 2>&1 | tee -a "$LOG_FILE"
EXIT_CODE=${PIPESTATUS[0]}

# Clean up
if [ "$DEBUG" != true ]; then
  log "INFO" "Cleaning up temporary files"
  rm -f "$ENHANCED_PROMPT_FILE"
fi

log "INFO" "Claude Code execution completed with exit code $EXIT_CODE"
exit $EXIT_CODE