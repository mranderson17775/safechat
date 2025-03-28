import React from 'react';
import { Link } from 'react-router-dom';

const Home: React.FC = () => {
  return (
    <div className="home-container text-center max-w-xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold mb-4">Welcome to SafeChat</h1>
      <p className="text-lg text-gray-600 mb-8">A secure messaging platform for private communications</p>
      
      <div className="auth-section bg-gray-50 rounded-lg p-8 shadow-md">
        <div className="auth-buttons flex flex-col sm:flex-row justify-center items-center space-y-4 sm:space-y-0 sm:space-x-4">
          <div className="text-center sm:text-left">
            <h2 className="text-xl font-semibold mb-2">New to SafeChat?</h2>
            <p className="text-gray-600 mb-4">Create a secure account and start private messaging today.</p>
            <Link 
              to="/register" 
              className="btn btn-primary w-full sm:w-auto inline-block px-6 py-3 rounded-lg"
            >
              Create Account
            </Link>
          </div>
          
          <div className="hidden sm:block h-24 border-r border-gray-300"></div>
          
          <div className="text-center sm:text-left">
            <h2 className="text-xl font-semibold mb-2">Already have an account?</h2>
            <p className="text-gray-600 mb-4">Log in to continue your secure conversations.</p>
            <Link 
              to="/login" 
              className="btn btn-secondary w-full sm:w-auto inline-block px-6 py-3 rounded-lg"
            >
              Login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;