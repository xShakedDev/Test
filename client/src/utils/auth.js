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
    errorMessage.includes('טוקן לא תקף')
  );
};

/**
 * Refresh the access token using the refresh token
 * @returns {Promise<Object>} - New tokens or null if refresh failed
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
    
    if (!refreshToken) {
      return null;
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
      // Update tokens in the same storage where refresh token was found
      storage.setItem('authToken', data.accessToken);
      storage.setItem('refreshToken', data.refreshToken);
      return data;
    }
    
    return null;
  } catch (error) {
    console.error('Failed to refresh token:', error);
    return null;
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
    
    if (isTokenExpired(errorData)) {
      // Try to refresh the token
      const refreshResult = await refreshAccessToken();
      
      if (refreshResult) {
        // Retry the original request with new token
        if (options.headers.Authorization) {
          options.headers.Authorization = `Bearer ${refreshResult.accessToken}`;
        }
        response = await fetch(url, options);
      } else {
        // Refresh failed, session expired
        handleSessionExpiration();
        return response;
      }
    } else if (isSessionExpired(errorData)) {
      handleSessionExpiration();
      return response;
    }
  }
  
  return response;
};
