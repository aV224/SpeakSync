// Import required dependencies
const express = require('express');
const router = express.Router();
const aiController = require('../controllers/aiController');

// Route for processing speech input
router.post('/process', aiController.processSpeechInput);

// Route for confirming or rejecting a staged change
// Assuming confirmation comes via an API call or webhook
// The :changeId will be the UUID generated during staging
router.post('/confirm/:changeId', aiController.confirmChange);

// Route to get status of AI providers (already exists in server.js, maybe move here?)
// router.get('/status', aiController.getAIStatus); // Example if moved

module.exports = router; 