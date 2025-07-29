import os
import secrets
from datetime import datetime, timedelta
from flask import Blueprint, render_template, redirect, url_for, flash, request, jsonify, current_app
from flask_login import login_user, logout_user, login_required, current_user
from flask_mail import Message
from werkzeug.utils import secure_filename
from PIL import Image
import pytz

from app import db, mail
from models import User, Task, Challenge, DailyStats
from forms import LoginForm, RegisterForm, ProfileForm, TaskForm, ChallengeForm, ForgotPasswordForm, ResetPasswordForm
from utils import send_verification_email, send_reset_email

main = Blueprint('main', __name__)

@main.route('/')
def index():
    if current_user.is_authenticated:
        return redirect(url_for('main.home'))
    return redirect(url_for('main.login'))

@main.route('/login', methods=['GET', 'POST'])
def login():
    if current_user.is_authenticated:
        return redirect(url_for('main.home'))
    
    form = LoginForm()
    if form.validate_on_submit():
        # Try to find user by username first, then by email
        user = User.query.filter_by(username=form.username.data).first()
        if not user:
            user = User.query.filter_by(email=form.email.data).first()
        
        if user and user.check_password(form.password.data):
            if user.is_verified:
                login_user(user, remember=form.remember_me.data)
                next_page = request.args.get('next')
                return redirect(next_page) if next_page else redirect(url_for('main.home'))
            else:
                flash('Please verify your email before logging in.', 'warning')
        else:
            flash('Invalid username/email or password', 'danger')
    
    return render_template('login.html', form=form)

@main.route('/register', methods=['GET', 'POST'])
def register():
    if current_user.is_authenticated:
        return redirect(url_for('main.home'))
    
    form = RegisterForm()
    if form.validate_on_submit():
        user = User()
        user.username = form.username.data
        user.email = form.email.data
        user.verification_token = secrets.token_urlsafe(32)
        user.is_verified = True  # Auto-verify for now due to email config issues
        user.set_password(form.password.data)
        
        db.session.add(user)
        db.session.commit()
        
        # Try to send verification email, but don't block registration if it fails
        try:
            send_verification_email(user)
            flash('Registration successful! You can now log in. (Verification email may not work due to configuration)', 'success')
        except Exception as e:
            current_app.logger.error(f'Email send failed: {e}')
            flash('Registration successful! You can now log in directly.', 'success')
        
        return redirect(url_for('main.login'))
    
    return render_template('register.html', form=form)

@main.route('/verify/<token>')
def verify_email(token):
    user = User.query.filter_by(verification_token=token).first()
    if user:
        user.is_verified = True
        user.verification_token = None
        db.session.commit()
        flash('Email verified successfully! You can now log in.', 'success')
    else:
        flash('Invalid verification token.', 'danger')
    
    return redirect(url_for('main.login'))

@main.route('/home')
@login_required
def home():
    # Get user's active tasks
    active_tasks = Task.query.filter_by(user_id=current_user.id, is_active=True, is_completed=False).all()
    
    # Get today's study time for streak display
    ist = pytz.timezone('Asia/Kolkata')
    today = datetime.now(ist).date()
    daily_stat = DailyStats.query.filter_by(user_id=current_user.id, date=today).first()
    today_minutes = daily_stat.minutes_studied if daily_stat else 0
    
    return render_template('home.html', 
                         active_tasks=active_tasks,
                         today_minutes=today_minutes,
                         user_rank=current_user.get_rank())

@main.route('/add_task', methods=['POST'])
@login_required
def add_task():
    form = TaskForm()
    if form.validate_on_submit():
        task = Task()
        task.user_id = current_user.id
        task.title = form.title.data
        task.duration_minutes = form.duration_minutes.data
        task.remaining_seconds = (form.duration_minutes.data or 0) * 60
        db.session.add(task)
        db.session.commit()
        flash('Task added successfully!', 'success')
    else:
        for field, errors in form.errors.items():
            for error in errors:
                flash(f'{error}', 'danger')
    
    return redirect(url_for('main.home'))

@main.route('/start_timer/<int:task_id>')
@login_required
def start_timer(task_id):
    task = Task.query.filter_by(id=task_id, user_id=current_user.id).first_or_404()
    
    # Pause all other active tasks
    other_tasks = Task.query.filter_by(user_id=current_user.id, is_active=True, is_paused=False).filter(Task.id != task_id).all()
    for other_task in other_tasks:
        other_task.is_paused = True
        other_task.paused_at = datetime.utcnow()
    
    task.is_paused = False
    task.paused_at = None
    task.last_updated = datetime.utcnow()
    db.session.commit()
    
    return redirect(url_for('main.home'))

@main.route('/pause_timer/<int:task_id>')
@login_required
def pause_timer(task_id):
    task = Task.query.filter_by(id=task_id, user_id=current_user.id).first_or_404()
    task.is_paused = True
    task.paused_at = datetime.utcnow()
    db.session.commit()
    
    return redirect(url_for('main.home'))

@main.route('/delete_task/<int:task_id>')
@login_required
def delete_task(task_id):
    task = Task.query.filter_by(id=task_id, user_id=current_user.id).first_or_404()
    db.session.delete(task)
    db.session.commit()
    flash('Task deleted successfully!', 'success')
    
    return redirect(url_for('main.home'))

@main.route('/update_timer', methods=['POST'])
@login_required
def update_timer():
    data = request.get_json()
    task_id = data.get('task_id')
    remaining_seconds = data.get('remaining_seconds')
    
    task = Task.query.filter_by(id=task_id, user_id=current_user.id).first()
    if task and not task.is_paused:
        task.remaining_seconds = max(0, remaining_seconds)
        task.last_updated = datetime.utcnow()
        
        if task.remaining_seconds <= 0:
            points_earned = task.complete_task()
            db.session.commit()
            return jsonify({'completed': True, 'points_earned': points_earned})
        
        db.session.commit()
        return jsonify({'success': True})
    
    return jsonify({'error': 'Task not found or paused'})

@main.route('/profile', methods=['GET', 'POST'])
@login_required
def profile():
    form = ProfileForm(current_user)
    
    if form.validate_on_submit():
        # Check current password if trying to change password
        if form.new_password.data:
            if not form.current_password.data or not current_user.check_password(form.current_password.data):
                flash('Current password is incorrect.', 'danger')
                return render_template('profile.html', form=form)
            current_user.set_password(form.new_password.data)
        
        # Handle profile image upload
        if form.profile_image.data:
            filename = save_profile_image(form.profile_image.data)
            current_user.profile_image = filename
        
        current_user.username = form.username.data
        current_user.email = form.email.data
        
        db.session.commit()
        flash('Profile updated successfully!', 'success')
        return redirect(url_for('main.profile'))
    
    # Pre-populate form
    form.username.data = current_user.username
    form.email.data = current_user.email
    
    return render_template('profile.html', form=form)

@main.route('/progress')
@login_required
def progress():
    # Get last 30 days of study data
    ist = pytz.timezone('Asia/Kolkata')
    end_date = datetime.now(ist).date()
    start_date = end_date - timedelta(days=29)
    
    daily_stats = DailyStats.query.filter_by(user_id=current_user.id).filter(
        DailyStats.date >= start_date,
        DailyStats.date <= end_date
    ).all()
    
    # Create data for chart
    chart_data = []
    current_date = start_date
    stats_dict = {stat.date: stat.minutes_studied for stat in daily_stats}
    
    while current_date <= end_date:
        minutes = stats_dict.get(current_date, 0)
        hours = minutes / 60.0
        chart_data.append({
            'date': current_date.strftime('%b %d'),
            'hours': round(hours, 1)
        })
        current_date += timedelta(days=1)
    
    return render_template('progress.html', chart_data=chart_data)

@main.route('/competition', methods=['GET', 'POST'])
@login_required
def competition():
    form = ChallengeForm()
    
    if form.validate_on_submit():
        opponent = User.query.filter_by(username=form.opponent_username.data).first()
        
        if opponent and opponent.id == current_user.id:
            flash('You cannot challenge yourself!', 'danger')
        elif opponent:
            challenge = Challenge()
            challenge.challenger_id = current_user.id
            challenge.challenged_id = opponent.id
            challenge.duration_days = form.duration_days.data
            challenge.end_date = datetime.utcnow() + timedelta(days=form.duration_days.data)
            challenge.status = 'active'
            db.session.add(challenge)
            db.session.commit()
            flash(f'Challenge sent to {opponent.username}!', 'success')
            return redirect(url_for('main.competition'))
    
    # Get user's challenges
    sent_challenges = Challenge.query.filter_by(challenger_id=current_user.id).order_by(Challenge.created_at.desc()).limit(10).all()
    received_challenges = Challenge.query.filter_by(challenged_id=current_user.id).order_by(Challenge.created_at.desc()).limit(10).all()
    
    return render_template('competition.html', 
                         form=form,
                         sent_challenges=sent_challenges,
                         received_challenges=received_challenges)

@main.route('/accept_challenge/<int:challenge_id>')
@login_required
def accept_challenge(challenge_id):
    challenge = Challenge.query.filter_by(id=challenge_id, challenged_id=current_user.id).first_or_404()
    challenge.status = 'active'
    db.session.commit()
    flash('Challenge accepted!', 'success')
    return redirect(url_for('main.competition'))

@main.route('/decline_challenge/<int:challenge_id>')
@login_required
def decline_challenge(challenge_id):
    challenge = Challenge.query.filter_by(id=challenge_id, challenged_id=current_user.id).first_or_404()
    challenge.status = 'declined'
    db.session.commit()
    flash('Challenge declined.', 'info')
    return redirect(url_for('main.competition'))

@main.route('/help')
def help():
    return render_template('help.html')

@main.route('/forgot_password', methods=['GET', 'POST'])
def forgot_password():
    if current_user.is_authenticated:
        return redirect(url_for('main.home'))
    
    form = ForgotPasswordForm()
    if form.validate_on_submit():
        user = User.query.filter_by(email=form.email.data).first()
        if user:
            user.reset_token = secrets.token_urlsafe(32)
            user.reset_token_expires = datetime.utcnow() + timedelta(hours=1)
            db.session.commit()
            send_reset_email(user)
        
        flash('If an account with that email exists, a password reset link has been sent.', 'info')
        return redirect(url_for('main.login'))
    
    return render_template('forgot_password.html', form=form)

@main.route('/reset_password/<token>', methods=['GET', 'POST'])
def reset_password(token):
    if current_user.is_authenticated:
        return redirect(url_for('main.home'))
    
    user = User.query.filter_by(reset_token=token).first()
    if not user or user.reset_token_expires < datetime.utcnow():
        flash('Invalid or expired reset token.', 'danger')
        return redirect(url_for('main.forgot_password'))
    
    form = ResetPasswordForm()
    if form.validate_on_submit():
        user.set_password(form.password.data)
        user.reset_token = None
        user.reset_token_expires = None
        db.session.commit()
        flash('Password reset successful! You can now log in.', 'success')
        return redirect(url_for('main.login'))
    
    return render_template('reset_password.html', form=form)

@main.route('/logout')
@login_required
def logout():
    logout_user()
    flash('You have been logged out.', 'info')
    return redirect(url_for('main.login'))

def save_profile_image(form_image):
    random_hex = secrets.token_hex(8)
    _, f_ext = os.path.splitext(form_image.filename)
    picture_fn = random_hex + f_ext
    picture_path = os.path.join(current_app.root_path, 'static/uploads', picture_fn)
    
    # Resize image
    output_size = (150, 150)
    img = Image.open(form_image)
    img.thumbnail(output_size)
    img.save(picture_path)
    
    return picture_fn
