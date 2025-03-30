# Running Gaana AI Assistant

This document provides detailed instructions for running the Gaana AI Assistant in different modes.

## Before Running

Before starting the application, make sure to terminate any existing Node.js processes to avoid port conflicts:

```bash
pkill -f "node" || true
```

## Running Modes

### 1. Web Application Mode

To run Gaana AI Assistant as a web application:

```bash
npm start
```

This will start the Express server on port 3000 (or the port specified in your `.env` file). You can access the application by opening a web browser and navigating to:

```
http://localhost:3000
```

### 2. Desktop Application Mode

To run Gaana AI Assistant as a desktop application:

```bash
npm run desktop
```

This will:
1. Start the backend server
2. Launch the Electron application that loads the server content
3. Provide native desktop integration (system tray, menu, notifications)

The desktop application provides additional features like:
- System tray with quick access menu
- Custom application menu with shortcuts
- Native dark mode integration
- File system access for project management
- Desktop permissions for automation

### 3. Development Mode

For development purposes with auto-restart on file changes:

```bash
npm run dev
```

This uses nodemon to watch for file changes and automatically restart the server.

## Troubleshooting

### Port Conflicts

If you encounter an error like `EADDRINUSE: address already in use :::3000`, it means the port is already being used by another application. To fix this:

1. Kill any running Node.js processes:
   ```bash
   pkill -f "node"
   ```
   
2. Alternatively, change the port in your `.env` file:
   ```
   PORT=3001
   ```

### Missing Dependencies

If you encounter errors related to missing dependencies:

```bash
npm install
```

### Application Not Loading

If the application doesn't load properly:

1. Check the server logs for errors
2. Verify that the server is running on the expected port
3. Check that all required environment variables are set in your `.env` file

### Permissions Issues

If you're experiencing permissions issues in desktop mode:

1. Restart the application
2. Accept any permission prompts that appear
3. Check system preferences for permissions related to:
   - Accessibility (for desktop control)
   - Files and Folders (for project management)

## Command Reference

| Command | Description |
|---------|-------------|
| `npm start` | Run web application |
| `npm run dev` | Run with auto-restart for development |
| `npm run desktop` | Run as desktop application |
| `npm run package` | Build desktop application for distribution |
| `npm run package:mac` | Build for macOS only |
| `npm run package:win` | Build for Windows only |

## Environment Configuration

Make sure your `.env` file includes all necessary configuration:

```
PORT=3000
TWILIO_ACCOUNT_SID=your_twilio_sid
TWILIO_AUTH_TOKEN=your_twilio_token
TWILIO_PHONE_NUMBER=your_twilio_phone
AI_PROVIDER_API_KEY=your_ai_api_key
``` 