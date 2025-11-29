// Utility functions for handling authentication and session expiration

/**
 * Check if an error response indicates session expiration
 * @param {Object} errorData - The error response data
 * @returns {boolean} - True if session is expired
 */
export const isSessionExpired = (errorData) => {
  if (!errorData || !errorData.error) return false;

  const errorMessage = errorData.error;
  return (
    errorMessage.includes('סשן לא תקף') ||
    errorMessage.includes('סשן פג תוקף') ||
    errorMessage.includes('טוקן לא תקף') ||
    errorMessage.includes('שגיאה באימות')
  );
};

/**
 * Check if an error response indicates token expiration (but refresh token might still be valid)
 * @param {Object} errorData - The error response data
 * @returns {boolean} - True if access token is expired but refresh might work
 */
export const isTokenExpired = (errorData) => {
  if (!errorData || !errorData.error) return false;

  const errorMessage = errorData.error;
  return (
    errorMessage.includes('שגיאה באימות') ||
    errorMessage.includes('טוקן לא תקף') ||
    errorMessage.includes('סשן פג תוקף')
  );
};

// Global callback to update token in App.js state
let tokenUpdateCallback = null;

/**
 * Set callback to update token in App.js state
 * @param {Function} callback - Function to call when token is updated
 */
export const setTokenUpdateCallback = (callback) => {
  tokenUpdateCallback = callback;
};

/**
 * Refresh the access token using the refresh token
 * @returns {Promise<Object|null>} - New tokens or null if refresh failed
 * @returns {Promise<{success: false, reason: string}>} - If refresh failed with reason
 */
export const refreshAccessToken = async () => {
  try {
    // Check localStorage first, then sessionStorage
    let refreshToken = localStorage.getItem('refreshToken');
    let storage = localStorage;

    if (!refreshToken) {
      refreshToken = sessionStorage.getItem('refreshToken');
      storage = sessionStorage;
    }

    // If no refresh token exists, return failure with reason
    if (!refreshToken) {
      return { success: false, reason: 'no_refresh_token' };
    }

    const response = await fetch('/api/auth/refresh', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refreshToken }),
    });

    if (response.ok) {
      const data = await response.json();
      
      // Validate that we received both tokens
      if (!data.accessToken || !data.refreshToken) {
        console.error('Invalid refresh response: missing tokens');
        return { success: false, reason: 'invalid_response' };
      }
      
      // Update tokens in the same storage where refresh token was found
      storage.setItem('authToken', data.accessToken);
      storage.setItem('refreshToken', data.refreshToken);

      // Notify App.js to update token state
      if (tokenUpdateCallback) {
        tokenUpdateCallback(data.accessToken);
      }

      // Also dispatch custom event for same-tab updates
      window.dispatchEvent(new CustomEvent('customStorageChange', {
        detail: {
          key: 'authToken',
          newValue: data.accessToken,
          oldValue: storage.getItem('authToken')
        }
      }));

      return { success: true, accessToken: data.accessToken, refreshToken: data.refreshToken };
    }

    // Check if refresh token is expired or invalid
    let errorData = null;
    try {
      errorData = await response.json();
    } catch (e) {
      errorData = { error: 'שגיאה לא ידועה' };
    }
    
    if (response.status === 401) {
      // Check the specific error message to determine if token expired
      const errorMessage = errorData?.error || '';
      if (errorMessage.includes('סשן פג תוקף') || errorMessage.includes('טוקן לא תקף')) {
        return { success: false, reason: 'refresh_token_expired' };
      }
      // Other 401 errors (like invalid user)
      return { success: false, reason: 'refresh_token_invalid' };
    }

    // Other errors (400, 500, etc.)
    return { success: false, reason: 'refresh_failed' };
  } catch (error) {
    console.error('Failed to refresh token:', error);
    return { success: false, reason: 'network_error' };
  }
};

/**
 * Handle session expiration by redirecting to login
 */
export const handleSessionExpiration = () => {
  // Clear both localStorage and sessionStorage
  localStorage.removeItem('authToken');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('user');
  sessionStorage.removeItem('authToken');
  sessionStorage.removeItem('refreshToken');
  sessionStorage.removeItem('user');
  // Reload page to trigger login flow
  window.location.reload();
};

/**
 * Wrapper for fetch requests that automatically handles token refresh
 * @param {string} url - The URL to fetch
 * @param {Object} options - Fetch options
 * @returns {Promise<Response>} - The fetch response
 */
export const authenticatedFetch = async (url, options = {}) => {
  // Add authorization header if not present
  if (!options.headers) {
    options.headers = {};
  }

  if (!options.headers.Authorization) {
    // Check localStorage first, then sessionStorage
    let token = localStorage.getItem('authToken');
    if (!token) {
      token = sessionStorage.getItem('authToken');
    }
    if (token) {
      options.headers.Authorization = `Bearer ${token}`;
    }
  }

  // Add cache control headers to prevent browser caching
  options.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate';
  options.headers['Pragma'] = 'no-cache';
  options.headers['Expires'] = '0';

  let response = await fetch(url, options);

  // If unauthorized, try to refresh token
  if (response.status === 401) {
    // Use a clone so we don't consume the body; callers may read it
    let errorData = null;
    try {
      errorData = await response.clone().json();
    } catch (e) {
      errorData = null;
    }

    // Check if error indicates token expiration (not session expiration)
    // If it's 'סשן פג תוקף', it could be just the access token expired, try to refresh
    if (errorData && errorData.error && errorData.error.includes('סשן פג תוקף')) {
      // Try to refresh the token - this could be just access token expiration
      const refreshResult = await refreshAccessToken();

      if (refreshResult && refreshResult.success) {
        // Retry the original request with new token
        if (options.headers.Authorization) {
          options.headers.Authorization = `Bearer ${refreshResult.accessToken}`;
        }
        response = await fetch(url, options);
      } else if (refreshResult) {
        // Refresh failed - check the reason
        // Only disconnect if refresh token is expired or doesn't exist
        if (refreshResult.reason === 'refresh_token_expired' || refreshResult.reason === 'no_refresh_token') {
          // Refresh token expired or doesn't exist - session is truly expired
          handleSessionExpiration();
          return response;
        }
        // For network errors or other failures, don't disconnect - just return the original 401
        // The user might be offline temporarily or there's a temporary server issue
        return response;
      } else {
        // refreshResult is null/undefined - shouldn't happen, but handle gracefully
        return response;
      }
    } else if (isSessionExpired(errorData)) {
      // For other session errors (not 'סשן פג תוקף'), disconnect immediately
      handleSessionExpiration();
      return response;
    }
  }

  return response;
};
