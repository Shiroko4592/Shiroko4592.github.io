# 네이버 인도네시아어 오픈사전 (Naver Indonesian Open Dictionary)

## Overview
A web-based Indonesian-Korean dictionary application with Naver OAuth login integration. Users can add, search, favorite, and manage Indonesian-Korean word pairs. The application uses localStorage for data persistence and includes dark mode functionality.

## Project Type
Full-stack web application with Flask backend and vanilla JavaScript frontend

## Key Features
- Naver OAuth login integration
- Word management (add, delete, favorite)
- Real-time search functionality
- Dark mode toggle
- Modal word detail view
- Local storage for data persistence
- Backend proxy for Naver API (resolves CORS issues)

## Tech Stack
- **Frontend**: Vanilla JavaScript, HTML5, CSS3
- **Backend**: Flask (Python), Flask-CORS, Requests
- **Authentication**: Naver OAuth 2.0
- **Storage**: Browser localStorage
- **Server**: Flask development server

## Project Structure
```
.
├── index.html          # Main HTML page
├── app.js              # JavaScript application logic
├── styles.css          # Styling and dark mode
├── server.py           # Flask backend with Naver API proxy
├── README.md           # Project information (Korean)
├── .gitignore          # Git ignore rules
└── CNAME              # Custom domain configuration
```

## Setup & Configuration
- **Port**: 5000 (required for Replit)
- **Host**: 0.0.0.0 (to allow external access)
- **Naver OAuth Client ID**: Configured in app.js
- **API Proxy**: /api/naver/profile endpoint

## Recent Changes
- **2025-10-26**: Imported from GitHub and configured for Replit environment
  - Set up Flask backend server for static file serving
  - Added Naver API proxy endpoint to resolve CORS issues
  - Modified app.js to use backend proxy instead of direct API calls
  - Configured workflow to run Flask server on port 5000
  - Added .gitignore for Python and Replit files
  - Configured deployment settings for autoscale

## User Preferences
None yet

## Architecture Notes
- Flask backend serves static files and provides API proxy
- Backend proxy resolves CORS issues when calling Naver API
- All user data stored in browser localStorage (client-side)
- OAuth redirect handled client-side via URL hash parameters
- Backend endpoint `/api/naver/profile` proxies requests to Naver's user profile API

## Known Issues & Solutions
- **CORS Issue**: Direct browser calls to Naver API are blocked by CORS policy
  - **Solution**: Flask backend proxies the API call to avoid CORS restrictions
- **Login Flow**: Token received via URL hash after OAuth redirect
  - Token stored in localStorage for subsequent API calls
