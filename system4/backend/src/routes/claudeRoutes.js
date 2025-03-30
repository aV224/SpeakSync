const express = require('express');
const router = express.Router();
const ClaudeController = require('../controllers/claudeController');

// Process code request with Claude
router.post('/code', ClaudeController.processCodeRequest);

// Execute code with Claude
router.post('/execute', ClaudeController.executeCode);

// Process speech input with Claude
router.post('/speech', ClaudeController.processSpeech);

// Process request with Claude's extended thinking
router.post('/thinking', ClaudeController.processWithThinking);

// Check Claude API status
router.get('/status', ClaudeController.checkStatus);

module.exports = router; 