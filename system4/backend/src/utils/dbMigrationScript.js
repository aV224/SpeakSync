#!/usr/bin/env node

/**
 * Database Migration Script
 * Migrates existing project and call data from Electron Store to MongoDB
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const Store = require('electron-store');
const logger = require('electron-log');
const { v4: uuidv4 } = require('uuid');

// Configure logger
logger.transports.file.level = 'info';
logger.transports.console.level = 'info';
logger.transports.file.resolvePath = () => path.join(process.cwd(), 'logs', 'db-migration.log');

// Initialize the database connection
const database = require('../database/connection');
const ProjectService = require('../services/projectService');
const CallService = require('../services/callService');

// Initialize the store
const store = new Store();

/**
 * Migrate projects from Electron Store to MongoDB
 */
async function migrateProjects() {
  logger.info('Starting project migration...');
  const projects = store.get('projects') || [];
  const defaultProjectId = store.get('defaultProject');
  
  if (projects.length === 0) {
    logger.info('No projects found in Electron Store. Skipping project migration.');
    return;
  }
  
  logger.info(`Found ${projects.length} projects to migrate`);
  
  try {
    for (const project of projects) {
      // Check if project already exists in MongoDB
      const existingProjects = await ProjectService.getAllProjects(false);
      const exists = existingProjects.some(p => 
        p.path === project.path || 
        (project.id && p.projectId === `proj_${project.id}`)
      );
      
      if (exists) {
        logger.info(`Project already exists in MongoDB: ${project.name} (${project.path})`);
        continue;
      }
      
      // Format project data for MongoDB
      const projectData = {
        projectId: project.id ? `proj_${project.id}` : `proj_${uuidv4().replace(/-/g, '').substring(0, 16)}`,
        name: project.name,
        path: project.path,
        type: project.type || 'default',
        isDefault: project.id === defaultProjectId,
        description: project.description || '',
        config: project.config || {},
        status: 'active'
      };
      
      // Save to MongoDB
      await ProjectService.createProject(projectData);
      logger.info(`Migrated project: ${project.name} (${project.path})`);
    }
    
    logger.info('Project migration completed successfully');
    return true;
  } catch (error) {
    logger.error(`Error migrating projects: ${error.message}`, error);
    return false;
  }
}

/**
 * Migrate call history to MongoDB (if available)
 */
async function migrateCalls() {
  logger.info('Starting call history migration...');
  
  // Check if call history file exists
  const callHistoryPath = path.join(process.cwd(), 'data', 'call-history.json');
  
  if (!fs.existsSync(callHistoryPath)) {
    logger.info('No call history file found. Skipping call migration.');
    return true;
  }
  
  try {
    // Read call history
    const callHistoryData = JSON.parse(fs.readFileSync(callHistoryPath, 'utf8'));
    const calls = callHistoryData.calls || [];
    
    if (calls.length === 0) {
      logger.info('No calls found in history file. Skipping call migration.');
      return true;
    }
    
    logger.info(`Found ${calls.length} calls to migrate`);
    
    for (const call of calls) {
      // Check if call already exists in MongoDB
      const existingCall = await CallService.findCallBySid(call.sid);
      
      if (existingCall) {
        logger.info(`Call already exists in MongoDB: ${call.sid}`);
        continue;
      }
      
      // Format call data for MongoDB
      const callData = {
        CallSid: call.sid,
        From: call.from,
        To: call.to,
        Direction: call.direction || 'inbound',
        CallStatus: call.status || 'completed',
        Duration: call.duration || 0,
        FromCountry: call.fromCountry,
        FromState: call.fromState,
        FromCity: call.fromCity,
        FromZip: call.fromZip,
        ToCountry: call.toCountry,
        ToState: call.toState,
        ToCity: call.toCity,
        ToZip: call.toZip,
        ApiVersion: '2010-04-01'
      };
      
      // Create the call record
      const createdCall = await CallService.createCall(callData);
      
      // Add recordings if available
      if (call.recordings && call.recordings.length > 0) {
        for (const recording of call.recordings) {
          await CallService.addRecording(call.sid, {
            RecordingSid: recording.sid,
            RecordingUrl: recording.url,
            Duration: recording.duration
          });
        }
      }
      
      // Add transcriptions if available
      if (call.transcriptions && call.transcriptions.length > 0) {
        for (const transcription of call.transcriptions) {
          await CallService.addTranscription(call.sid, {
            TranscriptionSid: transcription.sid,
            TranscriptionText: transcription.text,
            TranscriptionStatus: 'completed'
          });
        }
      }
      
      logger.info(`Migrated call: ${call.sid}`);
    }
    
    logger.info('Call migration completed successfully');
    return true;
  } catch (error) {
    logger.error(`Error migrating calls: ${error.message}`, error);
    return false;
  }
}

/**
 * Run the migration
 */
async function runMigration() {
  logger.info('Starting database migration');
  
  try {
    // Initialize the database connection
    const dbInitResult = await database.init();
    
    if (!dbInitResult) {
      logger.error('Failed to initialize database connection. Aborting migration.');
      process.exit(1);
    }
    
    logger.info('Database connection initialized successfully');
    
    // Migrate projects
    const projectResult = await migrateProjects();
    
    // Migrate calls
    const callResult = await migrateCalls();
    
    // Close the database connection
    await database.close();
    
    if (projectResult && callResult) {
      logger.info('Migration completed successfully!');
      process.exit(0);
    } else {
      logger.error('Migration completed with errors. Check the log for details.');
      process.exit(1);
    }
  } catch (error) {
    logger.error(`Migration failed: ${error.message}`, error);
    
    // Close the database connection if open
    if (database.isConnected()) {
      await database.close();
    }
    
    process.exit(1);
  }
}

// Run the migration if this script is run directly
if (require.main === module) {
  runMigration();
}

module.exports = { runMigration, migrateProjects, migrateCalls }; 