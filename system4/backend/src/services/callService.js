const Call = require('../models/Call');
const logger = require('electron-log');

/**
 * Call Service
 * Handles database operations for call data
 */
class CallService {
  /**
   * Create a new call record
   * @param {Object} callData - Call data from Twilio
   * @returns {Promise<Object>} Created call record
   */
  static async createCall(callData) {
    try {
      const call = new Call({
        callSid: callData.CallSid,
        from: callData.From,
        to: callData.To,
        direction: callData.Direction || 'inbound',
        status: callData.CallStatus || 'in-progress',
        metadata: {
          fromCountry: callData.FromCountry,
          fromState: callData.FromState,
          fromCity: callData.FromCity,
          fromZip: callData.FromZip,
          toCountry: callData.ToCountry,
          toState: callData.ToState,
          toCity: callData.ToCity,
          toZip: callData.ToZip,
          apiVersion: callData.ApiVersion
        }
      });
      
      await call.save();
      logger.info(`Call record created: ${call.callSid}`);
      return call;
    } catch (error) {
      logger.error(`Error creating call record: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Find call by SID
   * @param {string} callSid - Twilio Call SID
   * @returns {Promise<Object>} Call record
   */
  static async findCallBySid(callSid) {
    try {
      const call = await Call.findOne({ callSid });
      return call;
    } catch (error) {
      logger.error(`Error finding call by SID: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Update call status
   * @param {string} callSid - Twilio Call SID
   * @param {string} status - New call status
   * @returns {Promise<Object>} Updated call record
   */
  static async updateCallStatus(callSid, status) {
    try {
      const call = await Call.findOne({ callSid });
      if (!call) {
        throw new Error(`Call not found with SID: ${callSid}`);
      }
      
      call.status = status;
      
      if (['completed', 'failed', 'busy', 'no-answer', 'canceled'].includes(status)) {
        call.dateEnded = new Date();
      }
      
      await call.save();
      logger.info(`Call status updated: ${callSid} -> ${status}`);
      return call;
    } catch (error) {
      logger.error(`Error updating call status: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Add speech interaction to call
   * @param {string} callSid - Twilio Call SID
   * @param {Object} interaction - Speech interaction data
   * @returns {Promise<Object>} Updated call record
   */
  static async addSpeechInteraction(callSid, interaction) {
    try {
      const call = await Call.findOne({ callSid });
      if (!call) {
        throw new Error(`Call not found with SID: ${callSid}`);
      }
      
      call.interactions.push({
        timestamp: new Date(),
        speechInput: interaction.speechInput,
        confidence: interaction.confidence,
        correctedSpeech: interaction.correctedSpeech,
        aiResponse: interaction.aiResponse,
        action: interaction.action,
        result: interaction.result,
        languageDetected: interaction.languageDetected,
        processingTime: interaction.processingTime
      });
      
      await call.save();
      logger.info(`Speech interaction added to call: ${callSid}`);
      return call;
    } catch (error) {
      logger.error(`Error adding speech interaction: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Add recording to call
   * @param {string} callSid - Twilio Call SID
   * @param {Object} recording - Recording data
   * @returns {Promise<Object>} Updated call record
   */
  static async addRecording(callSid, recording) {
    try {
      const call = await Call.findOne({ callSid });
      if (!call) {
        throw new Error(`Call not found with SID: ${callSid}`);
      }
      
      call.recordings.push({
        recordingSid: recording.RecordingSid,
        duration: recording.Duration,
        url: recording.RecordingUrl,
        dateCreated: new Date()
      });
      
      await call.save();
      logger.info(`Recording added to call: ${callSid}`);
      return call;
    } catch (error) {
      logger.error(`Error adding recording: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Add transcription to call
   * @param {string} callSid - Twilio Call SID
   * @param {Object} transcription - Transcription data
   * @returns {Promise<Object>} Updated call record
   */
  static async addTranscription(callSid, transcription) {
    try {
      const call = await Call.findOne({ callSid });
      if (!call) {
        throw new Error(`Call not found with SID: ${callSid}`);
      }
      
      call.transcriptions.push({
        transcriptionSid: transcription.TranscriptionSid,
        text: transcription.TranscriptionText,
        status: transcription.TranscriptionStatus,
        dateCreated: new Date()
      });
      
      await call.save();
      logger.info(`Transcription added to call: ${callSid}`);
      return call;
    } catch (error) {
      logger.error(`Error adding transcription: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Get recent calls
   * @param {number} limit - Maximum number of calls to return
   * @returns {Promise<Array>} Array of call records
   */
  static async getRecentCalls(limit = 10) {
    try {
      const calls = await Call.find()
        .sort({ dateCreated: -1 })
        .limit(limit);
      
      return calls;
    } catch (error) {
      logger.error(`Error getting recent calls: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Get calls by phone number
   * @param {string} phoneNumber - Phone number to filter by
   * @param {number} limit - Maximum number of calls to return
   * @returns {Promise<Array>} Array of call records
   */
  static async getCallsByPhoneNumber(phoneNumber, limit = 10) {
    try {
      const calls = await Call.find({
        $or: [
          { from: phoneNumber },
          { to: phoneNumber }
        ]
      })
        .sort({ dateCreated: -1 })
        .limit(limit);
      
      return calls;
    } catch (error) {
      logger.error(`Error getting calls by phone number: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Delete call
   * @param {string} callSid - Twilio Call SID
   * @returns {Promise<boolean>} Success status
   */
  static async deleteCall(callSid) {
    try {
      const result = await Call.deleteOne({ callSid });
      
      if (result.deletedCount === 0) {
        throw new Error(`Call not found with SID: ${callSid}`);
      }
      
      logger.info(`Call deleted: ${callSid}`);
      return true;
    } catch (error) {
      logger.error(`Error deleting call: ${error.message}`);
      throw error;
    }
  }
}

module.exports = CallService; 