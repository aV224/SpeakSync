// Import required dependencies
const express = require('express');
const router = express.Router();
const speechModel = require('../models/speechModel');

/**
 * Route to submit feedback for an interpreted command
 * This allows users to correct misinterpreted speech commands
 */
router.post('/submit', (req, res) => {
  try {
    const { original, corrected, userCorrection, intent } = req.body;
    
    if (!original || !corrected || !userCorrection) {
      return res.status(400).json({
        success: false,
        error: 'Missing required feedback fields'
      });
    }
    
    // Add the feedback to our model
    const feedback = speechModel.addFeedback(
      original, 
      corrected, 
      userCorrection,
      intent || 'unknown'
    );
    
    // Return success response
    res.json({
      success: true,
      message: 'Feedback recorded successfully',
      feedback
    });
  } catch (error) {
    console.error('Error processing feedback:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Route to get all feedback entries
 */
router.get('/', (req, res) => {
  try {
    res.json({
      success: true,
      feedback: speechModel.feedback
    });
  } catch (error) {
    console.error('Error retrieving feedback:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Route to get model stats
 */
router.get('/stats', (req, res) => {
  try {
    const stats = {
      commandMapSize: Object.keys(speechModel.commandMap).length,
      commandVariations: Object.values(speechModel.commandMap)
        .reduce((sum, variations) => sum + variations.length, 0),
      misspellingsCount: Object.values(speechModel.misspellings)
        .reduce((sum, variations) => sum + variations.length, 0),
      feedbackCount: speechModel.feedback.length,
      processedFeedbackCount: speechModel.feedback.filter(f => f.processed).length,
      thresholds: speechModel.similarityThresholds
    };
    
    res.json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('Error retrieving model stats:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Route to update similarity thresholds
 */
router.post('/thresholds', (req, res) => {
  try {
    const { thresholds } = req.body;
    
    if (!thresholds || typeof thresholds !== 'object') {
      return res.status(400).json({
        success: false,
        error: 'Invalid thresholds data'
      });
    }
    
    // Update thresholds
    const success = speechModel.updateThresholds(thresholds);
    
    if (success) {
      res.json({
        success: true,
        message: 'Thresholds updated successfully',
        thresholds: speechModel.similarityThresholds
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Failed to update thresholds'
      });
    }
  } catch (error) {
    console.error('Error updating thresholds:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Route to add a new command variation
 */
router.post('/command', (req, res) => {
  try {
    const { intent, variation } = req.body;
    
    if (!intent || !variation) {
      return res.status(400).json({
        success: false,
        error: 'Intent and variation are required'
      });
    }
    
    // Add the command variation
    const success = speechModel.addCommandVariation(intent, variation);
    
    if (success) {
      res.json({
        success: true,
        message: 'Command variation added successfully',
        commandMap: speechModel.commandMap
      });
    } else {
      res.status(400).json({
        success: false,
        error: 'Variation already exists or could not be added'
      });
    }
  } catch (error) {
    console.error('Error adding command variation:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Route to trigger processing of all unprocessed feedback
 */
router.post('/process', (req, res) => {
  try {
    // Process all unprocessed feedback
    speechModel.processAllFeedback();
    
    res.json({
      success: true,
      message: 'All feedback processed successfully',
      processedCount: speechModel.feedback.filter(f => f.processed).length
    });
  } catch (error) {
    console.error('Error processing feedback:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router; 