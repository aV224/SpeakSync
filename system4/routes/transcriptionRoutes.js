// Import required dependencies
const express = require('express');
const router = express.Router();
const transcriptionController = require('../controllers/transcriptionController');

// Route for handling transcription webhook callbacks
router.post('/webhook', transcriptionController.handleTranscriptionCallback);

// Route for requesting a transcription for a recording
router.post('/request/:recordingSid', transcriptionController.requestTranscription);

// Route for getting a list of transcriptions for a call
router.get('/call/:callSid', transcriptionController.getTranscriptions);

module.exports = router; 