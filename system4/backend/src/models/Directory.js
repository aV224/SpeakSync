const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const path = require('path');

/**
 * Directory Schema
 * Stores information about directories that Claude AI is allowed to modify
 */
const DirectorySchema = new Schema({
  // Directory path
  path: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    index: true
  },
  // Directory name (derived from path)
  name: {
    type: String,
    required: true,
    trim: true
  },
  // Description of the directory
  description: {
    type: String,
    trim: true,
    default: ''
  },
  // Whether Claude has permission to modify files in this directory
  allowModification: {
    type: Boolean,
    default: true
  },
  // Whether Claude has permission to execute commands in this directory
  allowExecution: {
    type: Boolean,
    default: true
  },
  // Allowed operations in this directory
  allowedOperations: {
    read: { type: Boolean, default: true },
    write: { type: Boolean, default: true },
    create: { type: Boolean, default: true },
    delete: { type: Boolean, default: false },
    execute: { type: Boolean, default: true }
  },
  // Allowed file types for creation/modification (extensions without dots)
  allowedFileTypes: {
    type: [String],
    default: ['js', 'json', 'txt', 'md', 'html', 'css']
  },
  // Allowed command patterns (regex strings)
  allowedCommands: {
    type: [String],
    default: ['ls', 'cat', 'find', 'grep', 'node', 'npm']
  },
  // Restricted patterns (regex strings that are never allowed)
  restrictedPatterns: {
    type: [String],
    default: ['^rm -rf', '^sudo', '/\\.env', '\\.git/']
  },
  // Priority for conflict resolution (higher wins)
  priority: {
    type: Number,
    default: 0
  },
  // Directory status
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active'
  },
  // Associated project ID (if applicable)
  projectId: {
    type: String,
    ref: 'Project',
    index: true
  },
  // Usage statistics
  stats: {
    accessCount: { type: Number, default: 0 },
    modificationCount: { type: Number, default: 0 },
    lastAccessed: Date,
    lastModified: Date
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
DirectorySchema.index({ status: 1 });
DirectorySchema.index({ allowModification: 1 });
DirectorySchema.index({ allowExecution: 1 });

// Pre-save hook to extract name from path and update timestamps
DirectorySchema.pre('save', function(next) {
  // Extract directory name from path
  this.name = path.basename(this.path);
  this.updatedAt = new Date();
  next();
});

// Static method to find active directories
DirectorySchema.statics.findActive = function() {
  return this.find({ status: 'active' }).sort({ path: 1 });
};

// Static method to find directories by project
DirectorySchema.statics.findByProject = function(projectId) {
  return this.find({ projectId, status: 'active' }).sort({ path: 1 });
};

// Static method to check if a path is allowed
DirectorySchema.statics.isPathAllowed = async function(targetPath, operation = 'read') {
  // Find all active directories that might contain this path
  const normalizedPath = path.normalize(targetPath);
  const directories = await this.find({ status: 'active' });
  
  // Sort by priority (highest first) and path specificity (longest path first)
  directories.sort((a, b) => {
    if (a.priority !== b.priority) return b.priority - a.priority;
    return b.path.length - a.path.length;
  });
  
  // Check if any directory allows this path for the requested operation
  for (const dir of directories) {
    if (normalizedPath.startsWith(dir.path)) {
      // Path is under this directory, check if operation is allowed
      const { allowedOperations } = dir;
      
      if (operation === 'read' && allowedOperations.read) return true;
      if (operation === 'write' && allowedOperations.write) return true;
      if (operation === 'create' && allowedOperations.create) return true;
      if (operation === 'delete' && allowedOperations.delete) return true;
      if (operation === 'execute' && allowedOperations.execute) return true;
    }
  }
  
  return false;
};

// Method to track access
DirectorySchema.methods.trackAccess = function() {
  this.stats.lastAccessed = new Date();
  this.stats.accessCount += 1;
  return this.save();
};

// Method to track modification
DirectorySchema.methods.trackModification = function() {
  this.stats.lastModified = new Date();
  this.stats.modificationCount += 1;
  return this.save();
};

// Method to check if a command is allowed
DirectorySchema.methods.isCommandAllowed = function(command) {
  // Check if command matches any allowed pattern
  const isAllowed = this.allowedCommands.some(pattern => {
    const regex = new RegExp(`^${pattern}($|\\s)`);
    return regex.test(command);
  });
  
  // Check if command matches any restricted pattern
  const isRestricted = this.restrictedPatterns.some(pattern => {
    const regex = new RegExp(pattern);
    return regex.test(command);
  });
  
  return isAllowed && !isRestricted && this.allowExecution;
};

// Method to check if a file type is allowed
DirectorySchema.methods.isFileTypeAllowed = function(filename) {
  const ext = path.extname(filename).replace('.', '').toLowerCase();
  return this.allowedFileTypes.includes(ext) || this.allowedFileTypes.includes('*');
};

module.exports = mongoose.model('Directory', DirectorySchema); 