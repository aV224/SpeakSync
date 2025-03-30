/**
 * Claude Code Routes
 * 
 * API routes for Claude Code integration in Gaana
 * providing full codebase access and modification capabilities.
 */

const express = require('express');
const router = express.Router();
const claudeCodeController = require('../controllers/claudeCodeController');

/**
 * @route  POST /api/claude-code/execute
 * @desc   Execute Claude with full codebase access
 * @access Protected
 */
router.post('/execute', claudeCodeController.executeClaudeCode);

/**
 * @route  POST /api/claude-code/command
 * @desc   Execute a shell command with elevated permissions
 * @access Protected
 */
router.post('/command', claudeCodeController.executeCommand);

/**
 * @route  POST /api/claude-code/read-file
 * @desc   Read a file with elevated permissions
 * @access Protected
 */
router.post('/read-file', claudeCodeController.readFile);

/**
 * @route  POST /api/claude-code/write-file
 * @desc   Write a file with elevated permissions
 * @access Protected
 */
router.post('/write-file', claudeCodeController.writeFile);

/**
 * @route  GET /api/claude-code/index
 * @desc   Index the codebase and return structure
 * @access Protected
 */
router.get('/index', claudeCodeController.indexCodebase);

module.exports = router;