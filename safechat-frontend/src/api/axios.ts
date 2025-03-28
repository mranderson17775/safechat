// src/api/axios.ts
import axios from 'axios';
const instance = axios.create({
  baseURL: 'https://safechat-production.up.railway.app', // Your Spring Boot server URL
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

export default instance;