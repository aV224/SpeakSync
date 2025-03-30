#!/bin/bash
# Enhanced script to execute Claude CLI commands non-interactively with full permissions

# Get the command and working directory
COMMAND="$1"
WORKING_DIR="$2"
OUTPUT_FILE="${3:-claude_output.txt}"

# Check if command is provided
if [[ -z "$COMMAND" ]]; then
  echo "Error: No command specified"
  echo "Usage: $0 \"command\" [working_directory] [output_file]"
  exit 1
fi

# Make command decisive by adding prefix
DECISIVE_COMMAND="DIRECTIVE: Take immediate action without asking follow-up questions. $COMMAND"

# Change to the working directory if specified
if [[ -n "$WORKING_DIR" ]]; then
  echo "Running Claude with command in directory $WORKING_DIR" >&2
  cd "$WORKING_DIR" 2>/dev/null || {
    echo "Error: Failed to change to directory $WORKING_DIR" >&2
    exit 1
  }
else
  echo "Running Claude with command in current directory" >&2
fi

# Create a temporary expect script
TMP_EXPECT_SCRIPT=$(mktemp)
cat > "$TMP_EXPECT_SCRIPT" << 'EOF'
#!/usr/bin/expect -f
set timeout 30

# Get command from first argument
set cmd [lindex $argv 0]

spawn /opt/homebrew/bin/claude --dangerously-skip-permissions $cmd
expect {
  "^" {
    send "\x04"
    expect eof
  }
  timeout {
    puts "Timeout reached, sending Ctrl+D"
    send "\x04"
    expect eof
  }
}
EOF

# Make the expect script executable
chmod +x "$TMP_EXPECT_SCRIPT"

# Execute the expect script and capture the output
"$TMP_EXPECT_SCRIPT" "$DECISIVE_COMMAND" > "$OUTPUT_FILE" 2>claude_error.log

# Capture exit code
EXIT_CODE=$?

# Clean up the temporary expect script
rm -f "$TMP_EXPECT_SCRIPT"

# Check for errors
if [[ $EXIT_CODE -ne 0 ]]; then
  echo "Command failed with exit code $EXIT_CODE" >&2
  echo "Error log:" >&2
  cat claude_error.log >&2
else
  echo "Command completed successfully. Output saved to $OUTPUT_FILE" >&2
fi

# Optional: If you want the script to output the Claude results directly
if [[ $EXIT_CODE -eq 0 ]]; then
  cat "$OUTPUT_FILE"
fi

exit $EXIT_CODE