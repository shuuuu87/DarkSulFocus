/**
 * DARKSULFOCUS - Timer Management JavaScript
 * Handles real-time timer updates, countdown functionality, and task completion
 */

class TimerManager {
    constructor() {
        this.timers = new Map();
        this.updateInterval = null;
        this.syncInterval = null;
        this.initialized = false;
        
        this.init();
    }

    init() {
        if (this.initialized) return;
        
        this.findAndInitializeTimers();
        this.startUpdateLoop();
        this.startSyncLoop();
        this.setupEventListeners();
        
        this.initialized = true;
        console.log('Timer Manager initialized');
    }

    findAndInitializeTimers() {
        const timerElements = document.querySelectorAll('.timer-display');
        
        timerElements.forEach(element => {
            const taskId = this.getTaskId(element);
            const remainingSeconds = parseInt(element.dataset.remaining) || 0;
            const taskItem = element.closest('.task-item');
            const isPaused = taskItem && taskItem.classList.contains('paused');
            // Only treat as paused if the class is present
            if (taskId) {
                this.timers.set(taskId, {
                    element: element,
                    remainingSeconds: remainingSeconds,
                    isPaused: isPaused,
                    lastUpdate: Date.now(),
                    taskItem: taskItem
                });
                this.updateTimerDisplay(taskId);
            }
        });
        
        console.log(`Initialized ${this.timers.size} timers`);
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

    startSyncLoop() {
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
        }
        
        // Sync with server every 30 seconds
        this.syncInterval = setInterval(() => {
            this.syncWithServer();
        }, 30000);
    }

    updateActiveTimers() {
        const now = Date.now();
        this.timers.forEach((timer, taskId) => {
            if (!timer.isPaused && timer.remainingSeconds > 0) {
                // Calculate elapsed time since last update (in seconds, can be fractional)
                const elapsed = (now - timer.lastUpdate) / 1000;
                if (elapsed >= 0.1) { // update at least every 100ms for smoothness
                    const prevSeconds = Math.ceil(timer.remainingSeconds);
                    timer.remainingSeconds = Math.max(0, timer.remainingSeconds - elapsed);
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
        
        // Update pause state
        if (timer.isPaused) {
            taskItem?.classList.add('paused');
        } else {
            taskItem?.classList.remove('paused');
        }
    }

    handleTimerCompletion(taskId) {
        const timer = this.timers.get(taskId);
        if (!timer) return;
        
        console.log(`Timer ${taskId} completed`);
        
        // Stop the timer
        timer.isPaused = true;
        timer.remainingSeconds = 0;
        
        // Update server about completion
        this.completeTask(taskId);
        
        // Show completion notification
        this.showCompletionNotification(taskId);
        
        // Play completion sound (if available)
        this.playCompletionSound();
    }

    async completeTask(taskId) {
        try {
            const response = await fetch('/update_timer', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': this.getCSRFToken()
                },
                body: JSON.stringify({
                    task_id: taskId,
                    remaining_seconds: 0
                })
            });
            
            const data = await response.json();
            
            if (data.completed) {
                this.handleTaskCompleted(taskId, data.points_earned);
            }
        } catch (error) {
            console.error('Error completing task:', error);
            window.DarkSulFocus?.showErrorToast('Failed to update task completion');
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

    async syncWithServer() {
        const activeTimers = Array.from(this.timers.entries())
            .filter(([_, timer]) => !timer.isPaused && timer.remainingSeconds > 0);
        
        if (activeTimers.length === 0) return;
        
        for (const [taskId, timer] of activeTimers) {
            try {
                await fetch('/update_timer', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRFToken': this.getCSRFToken()
                    },
                    body: JSON.stringify({
                        task_id: taskId,
                        remaining_seconds: timer.remainingSeconds
                    })
                });
            } catch (error) {
                console.error(`Error syncing timer ${taskId}:`, error);
            }
        }
    }

    pauseTimer(taskId) {
        const timer = this.timers.get(taskId);
        if (timer) {
            timer.isPaused = true;
            this.updateTimerVisualState(timer);
        }
    }

    resumeTimer(taskId) {
        const timer = this.timers.get(taskId);
        if (timer) {
            timer.isPaused = false;
            timer.lastUpdate = Date.now();
            this.updateTimerVisualState(timer);
        }
    }

    removeTimer(taskId) {
        this.timers.delete(taskId);
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
                const isPaused = taskItem.classList.contains('paused');
                if (isPaused) {
                    this.resumeTimer(taskId);
                } else {
                    this.pauseTimer(taskId);
                }
            }
            
            // Handle delete button
            if (e.target.closest('.btn-danger')) {
                this.removeTimer(taskId);
            }
        });
        
        // Listen for page visibility changes
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                // Re-sync when page becomes visible
                this.syncWithServer();
            }
        });
        
        // Listen for beforeunload to sync before leaving
        window.addEventListener('beforeunload', () => {
            this.syncWithServer();
        });
    }

    destroy() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
        
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
            this.syncInterval = null;
        }
        
        this.timers.clear();
        this.initialized = false;
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
