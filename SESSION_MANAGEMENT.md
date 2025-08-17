# Session Management Improvements

## Overview
The application has been updated to handle session expiration more gracefully and persist sessions across server restarts.

## What Was Fixed

### 1. Session Persistence
- **Before**: Sessions were stored in memory and lost when server restarted
- **After**: Sessions are now stored in a JSON file (`server/data/sessions.json`) and persist across server restarts

### 2. Better Error Handling
- **Before**: Generic "session not valid" errors
- **After**: Specific error messages for different session states:
  - `סשן לא תקף או פג תוקף` - Session not valid or expired
  - `סשן פג תוקף` - Session expired
  - `טוקן לא תקף` - Token not valid

### 3. Automatic Session Cleanup
- Expired sessions are automatically cleaned up every hour
- Sessions expire after 24 hours
- Invalid sessions are removed when detected

### 4. Client-Side Session Handling
- Automatic logout when sessions expire
- Consistent error handling across all components
- Utility functions for session management

## How It Works

### Server Side
1. **Session Storage**: Sessions are stored in `server/data/sessions.json`
2. **Automatic Cleanup**: Expired sessions are removed every hour
3. **File Persistence**: Sessions survive server restarts
4. **Logging**: Detailed logs for debugging session issues

### Client Side
1. **Error Detection**: Automatically detects session expiration errors
2. **Automatic Logout**: Redirects to login when sessions expire
3. **Consistent Handling**: All API calls handle session expiration the same way
4. **Utility Functions**: Centralized session management utilities

## Files Modified

### Server
- `server/routes/auth-users.js` - Session storage and authentication middleware
- `server/data/sessions.json` - Session persistence file (created automatically)

### Client
- `client/src/utils/auth.js` - New utility functions
- `client/src/App.js` - Improved token verification
- `client/src/components/UserManagement.js` - Session expiration handling
- `client/src/components/GateDashboard.js` - Session expiration handling

## Usage

### For Developers
The session management is now transparent - no code changes needed in components.

### For Users
- Sessions now persist across server restarts
- Automatic logout when sessions expire (after 24 hours)
- Better error messages for authentication issues

## Troubleshooting

### Common Issues
1. **"סשן לא תקף או פג תוקף"** - Session not valid or expired
   - Solution: User needs to log in again
   
2. **"סשן פג תוקף"** - Session expired
   - Solution: User needs to log in again (automatic)
   
3. **"טוקן לא תקף"** - Token not valid
   - Solution: User needs to log in again

### Debugging
Check server logs for session-related messages:
- Session loading/saving
- User authentication
- Session expiration
- Session cleanup

## Security Notes
- Sessions expire after 24 hours
- Expired sessions are automatically cleaned up
- Sessions are stored in plain text (consider encryption for production)
- Server restart no longer invalidates all sessions
