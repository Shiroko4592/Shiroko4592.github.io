# 네이버 인도네시아어 오픈사전 (Naver Indonesian Open Dictionary)

## Overview
A web-based Indonesian-Korean dictionary application with Naver OAuth login integration. Users can add, search, favorite, and manage Indonesian-Korean word pairs. The application uses localStorage for data persistence and includes dark mode functionality.

## Project Type
Static web application (HTML/CSS/JavaScript) - Frontend only

## Key Features
- Naver OAuth login integration
- Word management (add, delete, favorite)
- Real-time search functionality
- Dark mode toggle
- Modal word detail view
- Local storage for data persistence

## Tech Stack
- **Frontend**: Vanilla JavaScript, HTML5, CSS3
- **Authentication**: Naver OAuth 2.0
- **Storage**: Browser localStorage
- **Server**: Python HTTP server (for development)

## Project Structure
```
.
├── index.html          # Main HTML page
├── app.js              # JavaScript application logic
├── styles.css          # Styling and dark mode
├── README.md           # Project information (Korean)
└── CNAME              # Custom domain configuration
```

## Setup & Configuration
- **Port**: 5000 (required for Replit)
- **Host**: 0.0.0.0 (to allow external access)
- **Naver OAuth Client ID**: Configured in app.js

## Recent Changes
- **2025-10-26**: Imported from GitHub and configured for Replit environment
  - Set up Python HTTP server for static file serving
  - Configured workflow to run on port 5000
  - Added .gitignore for Python and Replit files
  - Configured deployment settings

## User Preferences
None yet

## Architecture Notes
- Pure client-side application with no backend
- All data stored in browser localStorage
- OAuth redirect handled client-side via URL hash parameters
- Simple Python HTTP server used for serving static files in development
