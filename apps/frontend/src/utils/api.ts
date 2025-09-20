// API configuration
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://43.205.238.172:4000';

// Helper function to make API calls with proper base URL
export const apiCall = (endpoint: string, options?: RequestInit) => {
  const url = endpoint.startsWith('/') ? `${API_BASE_URL}${endpoint}` : endpoint;
  return fetch(url, options);
};
