"""
Background Timer Service
Handles server-side timer completion checking and auto-completion
"""
from datetime import datetime
import time
import threading
import logging

class BackgroundTimerService:
    def __init__(self):
        self.running = False
        self.thread = None
        self.check_interval = 30  # Check every 30 seconds
        
    def start(self):
        """Start the background timer service"""
        if not self.running:
            self.running = True
            self.thread = threading.Thread(target=self._run_checker, daemon=True)
            self.thread.start()
            logging.info("Background Timer Service started")
            
    def stop(self):
        """Stop the background timer service"""
        self.running = False
        if self.thread:
            self.thread.join(timeout=5)
        logging.info("Background Timer Service stopped")
        
    def _run_checker(self):
        """Main loop to check for completed timers"""
        while self.running:
            try:
                # Import here to avoid circular imports
                from app import app, db
                with app.app_context():
                    self._check_completed_timers()
            except Exception as e:
                logging.error(f"Error in background timer checker: {e}")
            
            # Wait before next check
            time.sleep(self.check_interval)
    
    def _check_completed_timers(self):
        """Check for timers that should be completed and process them"""
        from app import db
        from models import Task
        
        # Find all active tasks that should be completed
        completed_tasks = Task.query.filter(
            Task.is_active == True,
            Task.is_completed == False,
            Task.expected_completion <= datetime.utcnow()
        ).all()
        
        if completed_tasks:
            logging.info(f"Found {len(completed_tasks)} completed timers")
            
        for task in completed_tasks:
            try:
                # Complete the task
                points_earned = task.complete_task()
                
                # Stop the server-side timer
                task.is_active = False
                task.started_at = None
                task.expected_completion = None
                
                db.session.commit()
                
                # Send achievement email if user has notifications enabled
                from models import User
                user = db.session.get(User, task.user_id)
                if user and user.achievement_emails:
                    try:
                        from email_service import EmailService
                        EmailService.send_achievement_unlock(user, 'task_completion', {
                            'task_title': task.title,
                            'points_earned': points_earned,
                            'total_points': user.total_points
                        })
                    except Exception as e:
                        logging.error(f"Failed to send completion email to user {user.id}: {e}")
                
                logging.info(f"Auto-completed task {task.id} for user {task.user_id}, awarded {points_earned:.1f} points")
                
            except Exception as e:
                logging.error(f"Error completing task {task.id}: {e}")
                db.session.rollback()

# Global instance
background_timer_service = BackgroundTimerService()