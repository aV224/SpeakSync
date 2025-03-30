const log = require('electron-log');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
// const Anthropic = require('@anthropic-ai/sdk'); // Uncomment when implementing real API calls

// Load Claude API Key from environment variables
const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY;
const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';

/* Uncomment and configure when ready for real API calls
if (!CLAUDE_API_KEY) {
  log.warn('CLAUDE_API_KEY environment variable not set. ClaudeService will use mock data.');
}

const anthropic = new Anthropic({
  apiKey: CLAUDE_API_KEY,
});
*/

const ClaudeService = {
  /**
   * Interprets speech using Claude to determine code editing actions.
   * @param {string} speech - The speech text.
   * @param {object} context - Context object (projectPath, etc.).
   * @returns {Promise<object>} - An object describing the action.
   */
  processSpeechCommand: async (speech, context) => {
    log.info(`Processing speech command: "${speech}" with context:`, context);
    
    if (!CLAUDE_API_KEY) {
      return ClaudeService._mockProcessSpeechCommand(speech, context);
    }
    
    try {
      // Construct prompt for Claude
      const messages = [
        {
          role: "user",
          content: `You are a voice-controlled code assistant that helps modify codebases.
          
Current working directory: ${context.projectPath}
User request: "${speech}"

Determine what action to take based on this voice command. Respond ONLY with a JSON object containing:
- "action": One of ["code_modification", "execute_command", "query", "list_files", "set_project"]
- "details": Object containing relevant parameters for the action
- "explanation": A brief explanation of what this will do

For code modifications:
- details.operation: "create", "modify", "delete"
- details.file: Relative file path
- details.content: For create/modify operations
- details.description: Plain text description

For execute_command:
- details.command: The shell command to run
- details.description: What the command will do

For queries:
- details.query: The query text to answer

For list_files:
- details.directory: Optional directory to list (default: current)

For set_project:
- details.directory: Project directory name`
        }
      ];

      // Call Claude API
      const response = await axios.post(CLAUDE_API_URL, {
        model: "claude-3-haiku-20240307",
        max_tokens: 1024,
        messages: messages
      }, {
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': CLAUDE_API_KEY,
          'anthropic-version': '2023-06-01'
        }
      });
      
      // Extract and parse JSON response
      try {
        const content = response.data.content[0].text;
        const result = JSON.parse(content);
        return {
          success: true,
          ...result
        };
      } catch (parseError) {
        log.error('[ClaudeService] Error parsing Claude response:', parseError);
        return { 
          success: false, 
          error: 'Failed to parse Claude response', 
          action: 'query',
          details: { 
            query: speech,
            rawResponse: response.data.content[0].text.substring(0, 200) + '...'
          }
        };
      }
    } catch (error) {
      log.error('[ClaudeService] Error calling Claude API:', error);
      return { 
        success: false, 
        error: 'Failed to communicate with Claude API: ' + error.message 
      };
    }
  },

  // Mock implementation for testing without API key
  _mockProcessSpeechCommand: async (speech, context) => {
    log.info(`[MOCK] Processing speech: "${speech}"`);
    const lowerSpeech = speech.toLowerCase();
    
    if (lowerSpeech.includes('create file') || lowerSpeech.includes('make file')) {
      const fileNameMatch = lowerSpeech.match(/(?:file|named|called)\s+(\S+\.\S+)/);
      const fileName = fileNameMatch ? fileNameMatch[1] : 'example.js';
      return {
        success: true,
        action: 'code_modification',
        details: {
          operation: 'create',
          file: fileName,
          content: `// File created by voice command\n// "${speech}"\n\n// Add your code here\n`,
          description: `Create a new file named ${fileName}`
        },
        explanation: `Creating a new file: ${fileName}`
      };
    } else if (lowerSpeech.includes('run') || lowerSpeech.includes('execute')) {
      const commandMatch = lowerSpeech.match(/(?:command|execute|run)\s+(.+)/);
      const command = commandMatch ? commandMatch[1] : 'ls -la';
      return {
        success: true,
        action: 'execute_command',
        details: { 
          command: command,
          description: `Running command: ${command}`
        },
        explanation: `Executing command: ${command}`
      };
    } else if (lowerSpeech.startsWith('what') || lowerSpeech.includes('explain') || 
               lowerSpeech.includes('how') || lowerSpeech.includes('tell me')) {
      return {
        success: true,
        action: 'query',
        details: { query: speech },
        explanation: 'Answering your question'
      };
    } else if (lowerSpeech.includes('list files')) {
      return {
        success: true,
        action: 'list_files',
        details: { directory: '.' },
        explanation: 'Listing files in current directory'
      };
    } else if (lowerSpeech.includes('switch to') || lowerSpeech.includes('change project')) {
      const projectMatch = lowerSpeech.match(/(?:to|project)\s+(\w+)/);
      const projectName = projectMatch ? projectMatch[1] : 'default';
      return {
        success: true,
        action: 'set_project',
        details: { directory: projectName },
        explanation: `Switching to project: ${projectName}`
      };
    } else {
      return {
        success: true,
        action: 'query',
        details: { 
          query: speech,
          fallback: true 
        },
        explanation: 'Processing as a general query'
      };
    }
  },

  /**
   * Execute a code modification using Claude Code.
   * @param {object} details - The code modification details.
   * @param {string} projectPath - Project path.
   * @returns {Promise<string>} - Result of the operation.
   */
  executeCodeModification: async (details, projectPath) => {
    log.info(`Executing code modification: ${details.operation} for ${details.file}`);
    
    if (!CLAUDE_API_KEY) {
      // Mock implementation for when API key is not available
      log.info('[MOCK] Simulating code modification execution');
      return `Mock code modification: ${details.operation} ${details.file}`;
    }
    
    try {
      // For actual implementation, call Claude Code API
      // This would vary based on the specifics of your setup
      
      // Example implementation placeholder:
      const messages = [
        {
          role: "user",
          content: `You are Claude Code operating in non-interactive mode.
          
Project path: ${projectPath}
Operation: ${details.operation}
File: ${details.file}
${details.content ? `Content/Changes: ${details.content}` : ''}
${details.description ? `Description: ${details.description}` : ''}

Please execute this code modification and describe what you did.`
        }
      ];
      
      // Call Claude API
      const response = await axios.post(CLAUDE_API_URL, {
        model: "claude-3-opus-20240229",
        max_tokens: 2048,
        messages: messages
      }, {
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': CLAUDE_API_KEY,
          'anthropic-version': '2023-06-01'
        }
      });
      
      return response.data.content[0].text;
    } catch (error) {
      log.error('[ClaudeService] Error executing code modification:', error);
      throw new Error(`Failed to execute code modification: ${error.message}`);
    }
  },

  /**
   * Answers a general query using Claude.
   * @param {string} queryText - The query text.
   * @returns {Promise<string>} - The answer string.
   */
  answerQuery: async (queryText) => {
    log.info(`Answering query: "${queryText}"`);
    
    if (!CLAUDE_API_KEY) {
      // Mock implementation for when API key is not available
      return `This is a mock response to your query: "${queryText}". Please set the CLAUDE_API_KEY environment variable for real responses.`;
    }
    
    try {
      const response = await axios.post(CLAUDE_API_URL, {
        model: "claude-3-haiku-20240307",
        max_tokens: 1024,
        messages: [
          { role: "user", content: queryText }
        ]
      }, {
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': CLAUDE_API_KEY,
          'anthropic-version': '2023-06-01'
        }
      });
      
      return response.data.content[0].text;
    } catch (error) {
      log.error('[ClaudeService] Error answering query:', error);
      return `Sorry, I encountered an error trying to answer your query: ${error.message}`;
    }
  }
};

module.exports = ClaudeService; 