# DARKSULFOCUS - Gamified Study Platform

## Overview

DARKSULFOCUS is a gamified study platform built with Flask that helps users track their study progress through a point-based ranking system, streak tracking, and competitive challenges. The platform encourages consistent study habits through gamification elements including ranks, achievements, and peer competitions.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Backend Architecture
- **Framework**: Flask web framework with SQLAlchemy ORM
- **Database**: SQLite (configured for easy migration to PostgreSQL)
- **Authentication**: Flask-Login with email verification system
- **Email**: Flask-Mail for user verification and password reset
- **File Handling**: Werkzeug for secure file uploads (profile images)

### Frontend Architecture
- **Template Engine**: Jinja2 with Bootstrap 5 dark theme
- **CSS Framework**: Bootstrap 5 with custom dark theme styling
- **JavaScript**: Vanilla JavaScript with Chart.js for data visualization
- **Responsive Design**: Mobile-first approach with sidebar navigation

### Application Structure
- **Blueprint-based routing**: Clean separation of routes in `routes.py`
- **Form handling**: WTForms for validation and CSRF protection
- **Model-View-Controller**: Traditional MVC pattern with Flask blueprints

## Key Components

### User Management System
- **User Registration/Login**: Complete authentication flow with email verification
- **Password Reset**: Secure token-based password reset via email
- **Profile Management**: User profile updates with image upload support
- **Session Management**: Flask-Login handles user sessions with "remember me" functionality

### Gamification Engine
- **Ranking System**: 8-tier ranking system based on total points (Dormant to Legend)
- **Points System**: Dynamic point calculation based on study time and task completion
- **Streak Tracking**: Daily study streak with grace days mechanism
- **Progress Visualization**: Charts and progress bars for user engagement

### Task Management
- **Task Creation**: Users can create study tasks with time estimates
- **Timer System**: Real-time timer functionality with pause/resume capabilities
- **Task Completion**: Point rewards based on actual vs estimated time
- **Daily Statistics**: Tracking of daily study patterns and performance

### Competition Features
- **Challenge System**: Users can challenge each other to study competitions
- **Leaderboards**: Ranking comparisons between users
- **Social Elements**: Friend challenges and progress sharing

## Data Flow

### User Registration Flow
1. User submits registration form
2. Form validation (username/email uniqueness)
3. Password hashing and user creation
4. Email verification token generation
5. Verification email sent
6. User clicks verification link to activate account

### Study Session Flow
1. User creates or selects a task
2. Timer starts tracking study time
3. Real-time updates via JavaScript timer management
4. Session completion triggers point calculation
5. Streak and daily statistics updated
6. Progress charts refreshed

### Challenge Flow
1. User initiates challenge with another user
2. Challenge parameters stored (duration, rules)
3. Both users track progress during challenge period
4. Winner determined based on points/study time
5. Results notification and ranking updates

## External Dependencies

### Python Packages
- **Flask**: Core web framework
- **SQLAlchemy**: Database ORM with connection pooling
- **Flask-Login**: User session management
- **Flask-Mail**: Email functionality for verification/reset
- **WTForms**: Form handling and validation
- **Werkzeug**: WSGI utilities and security helpers
- **Pillow**: Image processing for profile pictures
- **pytz**: Timezone handling for international users

### Frontend Libraries
- **Bootstrap 5**: UI framework with dark theme
- **Font Awesome**: Icon library
- **Chart.js**: Data visualization for progress tracking
- **Vanilla JavaScript**: No heavy frontend framework dependencies

### Email Services
- **SMTP Configuration**: Configurable email provider (defaults to Gmail)
- **Email Templates**: HTML email templates for verification and password reset

## Deployment Strategy

### Environment Configuration
- **Environment Variables**: All sensitive config via environment variables
- **Database URL**: Configurable database connection string
- **Email Settings**: Configurable SMTP settings for different providers
- **File Uploads**: Configurable upload directory and size limits

### Production Considerations
- **Proxy Support**: ProxyFix middleware for deployment behind reverse proxies
- **Database Pool**: Connection pooling and ping for reliability
- **Session Security**: Configurable secret key for session management
- **File Security**: Secure filename handling for uploads

### Database Migration
- **SQLAlchemy Models**: Structured for easy migration from SQLite to PostgreSQL
- **Connection Pooling**: Pre-configured for production database scaling
- **Data Integrity**: Foreign key relationships and cascading deletes properly configured

### Security Features
- **CSRF Protection**: Built into all forms
- **Password Hashing**: Werkzeug secure password hashing
- **Email Verification**: Required before account activation
- **Token-based Reset**: Secure password reset with expiring tokens
- **File Upload Security**: Secure filename processing and size limits