// Import required dependencies
const twilioConfig = require('../config/twilio');

// Controller for handling transcription-related operations
const transcriptionController = {
  // Handle the webhook callback from Twilio with transcription data
  handleTranscriptionCallback: (req, res) => {
    // Extract transcription data from the request
    const transcriptionSid = req.body.TranscriptionSid;
    const transcriptionText = req.body.TranscriptionText;
    const transcriptionStatus = req.body.TranscriptionStatus;
    const callSid = req.body.CallSid;
    
    console.log(`Received transcription for call ${callSid}:`);
    console.log(`Status: ${transcriptionStatus}`);
    console.log(`Text: ${transcriptionText}`);
    
    // Store or process the transcription as needed
    // This is where you would add code to save to a database
    
    // Respond with success message
    res.json({
      success: true,
      message: 'Transcription received'
    });
  },
  
  // Request a transcription for a recording
  requestTranscription: async (req, res) => {
    try {
      const recordingSid = req.params.recordingSid;
      
      // Request transcription through Twilio API
      const transcription = await twilioConfig.client
        .recordings(recordingSid)
        .transcriptions
        .create();
      
      res.json({
        success: true,
        transcriptionSid: transcription.sid,
        status: transcription.status
      });
    } catch (error) {
      console.error('Error requesting transcription:', error);
      res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }
  },
  
  // Get a list of transcriptions for a call
  getTranscriptions: async (req, res) => {
    try {
      const callSid = req.params.callSid;
      
      // Get transcriptions through Twilio API
      const transcriptions = await twilioConfig.client
        .calls(callSid)
        .transcriptions
        .list();
      
      res.json({
        success: true,
        transcriptions: transcriptions.map(t => ({
          sid: t.sid,
          status: t.status,
          duration: t.duration,
          price: t.price,
          url: t.url
        }))
      });
    } catch (error) {
      console.error('Error fetching transcriptions:', error);
      res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }
  }
};

module.exports = transcriptionController; 