import React from 'react';
import { Link } from 'react-router-dom';

const Home: React.FC = () => {
  return (
    <div className="home-container">
      <h1>Welcome to SafeChat</h1>
      <p>A secure messaging platform for private communications</p>
      <div className="auth-buttons flex flex-col sm:flex-row justify-center items-center space-y-4 sm:space-y-0 sm:space-x-4">
        <Link to="/register" className="btn btn-primary w-full sm:w-auto">Create Account</Link>
        <Link to="/login" className="btn btn-secondary w-full sm:w-auto">Login</Link>
      </div>
    </div>
  );
};

export default Home;