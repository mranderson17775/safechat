// src/store/index.ts (or wherever your store is defined)
import { configureStore } from '@reduxjs/toolkit';
import authReducer from './slices/AuthSlice';

// Optional: Define a custom useDispatch and useSelector hooks
import { TypedUseSelectorHook, useDispatch, useSelector } from 'react-redux';
// Import other reducers as needed

export const store = configureStore({
  reducer: {
    auth: authReducer,
    // Add other reducers here
  },
});

// Define RootState and AppDispatch types
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
export const useAppDispatch = () => useDispatch<AppDispatch>();
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;

export default store;