// User types
export interface User {
    id: string;
    username: string;
    email: string;
    role: string;
    twoFactorEnabled: boolean;
  }
  
  // Authentication types
  export interface LoginRequest {
    username: string;
    password: string;
  }
  
  export interface TwoFactorRequest {
    username: string;
    code: string;
  }
  
  export interface RegisterRequest {
    username: string;
    email: string;
    password: string;
    confirmPassword: string;
  }
  
  export interface AuthResponse {
    token: string;
    user: User;
    requireTwoFactor?: boolean;
  }
  
  // Message types
  export interface Message {
    id: string;
    senderId: string;
    recipientId: string;
    content: string;
    timestamp: string;
    expiresAt?: string;
    isRead: boolean;
    isRevoked: boolean;
  }
  
  export interface MessageRequest {
    recipientId: string;
    content: string;
    expiresAfter?: number; // Time in minutes
  }