# Claude Code Workflow for Gaana

This document explains the workflow for voice-controlled coding with Claude Code integration in the Gaana project.

## Overview

The workflow allows you to:
1. Call a Twilio number
2. Give voice commands to Claude
3. Claude processes your instructions and makes changes to the codebase

## Components

The integration consists of these key components:

1. **Twilio Voice Integration**: Handles incoming calls and transcribes speech to text
2. **Perplexity API**: Used for accurate speech recognition and transcription
3. **Claude Code Integration**: Enables Claude to access and modify the entire codebase with elevated permissions
4. **Project Management**: Tracks project information and allows switching between projects

## Workflow Steps

1. **User calls Twilio number**
   - The call is received by the Twilio webhook
   - The user is greeted and asked for their voice command

2. **User selects a project**
   - Say "project NUMBER" or "use project NUMBER" 
   - The system confirms your selection
   - Projects are assigned numbers automatically in `projects_config.json`

3. **User gives a voice command**
   - The speech is transcribed by Twilio
   - The transcription is sent to the server

4. **Server processes the command**
   - The command is enhanced with project context
   - The command is sent to Claude Code with dangerous permissions
   - Claude analyzes the codebase and determines how to implement the changes

5. **Claude makes the changes**
   - Claude has full access to read and modify the codebase
   - Changes are executed directly without requiring confirmation
   - Results are returned to the server

6. **User receives feedback**
   - The system provides feedback on what was done
   - For calls, this is delivered via voice response
   - For API requests, this is returned as JSON

## Voice Command Examples

You can use natural language to describe what you want:

```
"Project 1, create a multilayer perceptron class in C++"
"Project 2, fix the bug in the login function"
"Project 1, refactor the database connection code to use async/await"
"Project 2, analyze the codebase and suggest improvements"
```

## Server Restart Procedure

If you need to restart the server:

```bash
cd /Users/kousthubhveturi/Desktop/gaana && pkill -f "node" || true && PORT=5001 npm start
```

Or use the provided start script:

```bash
cd /Users/kousthubhveturi/Desktop/gaana && ./start.sh
```

## Troubleshooting

**Project not found:**
- Make sure the project exists in the `projects` directory
- Run `node scripts/update-projects.js` to update project configuration
- Check the `projects_config.json` file for correct project information

**Claude cannot modify files:**
- Ensure Claude Code integration is working correctly
- Check the dangerous permissions flag is being used
- Verify the user has appropriate permissions on the files

**Server not responding:**
- Make sure the server is running on port 5001
- Check for any error messages in the console
- Restart the server using the command above

## Security Considerations

This integration uses the `--dangerously-skip-permissions` flag with Claude, which gives it full access to the codebase. Use this with caution and only in trusted environments.