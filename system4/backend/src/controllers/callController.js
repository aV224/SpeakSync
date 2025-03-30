const CallService = require('../services/callService');
const logger = require('electron-log');
const { formatPhoneNumber } = require('../utils/phoneFormatter');

/**
 * Call Controller
 * Handles HTTP requests for call data
 */
class CallController {
  /**
   * Create a new call record
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async createCall(req, res) {
    try {
      const callData = req.body;
      
      // Basic validation
      if (!callData.CallSid || !callData.From || !callData.To) {
        return res.status(400).json({
          success: false,
          message: 'Missing required call data'
        });
      }
      
      const call = await CallService.createCall(callData);
      
      return res.status(201).json({
        success: true,
        message: 'Call created successfully',
        call
      });
    } catch (error) {
      logger.error(`Error creating call: ${error.message}`);
      return res.status(500).json({
        success: false,
        message: 'Error creating call record',
        error: error.message
      });
    }
  }
  
  /**
   * Get call by SID
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getCallBySid(req, res) {
    try {
      const { callSid } = req.params;
      
      if (!callSid) {
        return res.status(400).json({
          success: false,
          message: 'Call SID is required'
        });
      }
      
      const call = await CallService.findCallBySid(callSid);
      
      if (!call) {
        return res.status(404).json({
          success: false,
          message: `Call not found with SID: ${callSid}`
        });
      }
      
      return res.status(200).json({
        success: true,
        call
      });
    } catch (error) {
      logger.error(`Error retrieving call: ${error.message}`);
      return res.status(500).json({
        success: false,
        message: 'Error retrieving call',
        error: error.message
      });
    }
  }
  
  /**
   * Update call status
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async updateCallStatus(req, res) {
    try {
      const { callSid } = req.params;
      const { status } = req.body;
      
      if (!callSid || !status) {
        return res.status(400).json({
          success: false,
          message: 'Call SID and status are required'
        });
      }
      
      const call = await CallService.updateCallStatus(callSid, status);
      
      return res.status(200).json({
        success: true,
        message: 'Call status updated successfully',
        call
      });
    } catch (error) {
      logger.error(`Error updating call status: ${error.message}`);
      return res.status(500).json({
        success: false,
        message: 'Error updating call status',
        error: error.message
      });
    }
  }
  
  /**
   * Add speech interaction to call
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async addSpeechInteraction(req, res) {
    try {
      const { callSid } = req.params;
      const interaction = req.body;
      
      if (!callSid || !interaction) {
        return res.status(400).json({
          success: false,
          message: 'Call SID and interaction data are required'
        });
      }
      
      const call = await CallService.addSpeechInteraction(callSid, interaction);
      
      return res.status(200).json({
        success: true,
        message: 'Speech interaction added successfully',
        call
      });
    } catch (error) {
      logger.error(`Error adding speech interaction: ${error.message}`);
      return res.status(500).json({
        success: false,
        message: 'Error adding speech interaction',
        error: error.message
      });
    }
  }
  
  /**
   * Add recording to call
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async addRecording(req, res) {
    try {
      const { callSid } = req.params;
      const recording = req.body;
      
      if (!callSid || !recording || !recording.RecordingSid) {
        return res.status(400).json({
          success: false,
          message: 'Call SID and recording data are required'
        });
      }
      
      const call = await CallService.addRecording(callSid, recording);
      
      return res.status(200).json({
        success: true,
        message: 'Recording added successfully',
        call
      });
    } catch (error) {
      logger.error(`Error adding recording: ${error.message}`);
      return res.status(500).json({
        success: false,
        message: 'Error adding recording',
        error: error.message
      });
    }
  }
  
  /**
   * Add transcription to call
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async addTranscription(req, res) {
    try {
      const { callSid } = req.params;
      const transcription = req.body;
      
      if (!callSid || !transcription || !transcription.TranscriptionSid) {
        return res.status(400).json({
          success: false,
          message: 'Call SID and transcription data are required'
        });
      }
      
      const call = await CallService.addTranscription(callSid, transcription);
      
      return res.status(200).json({
        success: true,
        message: 'Transcription added successfully',
        call
      });
    } catch (error) {
      logger.error(`Error adding transcription: ${error.message}`);
      return res.status(500).json({
        success: false,
        message: 'Error adding transcription',
        error: error.message
      });
    }
  }
  
  /**
   * Get recent calls
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getRecentCalls(req, res) {
    try {
      const limit = parseInt(req.query.limit) || 10;
      
      const calls = await CallService.getRecentCalls(limit);
      
      return res.status(200).json({
        success: true,
        count: calls.length,
        calls
      });
    } catch (error) {
      logger.error(`Error retrieving recent calls: ${error.message}`);
      return res.status(500).json({
        success: false,
        message: 'Error retrieving recent calls',
        error: error.message
      });
    }
  }
  
  /**
   * Get calls by phone number
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getCallsByPhoneNumber(req, res) {
    try {
      const { phoneNumber } = req.params;
      const limit = parseInt(req.query.limit) || 10;
      
      if (!phoneNumber) {
        return res.status(400).json({
          success: false,
          message: 'Phone number is required'
        });
      }
      
      // Format phone number for consistent searching
      const formattedNumber = formatPhoneNumber(phoneNumber);
      
      const calls = await CallService.getCallsByPhoneNumber(formattedNumber, limit);
      
      return res.status(200).json({
        success: true,
        count: calls.length,
        calls
      });
    } catch (error) {
      logger.error(`Error retrieving calls by phone number: ${error.message}`);
      return res.status(500).json({
        success: false,
        message: 'Error retrieving calls by phone number',
        error: error.message
      });
    }
  }
  
  /**
   * Delete call
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async deleteCall(req, res) {
    try {
      const { callSid } = req.params;
      
      if (!callSid) {
        return res.status(400).json({
          success: false,
          message: 'Call SID is required'
        });
      }
      
      await CallService.deleteCall(callSid);
      
      return res.status(200).json({
        success: true,
        message: `Call with SID ${callSid} deleted successfully`
      });
    } catch (error) {
      logger.error(`Error deleting call: ${error.message}`);
      return res.status(500).json({
        success: false,
        message: 'Error deleting call',
        error: error.message
      });
    }
  }
}

module.exports = CallController; 