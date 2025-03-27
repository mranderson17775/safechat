// src/pages/Home.tsx
import React from 'react';
import { Link } from 'react-router-dom';

const Home: React.FC = () => {
  return (
    <div className="home-container">
      <h1>Welcome to SafeChat</h1>
      <p>A secure messaging platform for private communications</p>
      
      <div className="auth-buttons">
        <Link to="/register" className="btn btn-primary">Create Account</Link>
        <Link to="/login" className="btn btn-secondary">Sign In</Link>
      </div>
    </div>
  );
};

export default Home;