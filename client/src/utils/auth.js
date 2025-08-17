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
    errorMessage.includes('טוקן לא תקף')
  );
};

/**
 * Handle session expiration by redirecting to login
 */
export const handleSessionExpiration = () => {
  console.log('Session expired, redirecting to login');
  // Clear local storage
  localStorage.removeItem('authToken');
  localStorage.removeItem('user');
  // Reload page to trigger login flow
  window.location.reload();
};

/**
 * Wrapper for fetch requests that automatically handles session expiration
 * @param {string} url - The URL to fetch
 * @param {Object} options - Fetch options
 * @returns {Promise<Response>} - The fetch response
 */
export const authenticatedFetch = async (url, options = {}) => {
  const response = await fetch(url, options);
  
  if (!response.ok) {
    const errorData = await response.json();
    
    if (isSessionExpired(errorData)) {
      handleSessionExpiration();
      return response; // Return response to prevent further processing
    }
  }
  
  return response;
};
