from flask import url_for, current_app
from flask_mail import Message
from app import mail

def send_verification_email(user):
    """Send email verification to user"""
    token = user.verification_token
    
    msg = Message(
        'Verify Your DARKSULFOCUS Account',
        recipients=[user.email]
    )
    
    verify_url = url_for('main.verify_email', token=token, _external=True)
    
    msg.html = f'''
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #1a1a1a, #2d2d2d); padding: 30px; text-align: center;">
            <h1 style="color: #00ff88; margin: 0;">DARKSULFOCUS</h1>
            <p style="color: #cccccc; margin: 10px 0 0 0;">Gamified Study Platform</p>
        </div>
        
        <div style="background: #f8f9fa; padding: 30px;">
            <h2 style="color: #333; margin-top: 0;">Welcome to DARKSULFOCUS!</h2>
            <p style="color: #666; line-height: 1.6;">
                Thank you for joining our gamified study platform. To start your journey and access all features, 
                please verify your email address by clicking the button below.
            </p>
            
            <div style="text-align: center; margin: 30px 0;">
                <a href="{verify_url}" 
                   style="background: #00ff88; color: #1a1a1a; padding: 12px 30px; text-decoration: none; 
                          border-radius: 5px; font-weight: bold; display: inline-block;">
                    Verify Email Address
                </a>
            </div>
            
            <p style="color: #666; font-size: 14px;">
                If the button doesn't work, copy and paste this link into your browser:<br>
                <a href="{verify_url}" style="color: #00ff88;">{verify_url}</a>
            </p>
        </div>
        
        <div style="background: #1a1a1a; padding: 20px; text-align: center;">
            <p style="color: #888; margin: 0; font-size: 12px;">
                If you didn't create this account, please ignore this email.
            </p>
        </div>
    </div>
    '''
    
    try:
        mail.send(msg)
        current_app.logger.info(f'Verification email sent to {user.email}')
    except Exception as e:
        current_app.logger.error(f'Failed to send verification email: {e}')

def send_reset_email(user):
    """Send password reset email to user"""
    token = user.reset_token
    
    msg = Message(
        'Reset Your DARKSULFOCUS Password',
        recipients=[user.email]
    )
    
    reset_url = url_for('main.reset_password', token=token, _external=True)
    
    msg.html = f'''
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #1a1a1a, #2d2d2d); padding: 30px; text-align: center;">
            <h1 style="color: #00ff88; margin: 0;">DARKSULFOCUS</h1>
            <p style="color: #cccccc; margin: 10px 0 0 0;">Password Reset Request</p>
        </div>
        
        <div style="background: #f8f9fa; padding: 30px;">
            <h2 style="color: #333; margin-top: 0;">Reset Your Password</h2>
            <p style="color: #666; line-height: 1.6;">
                We received a request to reset your password for your DARKSULFOCUS account. 
                Click the button below to set a new password.
            </p>
            
            <div style="text-align: center; margin: 30px 0;">
                <a href="{reset_url}" 
                   style="background: #00ff88; color: #1a1a1a; padding: 12px 30px; text-decoration: none; 
                          border-radius: 5px; font-weight: bold; display: inline-block;">
                    Reset Password
                </a>
            </div>
            
            <p style="color: #666; font-size: 14px;">
                This link will expire in 1 hour. If the button doesn't work, copy and paste this link:<br>
                <a href="{reset_url}" style="color: #00ff88;">{reset_url}</a>
            </p>
        </div>
        
        <div style="background: #1a1a1a; padding: 20px; text-align: center;">
            <p style="color: #888; margin: 0; font-size: 12px;">
                If you didn't request this reset, please ignore this email.
            </p>
        </div>
    </div>
    '''
    
    try:
        mail.send(msg)
        current_app.logger.info(f'Password reset email sent to {user.email}')
    except Exception as e:
        current_app.logger.error(f'Failed to send reset email: {e}')
