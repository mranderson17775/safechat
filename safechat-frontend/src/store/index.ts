// src/store/index.ts
import { configureStore } from '@reduxjs/toolkit';
import authReducer from './slices/AuthSlice';
import messageReducer from './slices/MessageSlice'; // Add this import
import { TypedUseSelectorHook, useDispatch, useSelector } from 'react-redux';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    messages: messageReducer, // Add the messages reducer here
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
export const useAppDispatch = () => useDispatch<AppDispatch>();
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
export default store;