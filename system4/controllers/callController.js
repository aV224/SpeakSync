// Import required dependencies
const twilio = require('twilio');
const axios = require('axios');
const twilioConfig = require('../config/twilio');
const path = require('path');
const fs = require('fs');
const perplexityConfig = require('../config/perplexity'); // Import Perplexity configuration
const remoteConfig = require('../config/remoteControl'); // Import Remote Control configuration
const projectController = require('../controllers/projectController'); // Import project controller
const log = require('electron-log'); // Use electron-log for consistent logging

// List of authorized phone numbers
// Temporarily accept any format of these numbers for testing
const AUTHORIZED_NUMBERS = [
  '+14086234845', // Your personal number
  '14086234845',  // Without + sign
  '4086234845',   // Just the digits
  '+15102913634', // Your Twilio number (for testing)
  '15102913634',  // Without + sign
  '5102913634',   // Just the digits
  // Add more authorized numbers as needed
];

// Store current call state for each caller
const callerStates = {};

// Helper function to normalize phone numbers for comparison
function normalizePhoneNumber(phone) {
  if (!phone) return null;
  // Remove all non-digits
  const digits = phone.replace(/\D/g, '');
  // For US numbers, ensure 10 or 11 digits (with or without country code)
  if (digits.length >= 10) {
    return digits.slice(-10); // Get the last 10 digits
  }
  return null;
}

// Controller for handling call-related operations
const callController = {
  // Generate TwiML for incoming calls
  generateTwiml: (req, res) => {
    try {
    const twiml = new twilio.twiml.VoiceResponse();
    
    // Get the caller's phone number
    const callerNumber = req.body.From;
      console.log('Incoming call from:', callerNumber || 'Unknown');
      
      // Normalize the caller number for comparison
      const normalizedCaller = normalizePhoneNumber(callerNumber);
      console.log('Normalized caller:', normalizedCaller);
      
      // For testing purposes, skip authorization check temporarily
      const skipAuth = true;
      
      // Check if the caller is authorized
      const normalizedAuthorized = AUTHORIZED_NUMBERS.map(num => normalizePhoneNumber(num));
      console.log('Authorized numbers (normalized):', normalizedAuthorized);
      
      if (!skipAuth && (!normalizedCaller || !normalizedAuthorized.includes(normalizedCaller))) {
        console.log('Unauthorized caller:', callerNumber || 'No number provided');
        twiml.say('Sorry, your number is not authorized to use this service.');
        twiml.hangup();
      } else {
        console.log('Authorized caller or auth check skipped');
        
        // Simple, direct greeting focused on code editing
        let greeting = 'Hello, this is your voice-controlled code assistant powered by Claude. I can help you modify your codebase through voice commands.';
        
        greeting += ' You can say commands like "create a new file", "modify this function", or "list files in the current directory".';
        
        twiml.say({
          voice: 'alice'
        }, greeting);
      
      twiml.gather({
        input: 'speech',
        action: '/process-speech',
        method: 'POST',
        speechTimeout: 'auto',
          maxSpeechTime: 20,  // Allow up to 20 seconds of speech
          language: 'en-US',
          speechModel: 'enhanced',  // Use enhanced speech model if available
          profanityFilter: false,   // Don't filter out profanity
          enhanced: true
        });
        
        // Add a fallback if no input is received
        twiml.say({
          voice: 'alice'
        }, 'I didn\'t hear anything. Please call back when you\'re ready to speak.');
    }
    
    // Set response type to XML and send the TwiML
    res.type('text/xml');
    res.send(twiml.toString());
    } catch (error) {
      console.error('==== ERROR IN GENERATE TWIML ====');
      console.error(error);
      
      // Create a simple error response
      const twiml = new twilio.twiml.VoiceResponse();
      twiml.say('Sorry, an error occurred in the application. Please try again later.');
      twiml.hangup();
      
      res.type('text/xml');
      res.send(twiml.toString());
    }
  },

  // Handle incoming calls to the Twilio number
  handleIncomingCall: async (req, res) => {
    try {
      // Log more detailed information
      console.log('=== TWILIO WEBHOOK TRIGGERED ===');
      console.log('Headers:', JSON.stringify(req.headers));
    console.log('Incoming call request body:', JSON.stringify(req.body));
      console.log('Query params:', JSON.stringify(req.query));
      console.log('Caller Number:', req.body.From || 'No caller number provided');
      console.log('Call SID:', req.body.CallSid || 'No CallSid provided');
    
    // Check if it's the trial announcement call
    if (req.body.AccountSid && !req.body.Digits && !req.body.From) {
      // This might be the trial announcement interruption
      const twiml = new twilio.twiml.VoiceResponse();
      
      // Press a digit automatically to bypass the trial announcement
      // The '1' represents pressing the 1 key
      twiml.play({
        digits: '1'
      });
      
      // After bypassing, gather speech from user
        let greeting = 'Hello, this is your voice-controlled code assistant powered by Claude.';
        greeting += ' I can help you modify code and manage your projects through voice commands.';
      
      twiml.say(greeting);
      
      twiml.gather({
        input: 'speech',
        action: '/process-speech',
        method: 'POST',
        speechTimeout: 'auto',
        language: 'en-US'
      });
      
      res.type('text/xml');
      return res.send(twiml.toString());
    }
    
      // Get the caller number
      const callerNumber = req.body.From;
      const normalizedCaller = normalizePhoneNumber(callerNumber);
      
      // Start new call flow with project selection
      const twiml = new twilio.twiml.VoiceResponse();
      
      // Scan for projects first 
      const projects = await projectController.getAllProjects();
      
      if (!projects || projects.length === 0) {
        // No projects found, inform caller
        twiml.say({
          voice: 'alice'
        }, 'No projects are currently available. Please import or create a project first through the web interface.');
        twiml.hangup();
      } else {
        // Initialize caller state for this call
        callerStates[normalizedCaller] = {
          callSid: req.body.CallSid,
          state: 'project_selection',
          projects: projects,
          selectedProject: null
        };
        
        // Offer project selection
        twiml.say({
          voice: 'alice'
        }, `Hello, I found ${projects.length} project${projects.length > 1 ? 's' : ''} in the system. Each project has been assigned a number. Please select a project by saying its number.`);
        
        // Pause briefly
        twiml.pause({ length: 1 });
        
        // List projects with numbers
        let projectList = '';
        projects.forEach((project) => {
          projectList += `Project ${project.number}: ${project.name}. `;
        });
        
        twiml.say({
          voice: 'alice'
        }, projectList);
        
        // Listen for project selection
        twiml.gather({
          input: 'speech',
          action: '/project-selection',
          method: 'POST',
          speechTimeout: 'auto',
          maxSpeechTime: 10,
          language: 'en-US',
          speechModel: 'enhanced',
          profanityFilter: false,
          enhanced: true
        });
        
        // Add a fallback if no input is received
        twiml.say({
          voice: 'alice'
        }, 'I didn\'t hear a project selection. Please call back and try again.');
        twiml.hangup();
      }
      
      res.type('text/xml');
      res.send(twiml.toString());
    } catch (error) {
      console.error('==== ERROR IN HANDLE INCOMING CALL ====');
      console.error(error);
      
      // Create a simple error response
      const twiml = new twilio.twiml.VoiceResponse();
      twiml.say('Sorry, an error occurred in the application. Please try again later.');
      twiml.hangup();
      
      res.type('text/xml');
      res.send(twiml.toString());
    }
  },

  // Handle project selection from caller
  handleProjectSelection: async (req, res) => {
    try {
      // Log the complete request for debugging
      console.log('Project selection request:', JSON.stringify(req.body));
  
      // Extract speech result and caller info
      const speechResult = req.body.SpeechResult;
      const callerNumber = req.body.From;
      const normalizedCaller = normalizePhoneNumber(callerNumber);
      
      // Get caller state
      const callerState = callerStates[normalizedCaller];
      
      if (!callerState || callerState.state !== 'project_selection') {
        console.error('Invalid caller state for project selection');
        const twiml = new twilio.twiml.VoiceResponse();
        twiml.say('Sorry, there was an error with your project selection. Please call back.');
        twiml.hangup();
        res.type('text/xml');
        return res.send(twiml.toString());
      }
      
      // Try to extract a number from the speech result
      const numberMatch = speechResult.match(/\b(\d+)\b/);
      let selectedProject = null;
      
      if (numberMatch) {
        const projectNumber = parseInt(numberMatch[1], 10);
        // Find the project with this number
        selectedProject = callerState.projects.find(p => p.number === projectNumber);
      } else {
        // Try to match project name
        const projectName = speechResult.trim().toLowerCase();
        selectedProject = callerState.projects.find(
          p => p.name.toLowerCase().includes(projectName)
        );
      }
      
      // Check if we have a valid project selection
      if (selectedProject) {
        // Update caller state
        callerState.state = 'command_input';
        callerState.selectedProject = selectedProject;
        
        // Set this as the active project
        await projectController.setActiveProjectById(selectedProject.id);
        
        // Create TwiML response
        const twiml = new twilio.twiml.VoiceResponse();
        twiml.say({
          voice: 'alice'
        }, `You've selected project ${selectedProject.number}: ${selectedProject.name}. What would you like me to do with this project?`);
        
        // Gather speech for command
        twiml.gather({
          input: 'speech',
          action: '/process-speech',
          method: 'POST',
          speechTimeout: 'auto',
          maxSpeechTime: 20,
          language: 'en-US',
          speechModel: 'enhanced',
          profanityFilter: false,
          enhanced: true
        });
        
        res.type('text/xml');
        return res.send(twiml.toString());
      } else {
        // Invalid project selection
        const twiml = new twilio.twiml.VoiceResponse();
        twiml.say({
          voice: 'alice'
        }, `I couldn't find project ${speechResult}. Let's try again.`);
        
        // List projects with numbers
        let projectList = '';
        callerState.projects.forEach((project) => {
          projectList += `Project ${project.number}: ${project.name}. `;
        });
        
        twiml.say({
          voice: 'alice'
        }, projectList);
        
        // Listen for project selection again
        twiml.gather({
          input: 'speech',
          action: '/project-selection',
          method: 'POST',
          speechTimeout: 'auto',
          maxSpeechTime: 10,
          language: 'en-US',
          speechModel: 'enhanced',
          profanityFilter: false,
          enhanced: true
        });
        
        res.type('text/xml');
        return res.send(twiml.toString());
      }
    } catch (error) {
      console.error('==== ERROR IN PROJECT SELECTION ====');
      console.error(error);
      
      // Create a simple error response
      const twiml = new twilio.twiml.VoiceResponse();
      twiml.say('Sorry, an error occurred while selecting a project. Please try again later.');
      twiml.hangup();
      
      res.type('text/xml');
      res.send(twiml.toString());
    }
  },

  // Process speech input from Twilio
  processSpeech: async (req, res) => {
    try {
    // Log the complete request for debugging
    console.log('Speech processing request:', JSON.stringify(req.body));

    // Extract speech result from the request
    const speechResult = req.body.SpeechResult;
      const confidence = parseFloat(req.body.Confidence || '0');
    const callerNumber = req.body.From || '+14086234845'; // Default to your number if not provided
      const normalizedCaller = normalizePhoneNumber(callerNumber);
    
      console.log(`Speech received from ${callerNumber}: ${speechResult}`);
      console.log(`Speech confidence: ${confidence}`);
    
      // Get caller state to include project context
      const callerState = callerStates[normalizedCaller];
      const selectedProject = callerState?.selectedProject;
    
    // Check if we got a digit press from the trial announcement
    if (req.body.Digits && !speechResult) {
      // This is likely a key press from the trial announcement
      const twiml = new twilio.twiml.VoiceResponse();
      
        let greeting = 'Hello, this is your voice-controlled code assistant powered by Claude. How can I help you modify your code today?';
        
        twiml.say({
          voice: 'alice'
        }, greeting);
      
      twiml.gather({
        input: 'speech',
        action: '/process-speech',
        method: 'POST',
        speechTimeout: 'auto',
          maxSpeechTime: 20,  // Allow up to 20 seconds of speech
          language: 'en-US',
          speechModel: 'enhanced',  // Use enhanced speech model if available
          profanityFilter: false,
          enhanced: true
      });
      
      res.type('text/xml');
      return res.send(twiml.toString());
    }
    
      // Update the state if needed
      if (callerState) {
        callerState.lastSpeech = speechResult;
      }
      
      // Add project context to the speech for Claude
      let enhancedSpeech = speechResult;
      
      if (selectedProject) {
        // Add project context to the command for Claude
        enhancedSpeech = `For project ${selectedProject.number} (${selectedProject.name}) at path "${selectedProject.path}": ${speechResult}`;
        console.log(`Enhanced speech with project context: ${enhancedSpeech}`);
      }
      
      // Create a TwiML response to keep the call active while processing
    const twiml = new twilio.twiml.VoiceResponse();
    
      twiml.say({
        voice: 'alice'
      }, "I'm sending your request to Claude for processing. This may take a moment.");
      
      // Set up a background task to process the speech with Claude
      const processInBackground = async () => {
        try {
          console.log('Sending to Claude terminal:', enhancedSpeech);
          
          // Send speech to AI endpoint
          const aiEndpoint = process.env.AI_ENDPOINT || 'http://localhost:5001/ai/process';
          const response = await axios.post(aiEndpoint, {
            speech: enhancedSpeech,
            callerNumber: callerNumber,
            projectContext: selectedProject ? {
              id: selectedProject.id,
              name: selectedProject.name,
              path: selectedProject.path,
              number: selectedProject.number
            } : null
          }, {
            // Add https configuration to bypass SSL verification issues
            httpsAgent: new (require('https').Agent)({
              rejectUnauthorized: false // Allow self-signed certificates and avoid SSL errors
            }),
            // Set validateStatus to accept all status codes - don't reject on 400/500 errors
            validateStatus: function (status) {
              return true; // Never reject based on status code
            }
          });
          
          // Check if the response contains an error
          if (response.status >= 400) {
            console.log('API returned error status code:', response.status);
            console.log('Error response:', response.data);
            
            // Handle the error gracefully - create a fallback response
            const fallbackResponse = {
              success: true, // Mark as successful to prevent Twilio freezing
              status: 'error_handled',
              message: response.data?.error || 'An error occurred processing your command',
              error: response.data?.error || 'Unknown error',
              errorCode: response.status
            };
            
            // If callbacks are enabled, send the fallback response
            if (process.env.ENABLE_CALLBACKS === 'true') {
              await callController.callbackWithResult(callerNumber, fallbackResponse);
            }
            
            return; // Exit the function
          }
          
          console.log('AI processing result:', response.data);
          
          // Now we could call back using Twilio API to provide status
          if (process.env.ENABLE_CALLBACKS === 'true') {
            await callController.callbackWithResult(callerNumber, response.data);
          }
        } catch (error) {
          console.error('Error processing with AI:', error);
          
          // Create a fallback response even for network/other errors
          const fallbackResponse = {
            success: true, // Mark as successful to prevent Twilio freezing
            status: 'error_handled',
            message: 'There was a technical issue processing your command. Please try again later.',
            error: error.message
          };
          
          // If callbacks are enabled, send the fallback response
          if (process.env.ENABLE_CALLBACKS === 'true') {
            await callController.callbackWithResult(callerNumber, fallbackResponse);
          }
        }
      };
      
      // Start processing in background
      console.log('Processing command in background');
      processInBackground();
      
      // Return TwiML to continue the call
      twiml.say({
        voice: 'alice'
      }, 'Your command is being processed. You can hang up now and I will work on it in the background.');
      
      res.type('text/xml');
      res.send(twiml.toString());
    } catch (error) {
      console.error('==== ERROR IN PROCESS SPEECH ====');
      console.error(error);
      
      // Create a simple error response
      const twiml = new twilio.twiml.VoiceResponse();
      twiml.say('Sorry, an error occurred while processing your speech. Please try again later.');
      
    res.type('text/xml');
    res.send(twiml.toString());
    }
  },

  // Handle recording complete callback
  recordingComplete: (req, res) => {
    // Extract recording data from the request
    const recordingSid = req.body.RecordingSid;
    const recordingUrl = req.body.RecordingUrl;
    const recordingDuration = req.body.RecordingDuration;
    const callSid = req.body.CallSid;
    
    console.log(`Recording complete for call ${callSid}:`);
    console.log(`Recording SID: ${recordingSid}`);
    console.log(`Recording URL: ${recordingUrl}`);
    console.log(`Duration: ${recordingDuration} seconds`);
    
    // Generate response TwiML
    const twiml = new twilio.twiml.VoiceResponse();
    twiml.say('Thank you for your call. Goodbye!');
    twiml.hangup();
    
    // Set response type to XML and send the TwiML
    res.type('text/xml');
    res.send(twiml.toString());
  },

  // Initiate an outbound call
  initiateCall: async (req, res) => {
    try {
      // Get the target phone number from request body or use default
      const toNumber = req.body.phoneNumber || process.env.DEFAULT_PHONE_NUMBER;
      
      // Initiate the call
      const call = await twilioConfig.client.calls.create({
        to: toNumber,
        from: twilioConfig.phoneNumber,
        url: `${process.env.SERVER_URL}/twiml`,
        method: 'POST',
        record: true,
        recordingStatusCallback: `${process.env.SERVER_URL}/recording-status`
      });
      
      console.log('Call initiated with SID:', call.sid);
      res.json({ success: true, callSid: call.sid });
    } catch (error) {
      console.error('Error initiating call:', error);
      res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }
  },

  // Get call status
  getCallStatus: async (req, res) => {
    try {
      const callSid = req.params.callSid;
      
      // Get call details from Twilio
      const call = await twilioConfig.client.calls(callSid).fetch();
      
      res.json({
        success: true,
        callStatus: call.status,
        duration: call.duration,
        direction: call.direction,
        from: call.from,
        to: call.to,
        startTime: call.startTime,
        endTime: call.endTime
      });
    } catch (error) {
      console.error('Error fetching call status:', error);
      res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }
  },

  // Handle call status updates
  handleCallStatus: (req, res) => {
    // Extract call data from the request
    const callSid = req.body.CallSid;
    const callStatus = req.body.CallStatus;
    
    console.log(`Call status update for ${callSid}: ${callStatus}`);
    
    // Send empty response to acknowledge
    res.sendStatus(200);
  },

  // Handle recording status callbacks
  recordingStatus: (req, res) => {
    // Extract recording data from the request
    const recordingSid = req.body.RecordingSid;
    const recordingStatus = req.body.RecordingStatus;
    const recordingUrl = req.body.RecordingUrl;
    
    console.log(`Recording status update for ${recordingSid}: ${recordingStatus}`);
    console.log(`Recording URL: ${recordingUrl}`);
    
    // Send empty response to acknowledge
    res.sendStatus(200);
  },

  // Make a call to update the user about significant changes
  makeUpdateCall: async (phoneNumber, updateMessage) => {
    try {
      // Validate phone number
      if (!phoneNumber || !phoneNumber.match(/^\+\d{10,15}$/)) {
        console.error('Invalid phone number format for update call:', phoneNumber);
        return { success: false, error: 'Invalid phone number format' };
      }
      
      // Create TwiML for the update call
      const twiml = new twilio.twiml.VoiceResponse();
      twiml.say(`Update from your code assistant: ${updateMessage}`);
      twiml.say('Thank you for using the voice code assistant. Goodbye!');
      
      // Ensure the temp directory exists
      const tempDir = path.join(process.cwd(), 'temp');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      
      // Save the TwiML to a file
      const twimlPath = path.join(tempDir, 'update_call.xml');
      fs.writeFileSync(twimlPath, twiml.toString());
      
      // Get the public URL for the TwiML
      const twimlUrl = `${process.env.SERVER_URL || 'http://localhost:3000'}/temp/update_call.xml`;
      
      // Initiate the call
      const call = await twilioConfig.client.calls.create({
        to: phoneNumber,
        from: twilioConfig.phoneNumber,
        url: twimlUrl,
        method: 'GET'
      });
      
      console.log('Update call initiated with SID:', call.sid);
      return { success: true, callSid: call.sid };
    } catch (error) {
      console.error('Error initiating update call:', error);
      return { success: false, error: error.message };
    }
  }
};

module.exports = callController; 