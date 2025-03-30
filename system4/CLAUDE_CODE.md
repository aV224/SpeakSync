# Claude Code for Gaana

This document explains how to use the Claude Code functionality in the Gaana project, which allows Claude to read and modify the entire codebase with expanded permissions.

## Overview

Claude Code provides AI-powered code generation and modification with full access to the codebase. It enables:

1. Reading any file in the codebase
2. Writing/modifying any file in the codebase
3. Executing shell commands with elevated permissions
4. Indexing and understanding the entire project structure

## Setup

The Claude Code functionality is already integrated into the Gaana project. To use it:

1. Make sure Claude is properly configured in your environment
2. The Claude CLI binary should be installed at `/opt/homebrew/bin/claude` (configurable)
3. Start the Gaana server which exposes the Claude Code API endpoints

## Using the CLI

The fastest way to use Claude Code is through the included CLI tool:

```bash
# Interactive mode (recommended)
node claude-code-cli.js -i

# Direct prompt
node claude-code-cli.js -p "Analyze the project structure"

# From prompt file
node claude-code-cli.js -f my-prompt.txt

# With debug information
node claude-code-cli.js -i -d
```

In interactive mode, type your prompt and then enter `:q` on a new line to submit.

## API Endpoints

The following API endpoints are available for Claude Code:

- `POST /api/claude-code/execute` - Execute Claude with full codebase access
  ```json
  {
    "prompt": "Analyze the project structure",
    "context": { "projectName": "Gaana" }
  }
  ```

- `POST /api/claude-code/command` - Execute a shell command with elevated permissions
  ```json
  {
    "command": "ls -la",
    "workingDir": "/path/to/working/dir"
  }
  ```

- `POST /api/claude-code/read-file` - Read a file with elevated permissions
  ```json
  {
    "filePath": "server.js"
  }
  ```

- `POST /api/claude-code/write-file` - Write a file with elevated permissions
  ```json
  {
    "filePath": "example.js",
    "content": "console.log('Hello, world!');"
  }
  ```

- `GET /api/claude-code/index` - Index the codebase and return structure

## Shell Script

For advanced usage, you can directly use the shell script:

```bash
./scripts/claude-code.sh --prompt "Analyze the codebase"
# or
./scripts/claude-code.sh --prompt-file my-prompt.txt
```

## Security Considerations

**IMPORTANT**: Claude Code runs with elevated permissions and can modify any file in the codebase. This functionality should be:

1. Only used in development environments
2. Not exposed in production
3. Limited to trusted users

The `--dangerously-skip-permissions` flag is used internally to grant Claude full access to the codebase. This is necessary for the functionality to work, but also means Claude can modify any file it can access.

## Example Usage

Here are some examples of what you can do with Claude Code:

1. **Code Understanding**: "Explain how the project structure works"
2. **Adding Features**: "Add a new endpoint that does X"
3. **Refactoring**: "Refactor the file handling code to be more modular"
4. **Bug Fixing**: "Fix the issue with route parameters not being parsed correctly"
5. **Documentation**: "Generate comprehensive documentation for the API endpoints"

## Troubleshooting

- Make sure Claude CLI is installed and accessible
- Check that the scripts have executable permissions (`chmod +x scripts/claude-code.sh`)
- Ensure the temporary directory is writable
- Check server logs for any error messages