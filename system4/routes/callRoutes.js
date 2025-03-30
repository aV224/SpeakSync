// Import required dependencies
const express = require('express');
const router = express.Router();
const callController = require('../controllers/callController');

// Route for generating TwiML for incoming calls (outbound from our system)
router.post('/twiml', callController.generateTwiml);

// Route for handling incoming calls to the Twilio number
router.post('/voice', callController.handleIncomingCall);

// Route for project selection
router.post('/project-selection', callController.handleProjectSelection);

// Route for processing speech input
router.post('/process-speech', callController.processSpeech);

// Route for handling call status updates
router.post('/call-status', callController.handleCallStatus);

// Route for handling recording complete
router.post('/recording-complete', callController.recordingComplete);

// Route for handling recording status callbacks
router.post('/recording-status', callController.recordingStatus);

// Route for initiating outbound calls
router.post('/initiate-call', callController.initiateCall);

// Route for getting call status
router.get('/status/:callSid', callController.getCallStatus);

module.exports = router; 