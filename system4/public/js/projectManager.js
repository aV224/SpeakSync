/**
 * Project Manager JavaScript
 * Handles loading, displaying, and managing projects
 */

class ProjectManager {
    constructor() {
        this.projects = [];
        this.activeProject = null;
        this.projectsGrid = document.getElementById('projects-grid');
        this.loadingProjects = document.getElementById('loading-projects');
        this.emptyProjects = document.getElementById('empty-projects');
        this.activeProjectInfo = document.getElementById('active-project-info');
        this.activeProjectName = document.getElementById('active-project-name');
        this.activeProjectPath = document.getElementById('active-project-path');
        this.importZipForm = document.getElementById('import-zip-form');
        
        this.init();
    }
    
    async init() {
        // Initialize event listeners
        this.setupEventListeners();
        
        // Load projects
        await this.loadProjects();
        
        // Handle form submissions
        this.handleFormSubmissions();
    }
    
    setupEventListeners() {
        // Refresh button if exists
        const refreshBtn = document.getElementById('refresh-projects-btn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => this.loadProjects());
        }
        
        // Create first project button
        const createFirstProjectBtn = document.getElementById('create-first-project-btn');
        if (createFirstProjectBtn) {
            createFirstProjectBtn.addEventListener('click', () => {
                // Redirect to create project page or show modal
                window.location.href = '/create-project.html';
            });
        }
    }
    
    handleFormSubmissions() {
        // Zip import form
        if (this.importZipForm) {
            this.importZipForm.addEventListener('submit', (e) => this.handleZipImport(e));
        }
    }
    
    async handleZipImport(e) {
        e.preventDefault();
        
        // Show loading notification
        if (window.appUtils) {
            window.appUtils.showLoading('Importing project...');
        }
        
        const formData = new FormData(this.importZipForm);
        const fileInput = this.importZipForm.querySelector('input[type="file"]');
        const zipFile = fileInput ? fileInput.files[0] : null;
        
        // Validate there's a file selected
        if (!zipFile) {
            console.error('No file selected');
            if (window.appUtils) {
                window.appUtils.hideLoading();
                window.appUtils.showNotification('Please select a zip file to upload', 'error');
            }
            return;
        }
        
        // Validate file type
        if (!zipFile.name.toLowerCase().endsWith('.zip')) {
            console.error('Invalid file type:', zipFile.type);
            if (window.appUtils) {
                window.appUtils.hideLoading();
                window.appUtils.showNotification('Only zip files are allowed', 'error');
            }
            return;
        }
        
        console.log(`Attempting to upload: ${zipFile.name} (${zipFile.size} bytes, ${zipFile.type})`);
        
        try {
            // Debug form data
            console.log('Form data entries:');
            for (const pair of formData.entries()) {
                console.log(pair[0], pair[1]);
            }
            
            // Ensure zipFile is in the form data
            if (!formData.has('zipFile')) {
                console.log('Adding zipFile to formData');
                formData.append('zipFile', zipFile);
            }
            
            // Add headers to request
            const options = {
                method: 'POST',
                body: formData,
                // Don't set Content-Type header, browser will set it with boundary
                headers: {
                    'Accept': 'application/json'
                }
            };
            
            console.log('Sending request to server with Accept: application/json header');
            const response = await fetch('/api/projects/import-zip', options);
            
            // Log response details for debugging
            console.log('Response status:', response.status);
            console.log('Response headers:', Object.fromEntries([...response.headers.entries()]));
            
            // Check for HTML error response
            const contentType = response.headers.get('content-type');
            console.log('Response content type:', contentType);
            
            if (!response.ok) {
                // Handle the error appropriately based on content type
                if (!contentType || contentType.includes('text/html')) {
                    const html = await response.text();
                    console.error('Received HTML error response:', html.substring(0, 500) + '...');
                    throw new Error('Server error: Received HTML instead of JSON');
                }
                
                // Try to get JSON error if available
                try {
                    const errorData = await response.json();
                    throw new Error(errorData.error || `Server error: ${response.status}`);
                } catch (jsonError) {
                    // If JSON parsing fails, use the response status
                    const text = await response.text();
                    console.error('Error response text:', text.substring(0, 500));
                    throw new Error(`Server error: ${response.status}`);
                }
            }
            
            // Parse successful response
            let result;
            try {
                result = await response.json();
            } catch (jsonError) {
                console.error('Failed to parse response as JSON:', jsonError);
                const text = await response.text();
                console.error('Response text:', text.substring(0, 500));
                throw new Error('Server returned invalid JSON response');
            }
            
            console.log('Import successful:', result);
            
            if (window.appUtils) {
                window.appUtils.hideLoading();
                window.appUtils.showNotification(`Project ${result.project.name} imported successfully!`, 'success');
            }
            
            // Reset the form
            this.importZipForm.reset();
            
            // Reload projects
            await this.loadProjects();
            
        } catch (error) {
            console.error('Error importing project:', error);
            
            if (window.appUtils) {
                window.appUtils.hideLoading();
                window.appUtils.showNotification(`Import failed: ${error.message}`, 'error');
            }
        }
    }
    
    async loadProjects() {
        if (this.loadingProjects) {
            this.loadingProjects.classList.remove('hidden');
        }
        
        if (this.projectsGrid) {
            this.projectsGrid.classList.add('hidden');
        }
        
        if (this.emptyProjects) {
            this.emptyProjects.classList.add('hidden');
        }
        
        try {
            // Fetch projects and active project in parallel
            const [projectsResponse, activeProjectResponse] = await Promise.all([
                fetch('/api/projects'),
                fetch('/api/active-directory').catch(() => ({ json: () => null })) // Ignore errors if no active project
            ]);
            
            if (!projectsResponse.ok) {
                throw new Error('Failed to fetch projects');
            }
            
            this.projects = await projectsResponse.json();
            
            // Set active project if available
            if (activeProjectResponse.ok) {
                this.activeProject = await activeProjectResponse.json();
                this.updateActiveProjectInfo();
            }
            
            // Render projects
            this.renderProjects();
            
        } catch (error) {
            console.error('Error loading projects:', error);
            
            if (window.appUtils) {
                window.appUtils.showNotification(`Error loading projects: ${error.message}`, 'error');
            }
            
            if (this.loadingProjects) {
                this.loadingProjects.classList.add('hidden');
            }
        }
    }
    
    updateActiveProjectInfo() {
        if (!this.activeProjectInfo || !this.activeProject) return;
        
        this.activeProjectInfo.classList.remove('hidden');
        
        // Create the project name display with project number
        let nameDisplay = '';
        if (this.activeProject.projectNumber) {
            nameDisplay += `<span class="project-number">${this.activeProject.projectNumber}</span>`;
        }
        nameDisplay += `<span class="project-name">${this.activeProject.name || 'Unknown'}</span>`;
        
        this.activeProjectName.innerHTML = nameDisplay;
        this.activeProjectPath.textContent = this.activeProject.path || '';
    }
    
    renderProjects() {
        if (this.loadingProjects) {
            this.loadingProjects.classList.add('hidden');
        }
        
        if (!this.projects || this.projects.length === 0) {
            // Show empty state
            if (this.emptyProjects) {
                this.emptyProjects.classList.remove('hidden');
            }
            return;
        }
        
        // Clear and show project grid
        if (this.projectsGrid) {
            this.projectsGrid.innerHTML = '';
            this.projectsGrid.classList.remove('hidden');
            
            // Add project cards
            this.projects.forEach(project => {
                const projectCard = this.createProjectCard(project);
                this.projectsGrid.appendChild(projectCard);
            });
        }
    }
    
    createProjectCard(project) {
        const isActive = this.activeProject && this.activeProject.path === project.path;
        
        // Create card container
        const card = document.createElement('div');
        card.className = `bg-white rounded-lg shadow-md overflow-hidden ${isActive ? 'border-2 border-green-400' : ''}`;
        card.style.transition = 'transform 0.2s, box-shadow 0.2s';
        
        // Create card header
        const header = document.createElement('div');
        header.className = `px-4 py-3 ${isActive ? 'bg-green-50' : 'bg-gray-50'}`;
        header.innerHTML = `
            <div class="flex items-center justify-between">
                <h3 class="text-lg font-semibold truncate project-title">
                    <span class="project-number">${project.projectNumber || 'N/A'}</span>
                    <span class="project-name">${project.name}</span>
                </h3>
                ${isActive ? '<span class="bg-green-500 text-white text-xs px-2 py-1 rounded-full">Active</span>' : ''}
            </div>
            <div class="flex items-center mt-1">
                <span class="material-icons text-gray-500 mr-1 text-xs">folder</span>
                <span class="text-xs text-gray-500">${project.type || 'project'}</span>
            </div>
        `;
        
        // Create card body
        const body = document.createElement('div');
        body.className = 'px-4 py-3';
        
        // Project path and created date
        const infoDiv = document.createElement('div');
        infoDiv.className = 'mb-3';
        infoDiv.innerHTML = `
            <div class="text-xs text-gray-500 mb-1">
                <span class="font-medium">Path:</span> 
                <span class="font-mono overflow-ellipsis overflow-hidden" style="display: block;">${project.path}</span>
            </div>
            ${project.createdAt ? `
                <div class="text-xs text-gray-500">
                    <span class="font-medium">Created:</span> 
                    <span>${new Date(project.createdAt).toLocaleDateString()}</span>
                </div>
            ` : ''}
        `;
        
        // Directory contents preview
        const previewDiv = document.createElement('div');
        previewDiv.className = 'mb-3';
        previewDiv.innerHTML = `
            <h4 class="text-sm font-medium mb-1 flex items-center">
                <span class="material-icons text-gray-500 mr-1 text-sm">folder_open</span>
                Directory Contents
            </h4>
            <div class="directory-preview bg-gray-50 rounded p-2 text-xs font-mono max-h-20 overflow-y-auto">
                <div class="loading-item flex items-center text-gray-500">
                    <span class="material-icons text-sm mr-1">hourglass_empty</span>
                    Loading directory contents...
                </div>
            </div>
        `;
        
        // Action buttons
        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'flex space-x-2 mt-3';
        actionsDiv.innerHTML = `
            ${isActive ? `
                <button class="flex-1 px-2 py-1 bg-green-500 text-white text-sm rounded flex items-center justify-center cursor-not-allowed opacity-75">
                    <span class="material-icons text-sm mr-1">check_circle</span>
                    Active
                </button>
            ` : `
                <button class="set-active-btn flex-1 px-2 py-1 bg-blue-500 text-white text-sm rounded flex items-center justify-center hover:bg-blue-600">
                    <span class="material-icons text-sm mr-1">play_arrow</span>
                    Open
                </button>
            `}
            <button class="explore-btn flex-1 px-2 py-1 bg-purple-500 text-white text-sm rounded flex items-center justify-center hover:bg-purple-600">
                <span class="material-icons text-sm mr-1">folder_open</span>
                Explore
            </button>
            <button class="delete-btn px-2 py-1 bg-red-500 text-white text-sm rounded flex items-center justify-center hover:bg-red-600">
                <span class="material-icons text-sm">delete</span>
            </button>
        `;
        
        // Add event listeners to buttons
        setTimeout(() => {
            // Set active button
            const setActiveBtn = actionsDiv.querySelector('.set-active-btn');
            if (setActiveBtn) {
                setActiveBtn.addEventListener('click', () => this.setActiveProject(project));
            }
            
            // Explore button
            const exploreBtn = actionsDiv.querySelector('.explore-btn');
            if (exploreBtn) {
                exploreBtn.addEventListener('click', () => {
                    window.location.href = `/project-files.html?id=${project.id}`;
                });
            }
            
            // Delete button
            const deleteBtn = actionsDiv.querySelector('.delete-btn');
            if (deleteBtn) {
                deleteBtn.addEventListener('click', () => this.deleteProject(project));
            }
            
            // Make entire card clickable to open project
            card.addEventListener('click', (e) => {
                if (!e.target.closest('button')) {
                    if (!isActive) {
                        this.setActiveProject(project);
                    }
                }
            });
            
            // Fetch and display directory contents
            this.fetchProjectStructure(project, previewDiv.querySelector('.directory-preview'));
        }, 0);
        
        // Assemble the card
        body.appendChild(infoDiv);
        body.appendChild(previewDiv);
        body.appendChild(actionsDiv);
        
        card.appendChild(header);
        card.appendChild(body);
        
        return card;
    }
    
    async fetchProjectStructure(project, containerEl) {
        try {
            const response = await fetch(`/api/projects/${project.id}/structure?depth=1`);
            
            if (!response.ok) {
                throw new Error('Failed to fetch project structure');
            }
            
            const structure = await response.json();
            
            if (!structure || !structure.children || structure.children.length === 0) {
                containerEl.innerHTML = `
                    <div class="empty-dir flex items-center text-gray-500">
                        <span class="material-icons text-sm mr-1">folder_off</span>
                        Empty directory
                    </div>
                `;
                return;
            }
            
            // Display up to 5 items
            const itemsToShow = structure.children.slice(0, 5);
            const hasMore = structure.children.length > 5;
            
            containerEl.innerHTML = '';
            
            itemsToShow.forEach(item => {
                const isDirectory = item.type === 'directory';
                const itemEl = document.createElement('div');
                itemEl.className = 'flex items-center mb-1 last:mb-0';
                itemEl.innerHTML = `
                    <span class="material-icons text-sm mr-1">
                        ${isDirectory ? 'folder' : 'insert_drive_file'}
                    </span>
                    <span class="${isDirectory ? 'font-medium' : ''}">${item.name}</span>
                `;
                containerEl.appendChild(itemEl);
            });
            
            if (hasMore) {
                const moreEl = document.createElement('div');
                moreEl.className = 'text-gray-500 mt-1 text-center';
                moreEl.textContent = `+ ${structure.children.length - 5} more items`;
                containerEl.appendChild(moreEl);
            }
            
        } catch (error) {
            console.error('Error fetching project structure:', error);
            containerEl.innerHTML = `
                <div class="error-item flex items-center text-red-500">
                    <span class="material-icons text-sm mr-1">error</span>
                    Error loading directory
                </div>
            `;
        }
    }
    
    async setActiveProject(project) {
        try {
            if (window.appUtils) {
                window.appUtils.showLoading(`Setting ${project.name} as active...`);
            }
            
            const response = await fetch('/api/active-directory', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    id: project.id,
                    path: project.path,
                    name: project.name
                })
            });
            
            if (!response.ok) {
                throw new Error('Failed to set active project');
            }
            
            this.activeProject = await response.json();
            
            if (window.appUtils) {
                window.appUtils.hideLoading();
                window.appUtils.showNotification(`${project.name} is now the active project`, 'success');
            }
            
            // Reload projects to update UI
            await this.loadProjects();
            
        } catch (error) {
            console.error('Error setting active project:', error);
            
            if (window.appUtils) {
                window.appUtils.hideLoading();
                window.appUtils.showNotification(`Error: ${error.message}`, 'error');
            }
        }
    }
    
    async deleteProject(project) {
        if (!confirm(`Are you sure you want to delete project "${project.name}"?`)) {
            return;
        }
        
        const deleteFiles = confirm(`Delete project files as well? This cannot be undone.`);
        
        try {
            if (window.appUtils) {
                window.appUtils.showLoading(`Deleting project...`);
            }
            
            const response = await fetch(`/api/projects/${project.id}?deleteFiles=${deleteFiles}`, {
                method: 'DELETE'
            });
            
            if (!response.ok) {
                const result = await response.json();
                throw new Error(result.error || 'Failed to delete project');
            }
            
            if (window.appUtils) {
                window.appUtils.hideLoading();
                window.appUtils.showNotification(`Project ${project.name} deleted successfully`, 'success');
            }
            
            // Reload projects to update UI
            await this.loadProjects();
            
        } catch (error) {
            console.error('Error deleting project:', error);
            
            if (window.appUtils) {
                window.appUtils.hideLoading();
                window.appUtils.showNotification(`Error: ${error.message}`, 'error');
            }
        }
    }
}

// Initialize Project Manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.projectManager = new ProjectManager();
}); 