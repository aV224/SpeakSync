const mongoose = require('mongoose');
const Schema = mongoose.Schema;

/**
 * Call Schema
 * Stores information about phone calls made through Twilio
 */
const CallSchema = new Schema({
  // Twilio call identifier
  callSid: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  // Phone number that initiated the call
  from: {
    type: String,
    required: true
  },
  // Phone number receiving the call
  to: {
    type: String,
    required: true
  },
  // Call direction (inbound, outbound)
  direction: {
    type: String,
    enum: ['inbound', 'outbound'],
    required: true
  },
  // Current status of the call
  status: {
    type: String,
    enum: ['queued', 'ringing', 'in-progress', 'completed', 'failed', 'busy', 'no-answer', 'canceled'],
    default: 'queued'
  },
  // Call duration in seconds
  duration: {
    type: Number,
    default: 0
  },
  // The price of the call (if available)
  price: {
    type: Number,
    default: 0
  },
  // Related recordings for this call
  recordings: [{
    recordingSid: String,
    duration: Number,
    url: String,
    dateCreated: Date
  }],
  // Related transcriptions for this call
  transcriptions: [{
    transcriptionSid: String,
    text: String,
    status: String,
    dateCreated: Date
  }],
  // Voice commands and AI responses during this call
  interactions: [{
    timestamp: {
      type: Date,
      default: Date.now
    },
    speechInput: String,
    confidence: Number,
    correctedSpeech: String,
    aiResponse: Schema.Types.Mixed,
    action: String,
    result: String,
    languageDetected: String,
    processingTime: Number
  }],
  // Metadata and context information
  metadata: {
    type: Schema.Types.Mixed,
    default: {}
  },
  // Timestamps
  dateCreated: {
    type: Date,
    default: Date.now
  },
  dateUpdated: {
    type: Date,
    default: Date.now
  },
  dateEnded: Date
}, {
  timestamps: { createdAt: 'dateCreated', updatedAt: 'dateUpdated' }
});

// Indexes for better query performance
CallSchema.index({ dateCreated: -1 });
CallSchema.index({ from: 1, dateCreated: -1 });
CallSchema.index({ status: 1 });

// Virtual for formatted duration
CallSchema.virtual('formattedDuration').get(function() {
  if (!this.duration) return '0:00';
  const minutes = Math.floor(this.duration / 60);
  const seconds = this.duration % 60;
  return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
});

// Pre-save hook to update the dateUpdated field
CallSchema.pre('save', function(next) {
  this.dateUpdated = new Date();
  next();
});

// Static method to find recent calls
CallSchema.statics.findRecent = function(limit = 10) {
  return this.find()
    .sort({ dateCreated: -1 })
    .limit(limit);
};

// Method to add an interaction to a call
CallSchema.methods.addInteraction = function(interaction) {
  this.interactions.push(interaction);
  return this.save();
};

// Method to add a transcription to a call
CallSchema.methods.addTranscription = function(transcription) {
  this.transcriptions.push(transcription);
  return this.save();
};

// Method to add a recording to a call
CallSchema.methods.addRecording = function(recording) {
  this.recordings.push(recording);
  return this.save();
};

// Method to update call status
CallSchema.methods.updateStatus = function(status) {
  this.status = status;
  if (['completed', 'failed', 'busy', 'no-answer', 'canceled'].includes(status)) {
    this.dateEnded = new Date();
  }
  return this.save();
};

module.exports = mongoose.model('Call', CallSchema); 