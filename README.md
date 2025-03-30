Video Link since it didn't appear in the submission link: https://vimeo.com/1070804166?share=copy


# Twilio Voice AI Agent

A Node.js Express application that uses Twilio for handling voice calls with AI capabilities to modify code through voice commands.

## Features

- TwiML generation for voice responses
- Speech input processing with AI interpretation
- Code modification via voice commands
- Shell command execution via voice
- Outbound call initiation
- Call recording with transcription
- Modular architecture with controllers and routes
- **NEW**: Inbound calls from authorized numbers
- **NEW**: Multiple project support with project switching
- **NEW**: Advanced AI processing with Perplexity AI integration
- **NEW**: Project directory selection through web interface
- **NEW**: Restriction of modifications to application code directory

## Project Structure

```
.
├── config/
│   └── twilio.js             # Twilio configuration
├── controllers/
│   ├── aiController.js       # AI-related functionality
│   ├── callController.js     # Call-related functionality
│   ├── projectController.js  # Project management functionality
│   └── transcriptionController.js # Transcription-related functionality
├── middleware/
│   └── errorHandler.js       # Global error handling
├── routes/
│   ├── aiRoutes.js           # AI-related routes
│   ├── callRoutes.js         # Call-related routes
│   └── transcriptionRoutes.js # Transcription-related routes
├── public/
│   └── directory-selector.html # Web interface for selecting project directories
├── data/
│   ├── projects.json         # Stored project information
│   └── active_project.json   # Currently active project
├── utils/
│   └── logUtils.js           # Logging utilities
├── .env                      # Environment variables (create from .env.example)
├── .gitignore                # Git ignore configuration
├── ngrok.yml                 # Ngrok configuration
├── package.json              # Dependencies and scripts
├── README.md                 # Project documentation
└── server.js                 # Main application entry point
```

## Setup

1. Clone this repository
2. Install dependencies:
   ```
   npm install
   ```
3. Create a `.env` file based on the provided `.env.example` file:
   ```
   cp .env.example .env
   ```
4. Update the `.env` file with your Twilio credentials and configuration
5. Set up ngrok for local development:
   ```
   ngrok http 3000
   ```
6. Update your `.env` file with the ngrok URL:
   ```
   SERVER_URL=https://your-ngrok-url.ngrok.app
   ```
7. Configure your Twilio phone number to use your webhook URL for voice calls:
   - Go to your [Twilio Phone Numbers](https://www.twilio.com/console/phone-numbers/incoming)
   - Select your phone number
   - Set the Voice webhook URL to `https://your-ngrok-url.ngrok.app/voice`
   - Save your changes

## Environment Variables

- `TWILIO_ACCOUNT_SID`: Your Twilio account SID
- `TWILIO_AUTH_TOKEN`: Your Twilio auth token
- `TWILIO_PHONE_NUMBER`: Your Twilio phone number
- `PORT`: The port to run the server on (default: 3000)
- `SERVER_URL`: Your server's public URL (ngrok URL)
- `DEFAULT_PHONE_NUMBER`: Phone number to call for voice AI interactions
- `AI_ENDPOINT`: Endpoint for processing AI requests (defaults to local)
- `PERPLEXITY_API_KEY`: Your Perplexity API key for advanced AI processing
- `RESTRICTED_PROJECTS`: Comma-separated list of directory names that should be protected from modification
- `DEFAULT_PROJECT_PATH`: Fallback project path if no active project is set
- `USE_CLAUDE_CLI`: Whether to use the Claude CLI (true/false)
- `CLAUDE_MODEL`: The Claude model to use (e.g., claude-3-sonnet-20240229)

## Authorized Numbers

The system only allows calls from authorized phone numbers for security. To add your number to the authorized list:

1. Open `controllers/callController.js`
2. Add your number to the `AUTHORIZED_NUMBERS` array at the top of the file
3. Make sure to include the full number with country code (e.g., `+14085551234`)

## Available Projects

The system is now configured to work with multiple projects:

1. **Gaana Project**: Music-related project located at `/Users/kousthubhveturi/Desktop/gaana`
2. **Game Project**: Eclipse game project located at `/Users/kousthubhveturi/eclipse-workspace/YOURGAMENAMEHERE`

To switch between projects during a call, simply say:
- "Switch to game project"
- "Use gaana project" 
- "Change to game project"

## Perplexity AI Integration

The system now integrates with Perplexity AI to provide more advanced natural language understanding:

1. **Flexible Voice Commands**: Instead of limited predefined commands, you can now give more natural instructions like "I want to add a new method to Player.java that calculates scores"
2. **Context-Aware Processing**: The AI analyzes the current project context to better interpret your commands
3. **Intelligent Code Generation**: For code creation and modification tasks, the AI can generate appropriate code based on your description

### Setting Up Perplexity Integration

1. Get a Perplexity API key from the [Perplexity website](https://www.perplexity.ai/)
2. Add your API key to the `.env` file:
   ```
   PERPLEXITY_API_KEY=your_api_key_here
   ```
3. Restart the server to activate Perplexity integration

### How It Works

When you make a voice command, the system:
1. Sends your speech transcript to Perplexity AI along with project context
2. Perplexity analyzes your intent and determines the specific action needed
3. The system executes the action (file creation, modification, command execution, etc.)
4. You receive notifications (SMS and/or voice) with the results

If Perplexity integration fails or no API key is provided, the system falls back to the rule-based command parsing.

## Using the System

### Method 1: Call the Twilio Number

1. Call your Twilio phone number from an authorized phone
2. The system will answer and prompt you for commands
3. Speak "use game project" to switch to your Eclipse game project
4. Speak your code modification commands
5. The system will execute your commands and respond with the results

### Method 2: Initiate Call from System

To initiate a call to the configured phone number:

```
curl -X POST http://localhost:3000/initiate-call
```

Or specify a different number:

```
curl -X POST -H "Content-Type: application/json" -d '{"phoneNumber":"+1234567890"}' http://localhost:3000/initiate-call
```

## Voice Commands

When interacting with the voice agent, you can use the following types of commands:

### With Perplexity AI Integration (Natural Language)

- **Code creation**: "Create a new Java class that handles user authentication with methods for login and logout"
- **Code modification**: "Add a method to the Player class that calculates the total score based on achievements"
- **File operations**: "Find all files related to user interface and show me their contents"
- **Project context**: "Tell me what this project is about and what files are most important"

### Without Perplexity AI (Standard Commands)

#### Project Management

- **Switch projects**: "Switch to game project" or "Use gaana project"
- **Check current project**: "Which project am I using?" or "What's the current project?"

#### Code Modification Commands

- **Create a file**: "Create file filename.java with public class ClassName {}"
- **Edit a file**: "Edit file Player.java to add a new method"
- **Delete a file**: "Delete file temp.txt"

#### Shell Commands

- **Run a command**: "Run command ls -la"
- **Execute git**: "Execute git status"

## API Endpoints

### Call Endpoints

#### `/voice` (POST)
Handles incoming calls to your Twilio number.

#### `/twiml` (POST)
Generates a TwiML response for outgoing calls.

#### `/process-speech` (POST)
Processes speech input from Twilio, sends it to the AI service, and responds with the action taken.

#### `/recording-complete` (POST)
Handles the completion of a call recording.

#### `/recording-status` (POST)
Receives updates about recording status from Twilio.

#### `/initiate-call` (POST)
Initiates an outbound call to a specified phone number.

Request body:
```json
{
  "phoneNumber": "+1234567890"
}
```

#### `/status/:callSid` (GET)
Gets the status and details of a specific call.

### AI Endpoints

#### `/ai/process` (POST)
Processes speech input and performs actions like code modification or command execution.

Request body:
```json
{
  "speech": "Create file hello.js with console.log('Hello World');",
  "callerNumber": "+14085551234"
}
```

### Transcription Endpoints

#### `/transcriptions/webhook` (POST)
Receives transcription data from Twilio.

#### `/transcriptions/request/:recordingSid` (POST)
Requests a transcription for a specific recording.

#### `/transcriptions/call/:callSid` (GET)
Gets a list of transcriptions for a specific call.

## Troubleshooting

1. **Twilio can't reach your webhook**: Make sure ngrok is running and your SERVER_URL is correctly set
2. **Voice AI not processing commands**: Check the server logs for errors in the AI controller
3. **Call not initiating**: Verify your Twilio credentials and phone number are correctly set
4. **Unauthorized caller**: Make sure your phone number is in the `AUTHORIZED_NUMBERS` array

## Security Considerations

Be careful when deploying this system, as it allows voice commands to modify files and execute shell commands. In a production environment, you should implement:

1. Authentication for the API endpoints
2. Validation and sanitization of voice commands
3. Restrictions on which files can be modified and which commands can be executed
4. Secure your Twilio webhook URLs with signatures validation

# Twilio Voice Assistant with AI Desktop Control

This project enables voice-controlled coding and remote desktop control through a combination of Twilio's voice API, AI language models, and robotjs for desktop automation.

## Features

- **Voice-Controlled Coding**: Call your Twilio number to edit code and manage projects using voice commands
- **AI Desktop Control**: Control your desktop remotely using AI-driven commands
- **Natural Language Processing**: Uses Perplexity AI to interpret natural language commands 
- **Web Interface**: Browser-based remote desktop control with live screen capture
- **Secure Authentication**: IP-based and token-based authentication for remote access

## Remote Desktop Control

The remote desktop control feature allows you to:

1. Control your computer through voice commands on a phone call
2. Access a web interface to see your desktop and issue commands
3. Use AI to interpret natural language commands and translate them to mouse/keyboard actions

### Getting Started with Remote Desktop Control

1. Set the environment variable `ENABLE_REMOTE_CONTROL=true` in your `.env` file
2. Configure other remote control settings in your `.env` file (see below)
3. Start the server: `npm start` 
4. Access the remote control interface at `http://localhost:<PORT>/remote`

### Environment Variables for Remote Control

```
# Remote Desktop Control Configuration
ENABLE_REMOTE_CONTROL=true
REMOTE_CONTROL_PORT=3001  # Optional separate port
REMOTE_CONTROL_SECURE_ONLY=true
REMOTE_CONTROL_MAX_CONNECTIONS=1
REMOTE_CONTROL_SESSION_TIMEOUT=300

# Remote Desktop Authentication
REMOTE_CONTROL_AUTH_REQUIRED=true
REMOTE_CONTROL_AUTH_TOKEN=your_secret_token_here
REMOTE_CONTROL_ALLOWED_IPS=127.0.0.1,::1

# AI Desktop Control
REMOTE_CONTROL_AI_ALLOW_CONTROL=true
REMOTE_CONTROL_RESTRICTED_COMMANDS=shutdown,format
REMOTE_CONTROL_MAX_EXECUTION_TIME=2000

# Screen Capture Settings
REMOTE_CONTROL_SCREEN_QUALITY=80
REMOTE_CONTROL_SCREEN_FPS=10
REMOTE_CONTROL_SCREEN_WIDTH=1280
REMOTE_CONTROL_SCREEN_HEIGHT=720

# Remote Desktop Logging
REMOTE_CONTROL_LOGGING=true
REMOTE_CONTROL_LOG_ACTIONS=true
REMOTE_CONTROL_LOG_SCREENSHOTS=false
REMOTE_CONTROL_LOG_PATH=./logs/remote
```

### Voice Commands for Desktop Control

Call your Twilio number and use these example commands:

- "Control my desktop"
- "Open Chrome browser"
- "Click on the Start menu"
- "Type hello world"
- "Press Control+C"
- "Open the file menu"

### Web Interface Commands

In the web interface, you can:

1. Enter natural language commands in the text box
2. Use the provided keyboard shortcuts
3. Click directly on the screen to control the mouse
4. Execute individual actions from proposed plans

## Installation

1. Clone this repository
2. Install dependencies: `npm install`
3. Create a `.env` file with your configuration (see example above)
4. Install required system dependencies for robotjs (see https://robotjs.io/)
5. Start the server: `npm start`

## Security Considerations

- Only enable remote control on secure networks
- Always use authentication when exposed to public networks
- Consider using a VPN for remote access
- Limit connections and restrict commands as needed
- Review logs regularly for unauthorized access attempts

## Dependencies

- [Express](https://expressjs.com/): Web server framework
- [Twilio](https://www.twilio.com/): Voice call integration
- [Socket.io](https://socket.io/): Real-time communication
- [RobotJS](https://robotjs.io/): Desktop automation
- [Perplexity API](https://www.perplexity.ai/): AI language processing
- [screenshot-desktop](https://www.npmjs.com/package/screenshot-desktop): Screen capture

## License

This project is licensed under the MIT License.

# Gaana AI Assistant

A powerful desktop application for managing projects, handling phone calls, and controlling your desktop with voice commands and AI integration.

## Features

- **Modern Mac-Style UI**: Beautiful, responsive interface with animations and dark mode support
- **Project Management**: Add, remove, and set default projects with automatic path validation
- **Phone Call Management**: Handle incoming and outgoing calls with Twilio integration
- **Remote Desktop Control**: Control your desktop with voice commands or through phone calls
- **Voice Commands**: Execute commands and automate tasks using natural language processing
- **Desktop App**: Standalone Electron application with native OS integration
- **Dark Mode Support**: Toggle between light and dark themes or use system preference

## Screenshots

![Dashboard](docs/screenshots/dashboard.png)
*Main dashboard with project cards and status indicators*

![Project Management](docs/screenshots/projects.png)
*Project management interface with add/remove functionality*

![Remote Control](docs/screenshots/remote.png)
*Remote desktop control interface*

## Installation

### Prerequisites

- Node.js 14.x or higher
- npm 6.x or higher

### Install Dependencies

```bash
npm install
```

### Development Mode

```bash
npm run dev
```

### Desktop App Mode

```bash
npm run desktop
```

### Build for Distribution

```bash
npm run package
```

This will generate executables for macOS and Windows in the `dist` folder.

## Configuration

### Environment Variables

Create a `.env` file in the root directory with the following variables:

```
PORT=3000
TWILIO_ACCOUNT_SID=your_twilio_sid
TWILIO_AUTH_TOKEN=your_twilio_token
TWILIO_PHONE_NUMBER=your_twilio_phone
AI_PROVIDER_API_KEY=your_ai_api_key
```

## Technical Details

- **Frontend**: HTML, CSS, JavaScript with modern animations and UI effects
- **Backend**: Node.js with Express
- **Desktop App**: Electron with native OS integration
- **Voice Integration**: Twilio API for phone call handling
- **AI Integration**: Natural language processing for voice commands
- **Desktop Control**: System automation and task management

## License

MIT License

## Acknowledgements

- Font Awesome for icons
- Electron for desktop app wrapper
- Twilio for voice call integration
- And all other open-source projects that made this possible 

## Voice-Controlled Code Assistant with Claude

This application enables voice-controlled code editing and project management through Twilio voice calls, powered by Claude AI.

### Features

- Voice-controlled code editing: Create, modify, and delete files in your codebase
- Execute commands in your project
- Query information about your codebase
- List files and switch between projects
- Send code modifications for review before execution
- Confirm or reject changes via SMS

### Claude Code Integration

The application leverages Claude's capabilities for code understanding and generation. You can use different modes:

- **Interactive Mode**: Code changes require confirmation before execution
- **Non-Interactive Mode**: Automatically execute code changes without confirmation

To activate non-interactive mode, include "non-interactive" in your voice command:
- "Use non-interactive mode to create a new file called example.js"
- "In non-interactive mode, modify the server.js file to add error handling"

### Getting Started

1. Clone this repository
2. Install dependencies with `npm install`
3. Copy `.env.example` to `.env` and update with your configuration
4. Start the server with `npm start`
5. Expose your local server with ngrok: `ngrok http 5001`
6. Update your Twilio webhook URL to your ngrok URL + `/voice`

### Environment Variables

Required environment variables:

```
# Server Configuration
PORT=5001
SERVER_URL=your_ngrok_url_here

# Twilio Configuration
TWILIO_ACCOUNT_SID=your_twilio_sid
TWILIO_AUTH_TOKEN=your_twilio_token
TWILIO_PHONE_NUMBER=your_twilio_phone_number
AUTHORIZED_NUMBERS=comma,separated,phone,numbers

# Claude AI Configuration
CLAUDE_API_KEY=your_claude_api_key
CLAUDE_MODEL=claude-3-haiku-20240307
CLAUDE_API_VERSION=2023-06-01
```

### Voice Commands

Examples of voice commands:

- "Create a new file called example.js"
- "Modify the server.js file to add error handling for database connections"
- "List all files in the current directory"
- "Run the command npm test"
- "Switch to project frontend"

### Non-Interactive Mode

To use Claude Code in non-interactive mode, which will execute changes without confirmation:

1. Start your command with "In non-interactive mode" or include "non-interactive" in your request
2. The system will skip the confirmation step and execute the change immediately
3. You'll receive a notification of the completed action

### Confirming Changes

When not in non-interactive mode, code modifications and command executions require confirmation:

1. You'll receive an SMS with the proposed change and a Change ID
2. Reply to the SMS with "confirm" or "yes" to execute the change
3. Reply with "reject" or "no" to cancel the change

### Architecture

The application consists of:

- **callController**: Handles Twilio voice call integration
- **aiController**: Processes speech input and manages the staging workflow
- **claudeService**: Integrates with Claude API for code understanding and generation
- **Express routes**: Exposes the necessary endpoints for webhooks and API access

### Security Considerations

- Always use HTTPS for production deployments
- Restrict access to authorized phone numbers only
- Review all code changes before confirmation
- Use environment variables for sensitive configuration 

## Using the Directory Selector

The system now includes a web interface for selecting and managing project directories:

1. Start the server:
   ```
   npm start
   ```

2. Open your browser to `http://localhost:3000/directory-selector.html`

3. From this interface, you can:
   - View currently configured projects
   - Add new project directories
   - Set the active project that will be used for voice commands
   - See the structure of selected projects

The active project selected through this interface will be used for all voice commands. The system includes safety features to prevent modification of the application code itself, with the `gaana` directory now restricted.

## Restricted Projects

For security, certain directories are restricted from modification:

1. The application code directory (`gaana`) is protected by default
2. You can add additional restricted directories in the `.env` file:
   ```
   RESTRICTED_PROJECTS=gaana,other_important_dir
   ``` 
