#!/usr/bin/env node
/**
 * Script to update the projects_config.json file
 * 
 * This script scans the projects directory and ensures each project has
 * a number assigned in the projects_config.json file.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Define paths
const projectsRoot = path.resolve(__dirname, '../projects');
const configPath = path.join(projectsRoot, 'projects_config.json');

console.log('Updating projects configuration...');
console.log(`Projects directory: ${projectsRoot}`);
console.log(`Config path: ${configPath}`);

// Function to load existing config or create a new one
function loadConfig() {
  try {
    if (fs.existsSync(configPath)) {
      const data = fs.readFileSync(configPath, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error(`Error reading config: ${error.message}`);
  }
  
  return {
    projects: {},
    projectsByNumber: {}
  };
}

// Function to scan projects directory
function scanProjects() {
  if (!fs.existsSync(projectsRoot)) {
    console.log(`Creating projects directory: ${projectsRoot}`);
    fs.mkdirSync(projectsRoot, { recursive: true });
    return [];
  }
  
  const entries = fs.readdirSync(projectsRoot, { withFileTypes: true });
  return entries
    .filter(entry => entry.isDirectory() && !entry.name.startsWith('.'))
    .map(entry => ({
      name: entry.name,
      path: path.join(projectsRoot, entry.name)
    }));
}

// Get project type by checking for common files
function getProjectType(projectPath) {
  try {
    // Check for package.json
    if (fs.existsSync(path.join(projectPath, 'package.json'))) {
      const packageJson = JSON.parse(fs.readFileSync(path.join(projectPath, 'package.json'), 'utf8'));
      
      if (packageJson.dependencies) {
        if (packageJson.dependencies.react) return 'react';
        if (packageJson.dependencies.express) return 'express';
        if (packageJson.dependencies.vue) return 'vue';
        if (packageJson.dependencies.next) return 'nextjs';
      }
      
      return 'node';
    }
    
    // Check for Python files
    if (fs.existsSync(path.join(projectPath, 'requirements.txt')) || 
        fs.existsSync(path.join(projectPath, 'setup.py'))) {
      return 'python';
    }
    
    // Check for specific AI project markers
    if (fs.existsSync(path.join(projectPath, 'model')) ||
        fs.existsSync(path.join(projectPath, 'train.py'))) {
      return 'ai';
    }
    
    // Default to 'other'
    return 'other';
  } catch (error) {
    console.error(`Error determining project type: ${error.message}`);
    return 'unknown';
  }
}

// Main function
function updateProjects() {
  // Load existing config
  const config = loadConfig();
  const projects = scanProjects();
  
  console.log(`Found ${projects.length} project directories`);
  
  // Find highest project number
  let maxNumber = 0;
  Object.keys(config.projectsByNumber).forEach(num => {
    const number = parseInt(num, 10);
    if (number > maxNumber) maxNumber = number;
  });
  
  let updated = false;
  
  // Process each project
  projects.forEach(project => {
    if (!config.projects[project.name]) {
      // New project, assign a number
      maxNumber++;
      const projectType = getProjectType(project.path);
      
      console.log(`Adding project: ${project.name} (${projectType}) with number ${maxNumber}`);
      
      config.projects[project.name] = {
        name: project.name,
        path: project.path,
        type: projectType,
        number: maxNumber
      };
      
      config.projectsByNumber[maxNumber.toString()] = project.name;
      updated = true;
    } else {
      // Ensure the path is updated
      if (config.projects[project.name].path !== project.path) {
        console.log(`Updating path for ${project.name}`);
        config.projects[project.name].path = project.path;
        updated = true;
      }
      
      // Ensure the project has a number
      if (!config.projects[project.name].number) {
        maxNumber++;
        console.log(`Assigning number ${maxNumber} to existing project ${project.name}`);
        config.projects[project.name].number = maxNumber;
        config.projectsByNumber[maxNumber.toString()] = project.name;
        updated = true;
      }
    }
  });
  
  // Check for deleted projects
  const existingProjectNames = projects.map(p => p.name);
  const configProjectNames = Object.keys(config.projects);
  
  const deletedProjects = configProjectNames.filter(name => !existingProjectNames.includes(name));
  
  if (deletedProjects.length > 0) {
    console.log(`Removing ${deletedProjects.length} deleted projects from config`);
    
    deletedProjects.forEach(name => {
      const number = config.projects[name].number;
      delete config.projects[name];
      delete config.projectsByNumber[number.toString()];
      updated = true;
    });
  }
  
  // Save the updated config if needed
  if (updated) {
    console.log('Saving updated configuration...');
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
    console.log('Configuration updated successfully');
  } else {
    console.log('No changes needed to the configuration');
  }
  
  return config;
}

// Run the update
const updatedConfig = updateProjects();
console.log(`Configuration complete. ${Object.keys(updatedConfig.projects).length} projects configured.`);