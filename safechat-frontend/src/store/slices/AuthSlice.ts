import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { AppDispatch } from 'store/AppDispatch';

interface User {
  id: string;
  username: string;
  email: string;
  roles: string[];   // Changed from optional single role to array of roles
  twoFactorEnabled?: boolean;
  twoFactorMethod?: string;
  phoneNumber?: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  loading: boolean;
  error: string | null;
}

const initialState: AuthState = {
  user: null,
  token: localStorage.getItem('token'),
  isAuthenticated: false, // Start with false until we verify the token
  loading: true, // Start with loading true
  error: null,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    loginStart: (state) => {
      state.loading = true;
      state.error = null;
    },
    loginSuccess: (state, action: PayloadAction<{ user: User; token: string }>) => {
      state.user = action.payload.user;
      state.token = action.payload.token;
      state.isAuthenticated = true;
      state.loading = false;
      localStorage.setItem('token', action.payload.token);
      // Add this line to store the user object in localStorage
      localStorage.setItem('user', JSON.stringify(action.payload.user));
    },
    loginFailure: (state, action: PayloadAction<string>) => {
      state.loading = false;
      state.error = action.payload;
      state.isAuthenticated = false;
    },
    logout: (state) => {
      state.user = null;
      state.token = null;
      state.isAuthenticated = false;
      state.loading = false;
      localStorage.removeItem('token');
      // Add this line to remove the user object from localStorage
      localStorage.removeItem('user');
    },
    updateUser: (state, action: PayloadAction<User>) => {
      state.user = action.payload;
    },
    // Add these actions for token validation
    checkAuthStart: (state) => {
      state.loading = true;
    },
    checkAuthSuccess: (state, action: PayloadAction<User>) => {
      state.user = action.payload;
      state.isAuthenticated = true;
      state.loading = false;
    },
    checkAuthFailure: (state) => {
      state.user = null;
      state.token = null;
      state.isAuthenticated = false;
      state.loading = false;
      localStorage.removeItem('token');
    },
    clearError: (state) => {
      state.error = null;
    }
  },
});

export const {
  loginStart,
  loginSuccess,
  loginFailure,
  logout,
  updateUser,
  checkAuthStart,
  checkAuthSuccess,
  checkAuthFailure,
  clearError
} = authSlice.actions;

// Simple thunk for checking authentication
export const checkAuthStatus = () => async (dispatch: AppDispatch) => {
  const token = localStorage.getItem('token');
  const cachedUserData = localStorage.getItem('user');
 
  if (!token) {
    return dispatch(checkAuthFailure());
  }
 
  dispatch(checkAuthStart());
 
  // First try to use cached user data
  if (cachedUserData) {
    try {
      const user = JSON.parse(cachedUserData);
      // Temporary success with cached data
      dispatch(checkAuthSuccess(user));
    } catch (e) {
      console.error('Error parsing cached user data', e);
    }
  }
 
  // Always verify with server to be sure
  try {
    const response = await fetch('/user/profile', {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
   
    if (!response.ok) {
      throw new Error('Invalid token');
    }
   
    const userData = await response.json();
   
    // Make sure userData has the right shape
    const user = {
      id: userData.id || '',
      username: userData.username,
      email: userData.email || '',
      roles: userData.roles || []
    };
   
    // Update localStorage with fresh data
    localStorage.setItem('user', JSON.stringify(user));
   
    dispatch(checkAuthSuccess(user));
  } catch (error) {
    dispatch(checkAuthFailure());
  }
};

export default authSlice.reducer;