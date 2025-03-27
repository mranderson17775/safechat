import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './components/layout/Layout';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import Messages from './pages/Messages';
import UserProfilePage from './pages/UserProfilePage';
import Setup2FA from './components/auth/Setup2FA';
import AdminDashboard from './pages/AdminDashboard'; // Import the AdminDashboard page
import { checkAuthStatus } from './store/slices/AuthSlice';
import './App.css';
import { useAppDispatch } from 'store/AppDispatch';

function App() {
  // Use the typed dispatch hook
  const dispatch = useAppDispatch();
  
  useEffect(() => {
    dispatch(checkAuthStatus());
  }, [dispatch]);
  
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/messages" element={<Messages />} />
          <Route path="/user-profile" element={<UserProfilePage />} />
          <Route path="/setup-2fa" element={<Setup2FA />} />
          <Route path="/admin-dashboard" element={<AdminDashboard />} />
        </Routes>
      </Layout>
    </Router>
  );
}

export default App;
