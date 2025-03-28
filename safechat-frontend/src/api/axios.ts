import axios from 'axios';

// Use environment variable or fallback to localhost for development
const BASE_URL = process.env.REACT_APP_BACKEND_URL || 'https://localhost:8443';

const instance = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Updated interceptor to check for both token and tempToken
instance.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token') || localStorage.getItem('tempToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add error logging interceptor
instance.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('Axios Error:', {
      message: error.message,
      url: error.config?.url,
      method: error.config?.method,
      status: error.response?.status,
      data: error.response?.data
    });
    return Promise.reject(error);
  }
);

export default instance;