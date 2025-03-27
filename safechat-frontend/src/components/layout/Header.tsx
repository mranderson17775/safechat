import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import { logout } from '../../store/slices/AuthSlice';
import { useAppDispatch } from 'store/AppDispatch';

const Header: React.FC = () => {
  const { isAuthenticated, loading, user } = useSelector((state: RootState) => state.auth);
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  const handleLogout = () => {
    dispatch(logout());
    navigate('/login');
  };

  // Define what should be displayed based on authentication state
  const renderNavLinks = () => {
    if (loading) {
      return <span className="nav-loading"></span>; // Show a loading indicator if needed
    }

    if (isAuthenticated) {
      return (
        <>
          <Link to="/messages">Messages</Link>
          <Link to="/user-profile">Profile</Link>
          
          {/* Show Admin Dashboard link only if user is Admin or Super Admin */}
          {user && (
          user.roles.includes('ROLE_ADMIN') || 
          user.roles.includes('ROLE_SUPPORT_ADMIN') || 
          user.roles.includes('ROLE_SUPER_ADMIN')
        ) && (
          <Link to="/admin-dashboard">Admin Dashboard</Link>
        )}

          <button onClick={handleLogout} className="logout-button">Logout</button>
        </>
      );
    }

    return (
      <>
        <Link to="/login">Login</Link>
        <Link to="/register">Register</Link>
      </>
    );
  };

  return (
    <header className="header">
      <div className="logo">
        <Link to="/">SafeChat</Link>
      </div>
      <nav className="nav">{renderNavLinks()}</nav>
    </header>
  );
};

export default Header;
