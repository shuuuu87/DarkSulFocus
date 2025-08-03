/**
 * DARKSULFOCUS - Local Storage Timer Management
 * Handles persistent timer state using browser local storage
 * Timers persist through page refreshes, navigation, and logouts
 */

class TimerManager {
    constructor() {
        this.timers = new Map();
        this.updateInterval = null;
        this.initialized = false;
        this.storageKey = 'darksulfocus_timers';
        
        this.init();
    }

    init() {
        if (this.initialized) return;
        
        this.loadTimersFromStorage();
        this.findAndInitializeTimers();
        this.startUpdateLoop();
        this.setupEventListeners();
        
        this.initialized = true;
        console.log('Timer Manager initialized with local storage');
    }

    loadTimersFromStorage() {
        try {
            const storedTimers = localStorage.getItem(this.storageKey);
            if (storedTimers) {
                const timersData = JSON.parse(storedTimers);
                Object.entries(timersData).forEach(([taskId, timerData]) => {
                    let remainingSeconds = timerData.remainingSeconds;
                    // If endTimestamp is present and not paused, calculate remaining
                    if (timerData.endTimestamp && !timerData.isPaused) {
                        const now = Date.now();
                        remainingSeconds = Math.max(0, Math.ceil((timerData.endTimestamp - now) / 1000));
                    }
                    this.timers.set(taskId, {
                        ...timerData,
                        remainingSeconds: remainingSeconds,
                        lastUpdate: Date.now(),
                        element: null, // Will be set when DOM elements are found
                        taskItem: null
                    });
                });
                console.log(`Loaded ${this.timers.size} timers from local storage`);
            }
        } catch (error) {
            console.error('Error loading timers from storage:', error);
            localStorage.removeItem(this.storageKey);
        }
    }

    saveTimersToStorage() {
        try {
            const timersData = {};
            this.timers.forEach((timer, taskId) => {
                // Save endTimestamp if running, remainingSeconds if paused
                let timerData = {
                    isPaused: timer.isPaused,
                    totalDuration: timer.totalDuration,
                    title: timer.title,
                    lastUpdate: timer.lastUpdate
                };
                if (!timer.isPaused && timer.endTimestamp) {
                    timerData.endTimestamp = timer.endTimestamp;
                } else {
                    timerData.remainingSeconds = Math.ceil(timer.remainingSeconds);
                }
                timersData[taskId] = timerData;
            });
            localStorage.setItem(this.storageKey, JSON.stringify(timersData));
        } catch (error) {
            console.error('Error saving timers to storage:', error);
        }
    }

    findAndInitializeTimers() {
        const timerElements = document.querySelectorAll('.timer-display');
        
        timerElements.forEach(element => {
            const taskId = this.getTaskId(element);
            const taskItem = element.closest('.task-item');
            
            if (taskId) {
                // Check if timer exists in storage
                let timer = this.timers.get(taskId);
                
                if (!timer) {
                    // Create new timer from DOM data
                    const remainingSeconds = parseInt(element.dataset.remaining) || 0;
                    const titleElement = taskItem.querySelector('.task-title');
                    const durationElement = taskItem.querySelector('.task-duration');
                    
                    timer = {
                        remainingSeconds: remainingSeconds,
                        isPaused: true, // New timers start paused
                        lastUpdate: Date.now(),
                        totalDuration: remainingSeconds,
                        title: titleElement ? titleElement.textContent : 'Task',
                        element: element,
                        taskItem: taskItem
                    };
                    this.timers.set(taskId, timer);
                } else {
                    // Restore DOM references for existing timer
                    timer.element = element;
                    timer.taskItem = taskItem;
                }
                
                this.updateTimerDisplay(taskId);
                this.updateTimerVisualState(timer);
            }
        });
        
        // Clean up timers that no longer have DOM elements
        this.cleanupOrphanedTimers();
        
        console.log(`Initialized ${this.timers.size} timers`);
        this.saveTimersToStorage();
    }

    cleanupOrphanedTimers() {
        // Only cleanup if we're on a page that shows tasks
        const taskContainer = document.querySelector('.task-card, .tasks-container, .task-list, #active-tasks');
        if (!taskContainer) {
            // Not on a tasks page, don't cleanup timers
            return;
        }

        const activeTaskIds = new Set();
        document.querySelectorAll('.task-item').forEach(item => {
            const taskId = item.dataset.taskId;
            if (taskId) activeTaskIds.add(taskId);
        });

        // Only remove timers that don't have corresponding DOM elements on task pages
        for (const [taskId, timer] of this.timers.entries()) {
            if (!activeTaskIds.has(taskId)) {
                this.timers.delete(taskId);
                console.log(`Cleaned up orphaned timer: ${taskId}`);
            }
        }
    }

    getTaskId(element) {
        const taskItem = element.closest('.task-item');
        return taskItem ? taskItem.dataset.taskId : null;
    }

    startUpdateLoop() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }
        
        this.updateInterval = setInterval(() => {
            this.updateActiveTimers();
        }, 1000);
    }

    // No server sync needed - using local storage only

    updateActiveTimers() {
        const now = Date.now();
        let needsSave = false;
        this.timers.forEach((timer, taskId) => {
            if (!timer.isPaused && timer.endTimestamp && timer.remainingSeconds > 0) {
                const prevSeconds = Math.ceil(timer.remainingSeconds);
                timer.remainingSeconds = Math.max(0, Math.ceil((timer.endTimestamp - now) / 1000));
                timer.lastUpdate = now;
                // Only update DOM if value changed
                if (Math.ceil(timer.remainingSeconds) !== prevSeconds) {
                    this.updateTimerDisplay(taskId);
                }
                // Check if timer completed
                if (timer.remainingSeconds <= 0) {
                    this.handleTimerCompletion(taskId);
                }
            }
        });
    }

    updateTimerDisplay(taskId) {
        const timer = this.timers.get(taskId);
        if (!timer || !timer.element) return;
        // Only use integer seconds for display
        const intSeconds = Math.ceil(timer.remainingSeconds);
        const timeString = this.formatTime(intSeconds);
        timer.element.textContent = timeString;
        // Update visual state based on remaining time
        this.updateTimerVisualState(timer);
    }

    updateTimerVisualState(timer) {
        const element = timer.element;
        const taskItem = timer.taskItem;
        
        // Remove existing state classes
        element.classList.remove('timer-warning', 'timer-danger', 'timer-completed');
        
        if (timer.remainingSeconds <= 0) {
            element.classList.add('timer-completed');
        } else if (timer.remainingSeconds <= 300) { // Last 5 minutes
            element.classList.add('timer-danger');
        } else if (timer.remainingSeconds <= 600) { // Last 10 minutes
            element.classList.add('timer-warning');
        }
        
        // Update pause state and button
        if (timer.isPaused) {
            taskItem?.classList.add('paused');
        } else {
            taskItem?.classList.remove('paused');
        }
        
        // Update the play/pause button
        this.updateControlButton(taskItem, timer.isPaused);
    }

    updateControlButton(taskItem, isPaused) {
        if (!taskItem) return;
        
        const controlsDiv = taskItem.querySelector('.task-controls');
        if (!controlsDiv) return;
        
        // Find the existing play/pause button
        const existingButton = controlsDiv.querySelector('.btn-success, .btn-warning');
        if (!existingButton) return;
        
        // Create new button based on state
        const newButton = document.createElement('a');
        newButton.href = '#';
        newButton.className = isPaused ? 'btn btn-success btn-sm' : 'btn btn-warning btn-sm';
        newButton.innerHTML = isPaused ? '<i class="fas fa-play"></i>' : '<i class="fas fa-pause"></i>';
        
        // Replace the existing button
        existingButton.replaceWith(newButton);
    }

    handleTimerCompletion(taskId) {
        const timer = this.timers.get(taskId);
        if (!timer) return;
        
        console.log(`Timer ${taskId} completed`);
        
        // Stop the timer
        timer.isPaused = true;
        timer.remainingSeconds = 0;
        
        // Save to local storage
        this.saveTimersToStorage();
        
        // Update server about completion
        this.completeTask(taskId);
        
        // Show completion notification
        this.showCompletionNotification(taskId);
        
        // Play completion sound (if available)
        this.playCompletionSound();
    }

    async completeTask(taskId) {
        try {
            const response = await fetch(`/complete_task/${taskId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': this.getCSRFToken()
                }
            });
            
            const data = await response.json();
            
            if (data.success && data.completed) {
                this.handleTaskCompleted(taskId, data.points_earned);
                console.log(`Task ${taskId} completed! Points earned: ${data.points_earned}`);
            } else {
                console.error(`Error completing task ${taskId}:`, data.error || 'Unknown error');
            }
        } catch (error) {
            console.error('Error completing task:', error);
        }
    }

    handleTaskCompleted(taskId, pointsEarned) {
        // Remove timer from active timers
        this.timers.delete(taskId);
        
        // Remove task item from DOM
        const timer = this.timers.get(taskId);
        const taskItem = timer?.taskItem;
        if (taskItem) {
            taskItem.style.transition = 'opacity 0.5s ease';
            taskItem.style.opacity = '0';
            setTimeout(() => {
                taskItem.remove();
            }, 500);
        }
        
        // Show completion modal
        this.showCompletionModal(pointsEarned);
        
        // Update stats in UI
        this.updatePointsDisplay(pointsEarned);
    }

    showCompletionNotification(taskId) {
        // Browser notification
        if (window.DarkSulFocus?.showNotification) {
            window.DarkSulFocus.showNotification(
                'Task Completed!',
                'Congratulations! You have completed your study task.',
                '/static/favicon.ico'
            );
        }
        
        // Toast notification
        if (window.DarkSulFocus?.showSuccessToast) {
            window.DarkSulFocus.showSuccessToast('Task completed successfully!');
        }
    }

    showCompletionModal(pointsEarned) {
        const modal = document.getElementById('timerCompleteModal');
        const pointsElement = document.getElementById('pointsEarned');
        
        if (modal && pointsElement) {
            pointsElement.textContent = `${pointsEarned.toFixed(1)} points`;
            
            const bsModal = new bootstrap.Modal(modal);
            bsModal.show();
        }
    }

    updatePointsDisplay(pointsEarned) {
        // Update total points display if visible
        const pointsDisplays = document.querySelectorAll('.stat-value, .points-display');
        pointsDisplays.forEach(element => {
            if (element.textContent.includes('points') || element.classList.contains('points-display')) {
                const currentPoints = parseFloat(element.textContent) || 0;
                const newPoints = currentPoints + pointsEarned;
                element.textContent = newPoints.toFixed(1);
            }
        });
    }

    playCompletionSound() {
        // Create and play completion sound
        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
            oscillator.frequency.setValueAtTime(600, audioContext.currentTime + 0.1);
            oscillator.frequency.setValueAtTime(800, audioContext.currentTime + 0.2);
            
            gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
            
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.3);
        } catch (error) {
            console.log('Audio notification not available:', error);
        }
    }

    // Local storage persistence - no server sync needed
    persistTimer(taskId) {
        this.saveTimersToStorage();
        console.log(`Timer ${taskId} persisted to local storage`);
    }

    pauseTimer(taskId) {
        const timer = this.timers.get(taskId);
        if (timer && !timer.isPaused) {
            // Calculate remainingSeconds from endTimestamp
            if (timer.endTimestamp) {
                timer.remainingSeconds = Math.max(0, Math.ceil((timer.endTimestamp - Date.now()) / 1000));
                delete timer.endTimestamp;
            }
            timer.isPaused = true;
            this.updateTimerVisualState(timer);
            this.saveTimersToStorage();
            console.log(`Timer ${taskId} paused`);
        }
    }

    resumeTimer(taskId) {
        const timer = this.timers.get(taskId);
        if (timer && timer.isPaused && timer.remainingSeconds > 0) {
            // Pause all other timers first (only one timer can run at a time)
            this.pauseAllTimers();
            timer.isPaused = false;
            timer.lastUpdate = Date.now();
            // Set endTimestamp for real-time tracking
            timer.endTimestamp = Date.now() + timer.remainingSeconds * 1000;
            this.updateTimerVisualState(timer);
            this.saveTimersToStorage();
            console.log(`Timer ${taskId} resumed`);
        }
    }

    pauseAllTimers() {
        this.timers.forEach((timer, taskId) => {
            if (!timer.isPaused) {
                timer.isPaused = true;
                this.updateTimerVisualState(timer);
            }
        });
        this.saveTimersToStorage();
    }

    removeTimer(taskId) {
        this.timers.delete(taskId);
        this.saveTimersToStorage();
    }

    // Create a new timer (when adding tasks)
    createTimer(taskId, durationMinutes, title) {
        const timer = {
            remainingSeconds: durationMinutes * 60,
            isPaused: true,
            lastUpdate: Date.now(),
            totalDuration: durationMinutes * 60,
            title: title,
            element: null,
            taskItem: null
            // endTimestamp will be set on resume
        };
        this.timers.set(taskId, timer);
        this.saveTimersToStorage();
        return timer;
    }

    // Reset a timer to its original duration
    resetTimer(taskId) {
        const timer = this.timers.get(taskId);
        if (timer) {
            timer.remainingSeconds = timer.totalDuration;
            timer.isPaused = true;
            timer.lastUpdate = Date.now();
            this.updateTimerDisplay(taskId);
            this.updateTimerVisualState(timer);
            this.saveTimersToStorage();
        }
    }

    formatTime(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    getCSRFToken() {
        const tokenElement = document.querySelector('meta[name=csrf-token]') || 
                            document.querySelector('input[name=csrf_token]');
        return tokenElement ? tokenElement.content || tokenElement.value : '';
    }

    setupEventListeners() {
        // Listen for task control button clicks
        document.addEventListener('click', (e) => {
            const taskItem = e.target.closest('.task-item');
            if (!taskItem) return;
            
            const taskId = taskItem.dataset.taskId;
            if (!taskId) return;
            
            // Handle pause/resume buttons
            if (e.target.closest('.btn-warning, .btn-success')) {
                e.preventDefault(); // Prevent default link behavior
                const timer = this.timers.get(taskId);
                if (timer && timer.isPaused) {
                    this.resumeTimer(taskId);
                } else if (timer) {
                    this.pauseTimer(taskId);
                }
            }
            
            // Handle delete button
            if (e.target.closest('.btn-danger')) {
                this.removeTimer(taskId);
            }
        });
        
        // Listen for page visibility changes to update lastUpdate times
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                // Update lastUpdate for all active timers when page becomes visible
                const now = Date.now();
                this.timers.forEach((timer, taskId) => {
                    if (!timer.isPaused) {
                        timer.lastUpdate = now;
                    }
                });
            }
        });
        
        // Save timers before page unload
        window.addEventListener('beforeunload', () => {
            this.saveTimersToStorage();
        });
        
        // Handle browser back/forward navigation
        window.addEventListener('pageshow', () => {
            // Refresh timer displays when page is shown (including back button)
            this.findAndInitializeTimers();
        });
    }

    destroy() {
        // Save timers before destroying
        this.saveTimersToStorage();
        
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
        
        // Don't clear timers - they're saved in local storage
        this.initialized = false;
    }
    
    // Clear all stored timers (for logout or manual reset)
    clearAllTimers() {
        this.timers.clear();
        localStorage.removeItem(this.storageKey);
        console.log('All timers cleared from local storage');
    }
}

// Initialize timer manager when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    window.timerManager = new TimerManager();
});

// Clean up when page is unloaded
window.addEventListener('beforeunload', function() {
    if (window.timerManager) {
        window.timerManager.destroy();
    }
});

// Export for global access
window.TimerManager = TimerManager;
