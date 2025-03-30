const mongoose = require('mongoose');
const Schema = mongoose.Schema;

/**
 * Project Schema
 * Stores information about projects managed by the application
 */
const ProjectSchema = new Schema({
  // Unique project identifier
  projectId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  // Project name
  name: {
    type: String,
    required: true,
    trim: true
  },
  // Project filesystem path
  path: {
    type: String,
    required: true,
    trim: true
  },
  // Project type (web, desktop, mobile, other)
  type: {
    type: String,
    enum: ['web', 'desktop', 'mobile', 'game', 'api', 'library', 'other'],
    default: 'other'
  },
  // Whether this is the default project
  isDefault: {
    type: Boolean,
    default: false
  },
  // Project description
  description: {
    type: String,
    trim: true,
    default: ''
  },
  // Project configuration settings
  config: {
    type: Schema.Types.Mixed,
    default: {}
  },
  // Project statistics
  stats: {
    lastAccessed: Date,
    filesCount: Number,
    directoriesCount: Number,
    languagesUsed: [String],
    accessCount: {
      type: Number,
      default: 0
    }
  },
  // Project status
  status: {
    type: String,
    enum: ['active', 'archived', 'deleted'],
    default: 'active'
  },
  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Indexes for better query performance
ProjectSchema.index({ name: 1 });
ProjectSchema.index({ isDefault: 1 });
ProjectSchema.index({ status: 1 });

// Pre-save hook to update the updatedAt field
ProjectSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Static method to find active projects
ProjectSchema.statics.findActive = function() {
  return this.find({ status: 'active' }).sort({ name: 1 });
};

// Static method to find default project
ProjectSchema.statics.findDefault = function() {
  return this.findOne({ isDefault: true, status: 'active' });
};

// Static method to set default project
ProjectSchema.statics.setDefault = async function(projectId) {
  // First, unset default on all projects
  await this.updateMany({}, { isDefault: false });
  
  // Then set new default
  return this.findOneAndUpdate(
    { projectId },
    { isDefault: true },
    { new: true }
  );
};

// Method to track project access
ProjectSchema.methods.trackAccess = function() {
  this.stats.lastAccessed = new Date();
  this.stats.accessCount += 1;
  return this.save();
};

// Method to update project stats
ProjectSchema.methods.updateStats = function(stats) {
  this.stats = { ...this.stats, ...stats };
  return this.save();
};

// Method to archive project
ProjectSchema.methods.archive = function() {
  this.status = 'archived';
  return this.save();
};

// Method to restore archived project
ProjectSchema.methods.restore = function() {
  this.status = 'active';
  return this.save();
};

module.exports = mongoose.model('Project', ProjectSchema); 