// API configuration with environment detection
const getApiBaseUrl = () => {
  // Check for explicit environment variable first
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL;
  }
  
  // Auto-detect based on current environment
  if (import.meta.env.DEV) {
    // Development mode - use local backend
    return 'http://localhost:4000';
  } else {
    // Production mode - use deployed backend
    return 'http://43.205.238.172:4000';
  }
};

export const API_BASE_URL = getApiBaseUrl();

// Helper function to make API calls with proper base URL
export const apiCall = (endpoint: string, options?: RequestInit) => {
  const url = endpoint.startsWith('/') ? `${API_BASE_URL}${endpoint}` : endpoint;
  return fetch(url, {
    credentials: 'include',
    ...options,
  });
};
