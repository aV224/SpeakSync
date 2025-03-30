document.addEventListener('DOMContentLoaded', function() {
    // Check if running in Electron
    const isElectron = window.electron !== undefined;
    
    // Application state
    const appState = {
        currentView: 'dashboard',
        isLoading: false,
        darkMode: localStorage.getItem('darkMode') === 'enabled' || window.matchMedia('(prefers-color-scheme: dark)').matches,
        animationsEnabled: true,
        serverStatus: 'unknown',
        remoteStatus: 'unknown',
        aiStatus: 'unknown',
        dbStatus: 'unknown',
        projects: [],
        isElectron: isElectron
    };

    // Cache DOM elements
    const sidebar = document.getElementById('sidebar');
    const content = document.getElementById('content');
    const sidebarItems = document.querySelectorAll('.sidebar-item');
    const mainTitle = document.querySelector('.title');
    const projectList = document.getElementById('project-items');
    const projectForm = document.getElementById('project-form');
    const loadingOverlay = document.getElementById('loading-overlay');
    const notificationContainer = document.getElementById('notification-container');
    const themeToggle = document.getElementById('theme-toggle');
    const themeIcon = themeToggle ? themeToggle.querySelector('i') : null;
    const themeText = themeToggle ? themeToggle.querySelector('.theme-text') : null;
    const loadingText = loadingOverlay ? loadingOverlay.querySelector('.loading-text') : null;

    // Global Variables
    let loadingTimeout = null;

    // Initialize UI
    function initializeUI() {
        // If running in Electron, get the theme setting from the system
        if (isElectron) {
            window.electron.getThemeSettings().then(settings => {
                appState.darkMode = settings.darkMode;
                applyTheme();
            }).catch(error => {
                console.error('Error getting theme settings:', error);
            });
            
            // Listen for events from the main process
            setupElectronListeners();
        } else {
            // Apply dark mode if enabled in browser
            if (appState.darkMode) {
                applyTheme();
            }
        }

        // Set up event listeners
        setupEventListeners();
        
        // Animate UI elements
        animateUIElements();
        
        // Check statuses
        checkAllStatuses();
        
        // Load projects
        loadProjects();
    }

    // Setup event listeners for Electron events
    function setupElectronListeners() {
        if (!isElectron) return;
        
        // Handle navigation from menu
        window.electron.onNavigateTo(view => {
            navigateTo(view);
        });
        
        // Handle dark mode toggle from menu
        window.electron.onToggleDarkMode(() => {
            toggleDarkMode();
        });
        
        // Handle system theme changes
        window.electron.onSystemThemeChanged(isDarkMode => {
            if (localStorage.getItem('darkMode') === null) {
                appState.darkMode = isDarkMode;
                applyTheme();
            }
        });
        
        // Handle show about dialog
        window.electron.onShowAbout(() => {
            showAboutDialog();
        });
        
        // Handle check for updates
        window.electron.onCheckForUpdates(() => {
            checkForUpdates();
        });
    }

    // Setup regular event listeners
    function setupEventListeners() {
        // Get theme toggle button
        const themeToggleBtn = document.getElementById('theme-toggle');
        if (themeToggleBtn) {
            themeToggleBtn.addEventListener('click', toggleDarkMode);
        }
        
        // Add event listeners to navigation items
        const navItems = document.querySelectorAll('.sidebar-item a, [data-view]');
        navItems.forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const view = item.getAttribute('data-view');
                if (view) {
                    navigateTo(view);
                }
            });
        });
        
        // Add event listeners to AI provider switches
        const providerButtons = document.querySelectorAll('.ai-provider-switch');
        providerButtons.forEach(button => {
            button.addEventListener('click', () => {
                const provider = button.getAttribute('data-provider');
                if (provider) {
                    switchAIProvider(provider);
                }
            });
        });

        // Add electron-specific event listeners if available
        if (window.electron) {
            window.electron.onNavigateTo((view) => {
                navigateTo(view);
            });
            
            window.electron.onToggleDarkMode(() => {
                toggleDarkMode();
            });
            
            window.electron.onSystemThemeChanged((isDarkMode) => {
                if (appState.useSystemTheme) {
                    appState.isDarkMode = isDarkMode;
                    applyTheme();
                }
            });
            
            window.electron.onShowAbout(() => {
                showAboutDialog();
            });
            
            window.electron.onCheckForUpdates(() => {
                checkForUpdates();
            });
        }
        
        // Check for initial theme from system preference
        if (window.electron) {
            window.electron.getThemeSettings().then(settings => {
                if (settings) {
                    appState.isDarkMode = settings.isDarkMode;
                    appState.useSystemTheme = settings.useSystemTheme;
                    applyTheme();
                }
            }).catch(err => {
                console.error('Error getting theme settings:', err);
            });
        } else {
            // Check for system theme preference if in browser
            if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
                appState.isDarkMode = true;
                applyTheme();
            }
        }

        // Project form submission
        if (projectForm) {
            projectForm.addEventListener('submit', function(e) {
                e.preventDefault();
                addProject();
            });
        }

        // Add hover effects for cards
        document.querySelectorAll('.card.hover-lift').forEach(card => {
            card.addEventListener('mouseenter', function() {
                this.classList.add('hover-active');
            });
            card.addEventListener('mouseleave', function() {
                this.classList.remove('hover-active');
            });
        });

        // Listen for system theme changes if not in Electron
        if (!isElectron) {
            window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function(e) {
                if (!localStorage.getItem('darkMode')) {
                    appState.darkMode = e.matches;
                    applyTheme();
                }
            });
        }
    }

    // Toggle dark mode
    function toggleDarkMode() {
        appState.darkMode = !appState.darkMode;
        localStorage.setItem('darkMode', appState.darkMode ? 'enabled' : 'disabled');
        applyTheme();
        
        // If in Electron, save theme setting
        if (isElectron) {
            window.electron.saveThemeSetting(appState.darkMode).catch(error => {
                console.error('Error saving theme setting:', error);
            });
        }
        
        // Show notification
        showNotification(
            appState.darkMode ? 'Dark mode enabled' : 'Light mode enabled', 
            'info'
        );
    }

    // Apply theme based on current state
    function applyTheme() {
        if (appState.darkMode) {
            document.documentElement.classList.add('dark-mode');
            if (themeIcon && themeText) {
                themeIcon.classList.remove('fa-moon');
                themeIcon.classList.add('fa-sun');
                themeText.textContent = 'Light Mode';
            }
        } else {
            document.documentElement.classList.remove('dark-mode');
            if (themeIcon && themeText) {
                themeIcon.classList.remove('fa-sun');
                themeIcon.classList.add('fa-moon');
                themeText.textContent = 'Dark Mode';
            }
        }
    }

    // Animate UI elements on load
    function animateUIElements() {
        if (!appState.animationsEnabled) return;

        // Animate sidebar items with stagger
        const sidebarSections = document.querySelectorAll('.sidebar-section');
        sidebarSections.forEach((section, i) => {
            const items = section.querySelectorAll('.sidebar-item');
            items.forEach((item, j) => {
                item.style.animationDelay = `${0.1 + i * 0.05 + j * 0.05}s`;
            });
        });

        // Animate cards with stagger
        const cards = document.querySelectorAll('.card');
        cards.forEach((card, i) => {
            card.style.animationDelay = `${0.2 + i * 0.1}s`;
        });
    }

    // Navigate to a specific view
    function navigateTo(view) {
        // Update header title
        const header = document.querySelector('.header .title');
        if (header) {
            header.textContent = view.charAt(0).toUpperCase() + view.slice(1);
        }
        
        // Update active sidebar item
        const sidebarItems = document.querySelectorAll('.sidebar-item');
        sidebarItems.forEach(item => {
            const link = item.querySelector('a');
            if (link && link.getAttribute('data-view') === view) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });
        
        // Handle view-specific content
        appState.currentView = view;
        
        // Show/hide sections based on the current view
        const allSections = document.querySelectorAll('section.section');
        
        // First hide all sections with a fade out
        allSections.forEach(section => {
            section.classList.add('fade-out');
            section.style.opacity = '0';
        });
        
        // After the fade out animation completes, show the appropriate sections
        setTimeout(() => {
            allSections.forEach(section => {
                // Initially hide all sections
                section.classList.add('hidden');
                section.classList.remove('fade-out');
                
                // Show only relevant sections for each view
                if (view === 'dashboard') {
                    if (section.id === 'ai-info') {
                        section.classList.remove('hidden');
                        setTimeout(() => {
                            section.style.opacity = '1';
                        }, 50);
                    }
                } else if (view === 'projects') {
                    if (section.id === 'project-management' || section.id === 'project-list') {
                        section.classList.remove('hidden');
                        setTimeout(() => {
                            section.style.opacity = '1';
                        }, 50);
                    }
                }
                // Add more views as needed
            });
            
            // Special handling for dashboard view
            if (view === 'dashboard') {
                const cardsRow = document.querySelector('.cards-row');
                if (cardsRow) {
                    cardsRow.classList.remove('hidden');
                    setTimeout(() => {
                        cardsRow.style.opacity = '1';
                    }, 50);
                }
            } else {
                const cardsRow = document.querySelector('.cards-row');
                if (cardsRow) {
                    cardsRow.classList.add('hidden');
                    cardsRow.style.opacity = '0';
                }
            }
            
            // Dispatch viewChanged event
            document.dispatchEvent(new CustomEvent('viewChanged', {
                detail: {
                    view: view
                }
            }));
        }, 300); // Wait for fade out to complete
    }

    // Check all statuses
    function checkAllStatuses() {
        Promise.all([
            checkServerStatus(),
            checkRemoteStatus(),
            checkAIStatus(),
            checkDatabaseStatus(),
            checkActiveDirectoryStatus()
        ]).then(() => {
            updateStatusIndicators();
        }).catch(error => {
            console.error('Error checking statuses:', error);
            showNotification('Failed to check system status', 'error');
        });
    }

    // Check server status
    function checkServerStatus() {
        return new Promise((resolve) => {
            fetch('/api/status/server')
                .then(response => {
                    if (response.ok) {
                        return response.json();
                    }
                    throw new Error('Server status check failed');
                })
                .then(data => {
                    appState.serverStatus = data.running ? 'online' : 'offline';
                    resolve();
                })
                .catch(error => {
                    console.error('Server status error:', error);
                    appState.serverStatus = 'error';
                    resolve();
                });
        });
    }

    // Check remote control status
    function checkRemoteStatus() {
        return new Promise((resolve) => {
            if (isElectron) {
                // If in Electron, get status from the main process
                window.electron.getRemoteControlStatus()
                    .then(data => {
                        appState.remoteStatus = data.enabled ? 'online' : 'offline';
                        resolve();
                    })
                    .catch(error => {
                        console.error('Remote status error:', error);
                        appState.remoteStatus = 'error';
                        resolve();
                    });
            } else {
                // If in browser, use fetch API
                fetch('/api/status/remote')
                    .then(response => {
                        if (response.ok) {
                            return response.json();
                        }
                        throw new Error('Remote status check failed');
                    })
                    .then(data => {
                        appState.remoteStatus = data.running ? 'online' : 'offline';
                        resolve();
                    })
                    .catch(error => {
                        console.error('Remote status error:', error);
                        appState.remoteStatus = 'error';
                        resolve();
                    });
            }
        });
    }

    // Check AI provider status
    function checkAIStatus() {
        return new Promise((resolve) => {
            fetch('/api/ai/status')
                .then(response => {
                    if (response.ok) {
                        return response.json();
                    }
                    throw new Error('AI status check failed');
                })
                .then(data => {
                    // Store provider information
                    appState.aiProviders = data.providers || {};
                    appState.activeProvider = data.activeProvider || null;
                    
                    // Update AI status based on whether any provider is enabled
                    appState.aiStatus = data.enabled ? 'online' : 'offline';
                    
                    // Update UI with provider information
                    updateAIProviderInfo(data);
                    
                    resolve();
                })
                .catch(error => {
                    console.error('AI status error:', error);
                    appState.aiStatus = 'error';
                    resolve();
                });
        });
    }

    // Update AI provider information in the UI
    function updateAIProviderInfo(data) {
        const aiStatusElement = document.getElementById('ai-provider-info');
        if (!aiStatusElement) return;
        
        // Clear existing content
        aiStatusElement.innerHTML = '';
        
        if (!data.enabled) {
            aiStatusElement.innerHTML = '<span class="warning-text">No AI providers configured</span>';
            return;
        }
        
        // Get active provider info
        let activeProviderInfo = '';
        if (data.activeProvider === 'claude') {
            const claude = data.providers.claude;
            activeProviderInfo = `
                <div class="provider-active">
                    <i class="fas fa-robot pulse-success"></i> 
                    <span>Active: Claude AI (${claude.model})</span>
                    ${claude.codeEnabled ? '<span class="badge badge-success">Code</span>' : ''}
                    ${claude.thinking ? '<span class="badge badge-info">Thinking</span>' : ''}
                </div>
            `;
            
            // Add Claude features if available
            if (claude.features && claude.features.length > 0) {
                activeProviderInfo += `
                    <div class="provider-features">
                        <small>Features: ${claude.features.join(', ')}</small>
                    </div>
                `;
            }
        } else if (data.activeProvider === 'perplexity') {
            const perplexity = data.providers.perplexity;
            activeProviderInfo = `
                <div class="provider-active">
                    <i class="fas fa-brain pulse-success"></i> 
                    <span>Active: Perplexity AI (${perplexity.model})</span>
                </div>
            `;
        }
        
        // Add information about available providers
        let providersInfo = '<div class="provider-list">';
        
        if (data.providers.claude && data.providers.claude.enabled) {
            providersInfo += `
                <div class="provider-item ${data.activeProvider === 'claude' ? 'active' : ''}">
                    <span class="status-dot status-success"></span>
                    <span>Claude AI</span>
                </div>
            `;
        }
        
        if (data.providers.perplexity && data.providers.perplexity.enabled) {
            providersInfo += `
                <div class="provider-item ${data.activeProvider === 'perplexity' ? 'active' : ''}">
                    <span class="status-dot status-success"></span>
                    <span>Perplexity AI</span>
                </div>
            `;
        }
        
        providersInfo += '</div>';
        
        // Update the element
        aiStatusElement.innerHTML = activeProviderInfo + providersInfo;
    }
    
    // Function to switch AI provider
    function switchAIProvider(provider) {
        if (!provider) return;
        
        // Save user preference to localStorage for persistence
        localStorage.setItem('preferredAIProvider', provider);
        
        // Make API request to switch provider
        fetch('/api/ai/provider', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ provider })
        })
        .then(response => {
            if (response.ok) {
                return response.json();
            }
            throw new Error('Failed to switch AI provider');
        })
        .then(data => {
            // Refresh AI status
            checkAIStatus();
            showNotification(`Switched to ${provider === 'claude' ? 'Claude AI' : 'Perplexity AI'}`, 'success');
        })
        .catch(error => {
            console.error('Error switching AI provider:', error);
            showNotification('Failed to switch AI provider', 'error');
        });
    }

    // Check database status
    function checkDatabaseStatus() {
        return new Promise((resolve) => {
            if (isElectron) {
                // If in Electron, get status from the main process
                window.electron.getDatabaseStatus()
                    .then(data => {
                        appState.dbStatus = data.connected ? 'online' : 'offline';
                        resolve();
                    })
                    .catch(error => {
                        console.error('Database status error:', error);
                        appState.dbStatus = 'error';
                        resolve();
                    });
            } else {
                // If in browser, use fetch API
                fetch('/api/status')
                    .then(response => {
                        if (response.ok) {
                            return response.json();
                        }
                        throw new Error('Database status check failed');
                    })
                    .then(data => {
                        if (data.database) {
                            appState.dbStatus = data.database.connected ? 'online' : 'offline';
                        } else {
                            appState.dbStatus = 'not-available';
                        }
                        resolve();
                    })
                    .catch(error => {
                        console.error('Database status error:', error);
                        appState.dbStatus = 'error';
                        resolve();
                    });
            }
        });
    }

    // New function to check the active directory status
    function checkActiveDirectoryStatus() {
        const activeDirIndicator = document.getElementById('active-dir-status');
        if (!activeDirIndicator) return;
        
        fetch('/api/active-directory')
            .then(response => {
                if (!response.ok) {
                    throw new Error('No active directory set');
                }
                return response.json();
            })
            .then(data => {
                if (data && data.path) {
                    activeDirIndicator.className = 'status-indicator status-success';
                    activeDirIndicator.title = `Active Directory: ${data.path}`;
                    
                    // Update any UI elements that show the active directory
                    const activeDirectoryElements = document.querySelectorAll('.active-directory-path');
                    activeDirectoryElements.forEach(element => {
                        element.textContent = data.path;
                    });
                } else {
                    activeDirIndicator.className = 'status-indicator status-warning';
                    activeDirIndicator.title = 'No active directory set';
                }
            })
            .catch(error => {
                console.error('Error checking active directory:', error);
                activeDirIndicator.className = 'status-indicator status-error';
                activeDirIndicator.title = 'Error checking active directory';
            });
    }

    // Update status indicators in the UI
    function updateStatusIndicators() {
        // Update server status
        const serverIndicator = document.getElementById('server-status');
        updateStatusIndicator(serverIndicator, appState.serverStatus);
        
        // Update remote control status
        const remoteIndicator = document.getElementById('remote-status');
        updateStatusIndicator(remoteIndicator, appState.remoteStatus);
        
        // Update AI status
        const aiIndicator = document.getElementById('ai-status');
        updateStatusIndicator(aiIndicator, appState.aiStatus);
        
        // Update Database status
        const dbIndicator = document.getElementById('db-status');
        if (dbIndicator) {
            updateStatusIndicator(dbIndicator, appState.dbStatus);
        }
    }

    // Update a single status indicator
    function updateStatusIndicator(indicator, status) {
        if (!indicator) return;
        
        // Remove existing status classes
        indicator.classList.remove('status-success', 'status-warning', 'status-danger');
        
        // Add appropriate status class
        switch(status) {
            case 'online':
                indicator.classList.add('status-success');
                indicator.classList.add('pulse-animation');
                setTimeout(() => {
                    indicator.classList.remove('pulse-animation');
                }, 1000);
                break;
            case 'offline':
                indicator.classList.add('status-warning');
                break;
            case 'error':
                indicator.classList.add('status-danger');
                break;
            default:
                indicator.classList.add('status-warning');
        }
    }

    // Load projects from the server
    function loadProjects() {
        setLoading(true);
        
        // Use Electron API if available, otherwise use fetch
        if (isElectron) {
            window.electron.loadProjects()
                .then(data => {
                    appState.projects = data.projects || [];
                    renderProjects();
                    setLoading(false);
                    showNotification('Projects loaded successfully', 'success');
                })
                .catch(error => {
                    console.error('Error loading projects:', error);
                    setLoading(false);
                    showNotification('Failed to load projects', 'error');
                    renderEmptyProjectState('Error loading projects. Please try again.');
                });
        } else {
            fetch('/api/projects')
                .then(response => {
                    if (response.ok) {
                        return response.json();
                    }
                    throw new Error('Failed to load projects');
                })
                .then(data => {
                    appState.projects = data.projects || [];
                    renderProjects();
                    setLoading(false);
                    showNotification('Projects loaded successfully', 'success');
                })
                .catch(error => {
                    console.error('Error loading projects:', error);
                    setLoading(false);
                    showNotification('Failed to load projects', 'error');
                    renderEmptyProjectState('Error loading projects. Please try again.');
                });
        }
    }

    // Render projects to the UI
    function renderProjects() {
        const projectsContainer = document.getElementById('projects-container');
        if (!projectsContainer) {
            console.error('Projects container not found');
            return;
        }

        if (!appState.projects || appState.projects.length === 0) {
            renderEmptyProjectState('No projects found');
            return;
        }

        const defaultProjectId = localStorage.getItem('defaultProjectId') || '';
        projectsContainer.innerHTML = '';

        // Get project numbers from projects_config.json (indirectly)
        let projectNumbers = {};
        fetch('/api/projects/numbers')
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    projectNumbers = data.projectNumbers || {};
                }
                
                // Now render the projects with numbers
                appState.projects.forEach(project => {
                    const projectNumber = projectNumbers[project.name] || '?';
                    const isDefault = project.id === defaultProjectId;
                    const projectCard = document.createElement('div');
                    projectCard.className = 'project-card';
                    if (isDefault) {
                        projectCard.classList.add('default-project');
                    }

                    projectCard.innerHTML = `
                        <div class="project-card-header">
                            <div class="project-info">
                                <span class="project-number">#${projectNumber}</span>
                                <h3 class="project-name">${project.name || 'Unnamed Project'}</h3>
                                ${isDefault ? '<span class="default-badge">Default</span>' : ''}
                            </div>
                            <div class="project-actions">
                                <button class="btn-icon set-default-btn" data-project-id="${project.id}" title="Set as Default">
                                    <i class="fas fa-star"></i>
                                </button>
                                <button class="btn-icon delete-project-btn" data-project-id="${project.id}" title="Delete Project">
                                    <i class="fas fa-trash"></i>
                                </button>
                            </div>
                        </div>
                        <div class="project-card-body">
                            <div class="project-details">
                                <p class="project-path">${project.path || 'No path specified'}</p>
                                <p class="project-type">${project.type || 'No type specified'}</p>
                                <p class="project-created">Created: ${new Date(project.createdAt || Date.now()).toLocaleDateString()}</p>
                            </div>
                        </div>
                    `;

                    projectsContainer.appendChild(projectCard);

                    // Add event listeners
                    projectCard.querySelector('.set-default-btn').addEventListener('click', (e) => {
                        e.stopPropagation();
                        setDefaultProject(project.id);
                    });

                    projectCard.querySelector('.delete-project-btn').addEventListener('click', (e) => {
                        e.stopPropagation();
                        deleteProject(project.id);
                    });

                    // Make the whole card clickable to navigate
                    projectCard.addEventListener('click', () => {
                        navigateTo('project-details');
                        // TODO: Load and display project details
                    });
                });
            })
            .catch(error => {
                console.error('Error loading project numbers:', error);
                // Fallback to rendering without numbers
                renderProjectsWithoutNumbers();
            });
    }

    // Fallback function to render projects without numbers
    function renderProjectsWithoutNumbers() {
        const projectsContainer = document.getElementById('projects-container');
        if (!projectsContainer) return;
        
        const defaultProjectId = localStorage.getItem('defaultProjectId') || '';
        projectsContainer.innerHTML = '';
        
        appState.projects.forEach(project => {
            const isDefault = project.id === defaultProjectId;
            const projectCard = document.createElement('div');
            projectCard.className = 'project-card';
            if (isDefault) {
                projectCard.classList.add('default-project');
            }

            projectCard.innerHTML = `
                <div class="project-card-header">
                    <div class="project-info">
                        <h3 class="project-name">${project.name || 'Unnamed Project'}</h3>
                        ${isDefault ? '<span class="default-badge">Default</span>' : ''}
                    </div>
                    <div class="project-actions">
                        <button class="btn-icon set-default-btn" data-project-id="${project.id}" title="Set as Default">
                            <i class="fas fa-star"></i>
                        </button>
                        <button class="btn-icon delete-project-btn" data-project-id="${project.id}" title="Delete Project">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
                <div class="project-card-body">
                    <div class="project-details">
                        <p class="project-path">${project.path || 'No path specified'}</p>
                        <p class="project-type">${project.type || 'No type specified'}</p>
                        <p class="project-created">Created: ${new Date(project.createdAt || Date.now()).toLocaleDateString()}</p>
                    </div>
                </div>
            `;

            projectsContainer.appendChild(projectCard);

            // Add event listeners
            projectCard.querySelector('.set-default-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                setDefaultProject(project.id);
            });

            projectCard.querySelector('.delete-project-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                deleteProject(project.id);
            });

            // Make the whole card clickable to navigate
            projectCard.addEventListener('click', () => {
                navigateTo('project-details');
                // TODO: Load and display project details
            });
        });
    }

    // Render empty state for projects
    function renderEmptyProjectState(message) {
        if (!projectList) return;
        
        projectList.innerHTML = `
            <div class="empty-state fade-in">
                <i class="fa-solid fa-folder-open"></i>
                <p>${message}</p>
            </div>
        `;
    }

    // Add a new project
    function addProject() {
        const nameInput = document.getElementById('project-name');
        const pathInput = document.getElementById('project-path');
        const typeInput = document.getElementById('project-type');
        
        if (!nameInput || !pathInput || !typeInput) return;
        
        const name = nameInput.value.trim();
        const path = pathInput.value.trim();
        const type = typeInput.value;
        
        if (!name || !path) {
            showNotification('Please fill out all required fields', 'warning');
            return;
        }
        
        setLoading(true);
        
        // Use Electron API if available, otherwise use fetch
        if (isElectron) {
            window.electron.addProject({ name, path, type })
                .then(data => {
                    if (data.success && data.project) {
                        appState.projects.push(data.project);
                        renderProjects();
                        
                        // Clear form
                        nameInput.value = '';
                        pathInput.value = '';
                        typeInput.value = 'web';
                        
                        showNotification('Project added successfully', 'success');
                    } else {
                        throw new Error(data.error || 'Failed to add project');
                    }
                    setLoading(false);
                })
                .catch(error => {
                    console.error('Error adding project:', error);
                    setLoading(false);
                    showNotification(error.message || 'Failed to add project', 'error');
                });
        } else {
            fetch('/api/projects', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name,
                    path,
                    type
                })
            })
            .then(response => {
                if (response.ok) {
                    return response.json();
                }
                throw new Error('Failed to add project');
            })
            .then(data => {
                // Add new project to the list
                if (data.project) {
                    appState.projects.push(data.project);
                    renderProjects();
                }
                
                // Clear form
                nameInput.value = '';
                pathInput.value = '';
                typeInput.value = 'web';
                
                setLoading(false);
                showNotification('Project added successfully', 'success');
            })
            .catch(error => {
                console.error('Error adding project:', error);
                setLoading(false);
                showNotification('Failed to add project', 'error');
            });
        }
    }

    // Set a project as default
    function setDefaultProject(projectId) {
        setLoading(true);
        
        // Use Electron API if available, otherwise use fetch
        if (isElectron) {
            window.electron.setDefaultProject(projectId)
                .then(data => {
                    if (data.success) {
                        showNotification('Default project updated', 'success');
                    } else {
                        throw new Error('Failed to set default project');
                    }
                    setLoading(false);
                })
                .catch(error => {
                    console.error('Error setting default project:', error);
                    setLoading(false);
                    showNotification('Failed to set default project', 'error');
                });
        } else {
            fetch(`/api/projects/${projectId}/default`, {
                method: 'PUT'
            })
            .then(response => {
                if (response.ok) {
                    return response.json();
                }
                throw new Error('Failed to set default project');
            })
            .then(() => {
                setLoading(false);
                showNotification('Default project updated', 'success');
            })
            .catch(error => {
                console.error('Error setting default project:', error);
                setLoading(false);
                showNotification('Failed to set default project', 'error');
            });
        }
    }

    // Delete a project
    function deleteProject(projectId) {
        if (!confirm('Are you sure you want to delete this project?')) {
            return;
        }
        
        setLoading(true);
        
        // Use Electron API if available, otherwise use fetch
        if (isElectron) {
            window.electron.deleteProject(projectId)
                .then(data => {
                    if (data.success) {
                        // Remove project from the list
                        appState.projects = appState.projects.filter(p => p.id !== projectId);
                        renderProjects();
                        showNotification('Project deleted successfully', 'success');
                    } else {
                        throw new Error('Failed to delete project');
                    }
                    setLoading(false);
                })
                .catch(error => {
                    console.error('Error deleting project:', error);
                    setLoading(false);
                    showNotification('Failed to delete project', 'error');
                });
        } else {
            fetch(`/api/projects/${projectId}`, {
                method: 'DELETE'
            })
            .then(response => {
                if (response.ok) {
                    return response.json();
                }
                throw new Error('Failed to delete project');
            })
            .then(() => {
                // Remove project from the list
                appState.projects = appState.projects.filter(p => p.id !== projectId);
                renderProjects();
                
                setLoading(false);
                showNotification('Project deleted successfully', 'success');
            })
            .catch(error => {
                console.error('Error deleting project:', error);
                setLoading(false);
                showNotification('Failed to delete project', 'error');
            });
        }
    }

    // Show about dialog
    function showAboutDialog() {
        // Get app version if running in Electron
        let version = 'Web Version';
        
        if (isElectron) {
            window.electron.getAppVersion().then(data => {
                version = data.version;
                
                showDialog(
                    'About Gaana AI Assistant',
                    `
                    <div class="about-dialog">
                        <div class="app-logo">
                            <i class="fa-solid fa-music fa-3x"></i>
                        </div>
                        <h2>Gaana AI Assistant</h2>
                        <p class="version">Version ${version}</p>
                        <p>A powerful desktop application for managing projects, handling phone calls, and controlling your desktop with AI.</p>
                        <p class="copyright">© ${new Date().getFullYear()} Your Company</p>
                    </div>
                    `
                );
            }).catch(error => {
                console.error('Error getting app version:', error);
                
                showDialog(
                    'About Gaana AI Assistant',
                    `
                    <div class="about-dialog">
                        <div class="app-logo">
                            <i class="fa-solid fa-music fa-3x"></i>
                        </div>
                        <h2>Gaana AI Assistant</h2>
                        <p class="version">Version Unknown</p>
                        <p>A powerful desktop application for managing projects, handling phone calls, and controlling your desktop with AI.</p>
                        <p class="copyright">© ${new Date().getFullYear()} Your Company</p>
                    </div>
                    `
                );
            });
        } else {
            showDialog(
                'About Gaana AI Assistant',
                `
                <div class="about-dialog">
                    <div class="app-logo">
                        <i class="fa-solid fa-music fa-3x"></i>
                    </div>
                    <h2>Gaana AI Assistant</h2>
                    <p class="version">${version}</p>
                    <p>A powerful web application for managing projects, handling phone calls, and controlling your desktop with AI.</p>
                    <p class="copyright">© ${new Date().getFullYear()} Your Company</p>
                </div>
                `
            );
        }
    }

    // Check for updates
    function checkForUpdates() {
        if (!isElectron) {
            showNotification('Update checking is only available in the desktop app', 'info');
            return;
        }
        
        showNotification('Checking for updates...', 'info');
        
        // In a real implementation, this would communicate with an update server
        // For now, we'll just simulate a check
        setTimeout(() => {
            showNotification('You are running the latest version', 'success');
        }, 2000);
    }

    // Show a dialog
    function showDialog(title, content) {
        // Create dialog overlay
        const overlay = document.createElement('div');
        overlay.className = 'dialog-overlay fade-in';
        
        // Create dialog
        const dialog = document.createElement('div');
        dialog.className = 'dialog slide-up';
        
        dialog.innerHTML = `
            <div class="dialog-header">
                <h3 class="dialog-title">${title}</h3>
                <button class="dialog-close">
                    <i class="fa-solid fa-times"></i>
                </button>
            </div>
            <div class="dialog-body">
                ${content}
            </div>
            <div class="dialog-footer">
                <button class="btn btn-primary dialog-ok">OK</button>
            </div>
        `;
        
        // Add to document
        overlay.appendChild(dialog);
        document.body.appendChild(overlay);
        
        // Handle close button
        const closeBtn = dialog.querySelector('.dialog-close');
        const okBtn = dialog.querySelector('.dialog-ok');
        
        function closeDialog() {
            overlay.classList.add('fade-out');
            dialog.classList.add('slide-down');
            
            setTimeout(() => {
                document.body.removeChild(overlay);
            }, 300);
        }
        
        if (closeBtn) {
            closeBtn.addEventListener('click', closeDialog);
        }
        
        if (okBtn) {
            okBtn.addEventListener('click', closeDialog);
        }
    }

    // Show notification
    function showNotification(message, type = 'info', duration = 3000) {
        if (!notificationContainer) return;
        
        const notification = document.createElement('div');
        notification.className = `notification notification-${type} slide-in-right`;
        
        // Add icon based on type
        let icon = 'fa-info-circle';
        switch(type) {
            case 'success':
                icon = 'fa-check-circle';
                break;
            case 'warning':
                icon = 'fa-exclamation-triangle';
                break;
            case 'error':
                icon = 'fa-times-circle';
                break;
        }
        
        notification.innerHTML = `
            <div class="notification-icon">
                <i class="fa-solid ${icon}"></i>
            </div>
            <div class="notification-content">
                <p>${message}</p>
            </div>
            <button class="notification-close">
                <i class="fa-solid fa-times"></i>
            </button>
        `;
        
        notificationContainer.appendChild(notification);
        
        // Add event listener to close button
        const closeButton = notification.querySelector('.notification-close');
        closeButton.addEventListener('click', () => {
            notification.classList.remove('slide-in-right');
            notification.classList.add('slide-out-right');
            setTimeout(() => {
                notification.parentNode.removeChild(notification);
            }, 300);
        });
        
        // Auto-remove after duration
        setTimeout(() => {
            if (notification.parentNode === notificationContainer) {
                notification.classList.remove('slide-in-right');
                notification.classList.add('slide-out-right');
                setTimeout(() => {
                    if (notification.parentNode === notificationContainer) {
                        notification.parentNode.removeChild(notification);
                    }
                }, 300);
            }
        }, duration);
    }

    // Set loading state
    function setLoading(isLoading) {
        appState.isLoading = isLoading;
        
        if (loadingOverlay) {
            if (isLoading) {
                loadingOverlay.classList.remove('hidden');
                setTimeout(() => {
                    loadingOverlay.classList.add('fade-in');
                }, 10);
                
                // Add auto-hide after 3 seconds to prevent the loading screen from being stuck
                setTimeout(() => {
                    if (appState.isLoading) {  // Only auto-hide if still loading
                        console.log('Auto-hiding loading overlay after timeout');
                        hideLoading();
                    }
                }, 3000);
            } else {
                hideLoading();
            }
        }
    }
    
    function hideLoading() {
        loadingOverlay.classList.remove('fade-in');
        loadingOverlay.classList.add('fade-out');
        setTimeout(() => {
            loadingOverlay.classList.add('hidden');
            loadingOverlay.classList.remove('fade-out');
            appState.isLoading = false;
        }, 300);
    }

    // Show loading overlay with optional timeout
    function showLoading(message = 'Processing your request...', timeout = 0) {
        if (!loadingOverlay) return;
        
        // Clear any existing timeout
        if (loadingTimeout) {
            clearTimeout(loadingTimeout);
            loadingTimeout = null;
        }
        
        // Update message if provided
        if (loadingText) {
            loadingText.textContent = message;
        }
        
        // Show the overlay
        loadingOverlay.classList.remove('hidden');
        
        // Set timeout to auto-hide if requested
        if (timeout > 0) {
            loadingTimeout = setTimeout(() => {
                hideLoading();
            }, timeout);
        }
    }

    // Directory permissions handling
    function initDirectoryPermissions() {
      // Load directories when settings view is shown
      window.addEventListener('viewChanged', (event) => {
        if (event.detail && event.detail.view === 'settings') {
          loadDirectories();
        }
      });
      
      // Add directory button
      const addDirectoryBtn = document.getElementById('add-directory-btn');
      if (addDirectoryBtn) {
        addDirectoryBtn.addEventListener('click', showDirectoryModal);
      }
      
      // Initialize directories from env button
      const initDirectoriesBtn = document.getElementById('init-directories-btn');
      if (initDirectoriesBtn) {
        initDirectoriesBtn.addEventListener('click', initializeDirectoriesFromEnv);
      }
      
      // Directory form submission
      const directoryForm = document.getElementById('directory-form');
      if (directoryForm) {
        directoryForm.addEventListener('submit', handleAddDirectory);
      }
      
      // Modal close button
      const modalCloseBtn = document.querySelector('.modal-close');
      if (modalCloseBtn) {
        modalCloseBtn.addEventListener('click', hideDirectoryModal);
      }
      
      // Modal cancel button
      const modalCancelBtn = document.querySelector('.modal-cancel');
      if (modalCancelBtn) {
        modalCancelBtn.addEventListener('click', hideDirectoryModal);
      }
      
      // API key toggle buttons
      const toggleClaudeKey = document.getElementById('toggle-claude-key');
      if (toggleClaudeKey) {
        toggleClaudeKey.addEventListener('click', () => togglePasswordVisibility('claude-api-key'));
      }
      
      const togglePerplexityKey = document.getElementById('toggle-perplexity-key');
      if (togglePerplexityKey) {
        togglePerplexityKey.addEventListener('click', () => togglePasswordVisibility('perplexity-api-key'));
      }
      
      // Save API keys button
      const saveApiKeysBtn = document.getElementById('save-api-keys');
      if (saveApiKeysBtn) {
        saveApiKeysBtn.addEventListener('click', saveApiKeys);
      }
      
      // Load API keys
      loadApiKeys();
    }
    
    // Toggle password visibility
    function togglePasswordVisibility(inputId) {
      const input = document.getElementById(inputId);
      if (!input) return;
      
      const type = input.getAttribute('type') === 'password' ? 'text' : 'password';
      input.setAttribute('type', type);
      
      // Update icon
      const button = input.nextElementSibling;
      const icon = button.querySelector('i');
      
      if (type === 'text') {
        icon.classList.remove('fa-eye');
        icon.classList.add('fa-eye-slash');
      } else {
        icon.classList.remove('fa-eye-slash');
        icon.classList.add('fa-eye');
      }
    }
    
    // Load API keys from stored values
    async function loadApiKeys() {
      try {
        // Try to get API keys from storage
        const claudeKeyInput = document.getElementById('claude-api-key');
        const perplexityKeyInput = document.getElementById('perplexity-api-key');
        
        // Fetch API status to get the current keys (masked)
        const response = await fetch('/api/ai/status');
        if (!response.ok) return;
        
        const data = await response.json();
        
        // Update inputs with masked values
        if (data.providers.claude && claudeKeyInput) {
          claudeKeyInput.placeholder = data.providers.claude.enabled ? 
            'Key is set (click to change)' : 
            'sk-ant-api03-*****';
        }
        
        if (data.providers.perplexity && perplexityKeyInput) {
          perplexityKeyInput.placeholder = data.providers.perplexity.enabled ? 
            'Key is set (click to change)' : 
            'pplx-*****';
        }
      } catch (error) {
        console.error('Error loading API keys:', error);
      }
    }
    
    // Save API keys
    async function saveApiKeys() {
      try {
        showLoading('Saving API keys...');
        
        const claudeKey = document.getElementById('claude-api-key').value;
        const perplexityKey = document.getElementById('perplexity-api-key').value;
        
        const apiKeysToUpdate = {};
        
        if (claudeKey) {
          apiKeysToUpdate.CLAUDE_API_KEY = claudeKey;
        }
        
        if (perplexityKey) {
          apiKeysToUpdate.PERPLEXITY_API_KEY = perplexityKey;
        }
        
        // Only make the request if there are keys to update
        if (Object.keys(apiKeysToUpdate).length > 0) {
          const response = await fetch('/api/settings/update-keys', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ apiKeys: apiKeysToUpdate })
          });
          
          if (!response.ok) {
            throw new Error('Failed to save API keys');
          }
          
          // Clear the input fields
          document.getElementById('claude-api-key').value = '';
          document.getElementById('perplexity-api-key').value = '';
          
          // Show success notification
          showNotification('API keys saved successfully', 'success');
          
          // Reload API status
          checkAIStatus();
        }
        
        hideLoading();
      } catch (error) {
        hideLoading();
        console.error('Error saving API keys:', error);
        showNotification('Failed to save API keys: ' + error.message, 'error');
      }
    }
    
    // Load directories
    async function loadDirectories() {
      const directoriesContainer = document.getElementById('directories-container');
      if (!directoriesContainer) return;
      
      try {
        directoriesContainer.innerHTML = `
          <div class="empty-state">
            <i class="fa-solid fa-spinner fa-spin"></i>
            <p>Loading directories...</p>
          </div>
        `;
        
        const response = await fetch('/api/v2/directories');
        
        if (!response.ok) {
          throw new Error(`Failed to load directories: ${response.status}`);
        }
        
        const directories = await response.json();
        
        if (directories.length === 0) {
          directoriesContainer.innerHTML = `
            <div class="empty-state">
              <i class="fa-solid fa-folder-open"></i>
              <p>No directories found. Add your first directory above.</p>
            </div>
          `;
          return;
        }
        
        // Render directories
        directoriesContainer.innerHTML = `
          <div class="directory-list">
            ${directories.map(renderDirectoryItem).join('')}
          </div>
        `;
        
        // Add event listeners for directory actions
        setupDirectoryActionEvents();
      } catch (error) {
        console.error('Error loading directories:', error);
        directoriesContainer.innerHTML = `
          <div class="empty-state error">
            <i class="fa-solid fa-exclamation-circle"></i>
            <p>Failed to load directories: ${error.message}</p>
            <button class="btn btn-sm retry-btn">Retry</button>
          </div>
        `;
        
        // Add retry functionality
        const retryBtn = directoriesContainer.querySelector('.retry-btn');
        if (retryBtn) {
          retryBtn.addEventListener('click', loadDirectories);
        }
      }
    }
    
    // Render directory item
    function renderDirectoryItem(directory) {
      return `
        <div class="directory-item" data-id="${directory._id}">
          <div class="directory-header">
            <div class="directory-icon">
              <i class="fa-solid fa-folder"></i>
            </div>
            <div class="directory-content">
              <h4 class="directory-name">${directory.name}</h4>
              <p class="directory-path">${directory.path}</p>
              <p class="directory-description">${directory.description || 'No description'}</p>
            </div>
            <div class="directory-actions">
              <button class="btn btn-icon directory-edit" title="Edit Directory">
                <i class="fa-solid fa-edit"></i>
              </button>
              <button class="btn btn-icon directory-delete" title="Delete Directory">
                <i class="fa-solid fa-trash"></i>
              </button>
            </div>
          </div>
          <div class="directory-details">
            <div class="permission-badges">
              <span class="badge ${directory.allowModification ? 'badge-success' : 'badge-danger'}">
                <i class="fa-solid ${directory.allowModification ? 'fa-check' : 'fa-times'}"></i>
                Modification
              </span>
              <span class="badge ${directory.allowExecution ? 'badge-success' : 'badge-danger'}">
                <i class="fa-solid ${directory.allowExecution ? 'fa-check' : 'fa-times'}"></i>
                Execution
              </span>
              <span class="badge badge-info">
                <i class="fa-solid fa-file"></i>
                ${directory.allowedFileTypes.length} File Types
              </span>
              <span class="badge badge-info">
                <i class="fa-solid fa-terminal"></i>
                ${directory.allowedCommands.length} Commands
              </span>
            </div>
          </div>
        </div>
      `;
    }
    
    // Setup directory action event listeners
    function setupDirectoryActionEvents() {
      // Edit directory buttons
      document.querySelectorAll('.directory-edit').forEach(button => {
        button.addEventListener('click', (e) => {
          e.stopPropagation();
          const directoryId = button.closest('.directory-item').dataset.id;
          editDirectory(directoryId);
        });
      });
      
      // Delete directory buttons
      document.querySelectorAll('.directory-delete').forEach(button => {
        button.addEventListener('click', (e) => {
          e.stopPropagation();
          const directoryId = button.closest('.directory-item').dataset.id;
          deleteDirectory(directoryId);
        });
      });
    }
    
    // Show directory modal
    function showDirectoryModal() {
      const modal = document.getElementById('directory-modal');
      if (modal) {
        modal.classList.remove('hidden');
      }
    }
    
    // Hide directory modal
    function hideDirectoryModal() {
      const modal = document.getElementById('directory-modal');
      if (modal) {
        modal.classList.add('hidden');
        
        // Reset form
        const form = document.getElementById('directory-form');
        if (form) {
          form.reset();
        }
      }
    }
    
    // Handle add directory form submission
    async function handleAddDirectory(e) {
      e.preventDefault();
      
      try {
        showLoading('Adding directory...');
        
        // Get form values
        const path = document.getElementById('directory-path').value.trim();
        const description = document.getElementById('directory-desc').value.trim();
        const allowModification = document.getElementById('allow-modification').checked;
        const allowExecution = document.getElementById('allow-execution').checked;
        const allowedFileTypes = document.getElementById('allowed-filetypes').value.split(',').map(type => type.trim()).filter(Boolean);
        const allowedCommands = document.getElementById('allowed-commands').value.split(',').map(cmd => cmd.trim()).filter(Boolean);
        
        // Validate input
        if (!path) {
          throw new Error('Directory path is required');
        }
        
        // Create directory data
        const directoryData = {
          path,
          description,
          allowModification,
          allowExecution,
          allowedFileTypes,
          allowedCommands,
          status: 'active'
        };
        
        // Send request
        const response = await fetch('/api/v2/directories', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(directoryData)
        });
        
        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || `Failed to add directory: ${response.status}`);
        }
        
        // Hide modal and reload directories
        hideDirectoryModal();
        loadDirectories();
        
        // Show success notification
        showNotification('Directory added successfully', 'success');
      } catch (error) {
        console.error('Error adding directory:', error);
        showNotification(`Failed to add directory: ${error.message}`, 'error');
      } finally {
        hideLoading();
      }
    }
    
    // Edit directory
    async function editDirectory(directoryId) {
      try {
        showLoading('Loading directory details...');
        
        // Get directory details
        const response = await fetch(`/api/v2/directories/${directoryId}`);
        
        if (!response.ok) {
          throw new Error(`Failed to get directory: ${response.status}`);
        }
        
        const directory = await response.json();
        
        // Update modal title
        const modalTitle = document.querySelector('.modal-title');
        if (modalTitle) {
          modalTitle.textContent = 'Edit Directory';
        }
        
        // Update form with directory details
        document.getElementById('directory-path').value = directory.path;
        document.getElementById('directory-desc').value = directory.description || '';
        document.getElementById('allow-modification').checked = directory.allowModification;
        document.getElementById('allow-execution').checked = directory.allowExecution;
        document.getElementById('allowed-filetypes').value = directory.allowedFileTypes.join(',');
        document.getElementById('allowed-commands').value = directory.allowedCommands.join(',');
        
        // Update form submission handler
        const form = document.getElementById('directory-form');
        if (form) {
          // Remove existing submit handler
          const newForm = form.cloneNode(true);
          form.parentNode.replaceChild(newForm, form);
          
          // Add new submit handler
          newForm.addEventListener('submit', (e) => {
            e.preventDefault();
            updateDirectory(directoryId);
          });
        }
        
        // Show modal
        showDirectoryModal();
        hideLoading();
      } catch (error) {
        hideLoading();
        console.error('Error editing directory:', error);
        showNotification(`Failed to edit directory: ${error.message}`, 'error');
      }
    }
    
    // Update directory
    async function updateDirectory(directoryId) {
      try {
        showLoading('Updating directory...');
        
        // Get form values
        const path = document.getElementById('directory-path').value.trim();
        const description = document.getElementById('directory-desc').value.trim();
        const allowModification = document.getElementById('allow-modification').checked;
        const allowExecution = document.getElementById('allow-execution').checked;
        const allowedFileTypes = document.getElementById('allowed-filetypes').value.split(',').map(type => type.trim()).filter(Boolean);
        const allowedCommands = document.getElementById('allowed-commands').value.split(',').map(cmd => cmd.trim()).filter(Boolean);
        
        // Validate input
        if (!path) {
          throw new Error('Directory path is required');
        }
        
        // Create directory data
        const directoryData = {
          path,
          description,
          allowModification,
          allowExecution,
          allowedFileTypes,
          allowedCommands
        };
        
        // Send request
        const response = await fetch(`/api/v2/directories/${directoryId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(directoryData)
        });
        
        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || `Failed to update directory: ${response.status}`);
        }
        
        // Hide modal and reload directories
        hideDirectoryModal();
        loadDirectories();
        
        // Show success notification
        showNotification('Directory updated successfully', 'success');
      } catch (error) {
        console.error('Error updating directory:', error);
        showNotification(`Failed to update directory: ${error.message}`, 'error');
      } finally {
        hideLoading();
      }
    }
    
    // Delete directory
    async function deleteDirectory(directoryId) {
      try {
        // Confirm deletion
        const confirmDelete = confirm('Are you sure you want to delete this directory? This will remove Claude\'s permissions to access this location.');
        if (!confirmDelete) return;
        
        showLoading('Deleting directory...');
        
        // Send request
        const response = await fetch(`/api/v2/directories/${directoryId}`, {
          method: 'DELETE'
        });
        
        if (!response.ok) {
          throw new Error(`Failed to delete directory: ${response.status}`);
        }
        
        // Reload directories
        loadDirectories();
        
        // Show success notification
        showNotification('Directory deleted successfully', 'success');
      } catch (error) {
        console.error('Error deleting directory:', error);
        showNotification(`Failed to delete directory: ${error.message}`, 'error');
      } finally {
        hideLoading();
      }
    }
    
    // Initialize directories from environment
    async function initializeDirectoriesFromEnv() {
      try {
        showLoading('Initializing directories from environment...');
        
        // Send request to initialize directories
        const response = await fetch('/api/v2/directories/init', {
          method: 'POST'
        });
        
        if (!response.ok) {
          throw new Error(`Failed to initialize directories: ${response.status}`);
        }
        
        const result = await response.json();
        
        // Reload directories
        loadDirectories();
        
        // Show success notification
        showNotification(`Successfully initialized ${result.count} directories`, 'success');
      } catch (error) {
        console.error('Error initializing directories:', error);
        showNotification(`Failed to initialize directories: ${error.message}`, 'error');
      } finally {
        hideLoading();
      }
    }

    // Initialize
    document.addEventListener('DOMContentLoaded', () => {
      initializeUI();
      setupElectronListeners();
      setupEventListeners();
      checkAllStatuses();
      loadProjects();
      initDirectoryPermissions();
    });
}); 