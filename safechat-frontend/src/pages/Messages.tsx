import React, { useEffect } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { checkAuthStatus } from '../store/slices/AuthSlice';
import { useAppDispatch } from '../store/AppDispatch';
import Layout from '../components/layout/Layout';
import MessagesList from '../components/messages/MessagesList';
import { RootState } from '../store';

const Messages: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { isAuthenticated, loading, token, user } = useSelector((state: RootState) => state.auth);

  useEffect(() => {
    // Attempt to check auth status if not authenticated or if no user
    if (!isAuthenticated || !user) {
      dispatch(checkAuthStatus());
    }
  }, [isAuthenticated, dispatch, token, user]);

  useEffect(() => {
    // More explicit redirection logic
    if (!loading) {
      if (!isAuthenticated) {
        console.log('Redirecting to login');
        navigate('/login', { replace: true });
      }
    }
  }, [isAuthenticated, loading, navigate]);

  // Enhanced loading state with a more informative loading component
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="loader ease-linear rounded-full border-4 border-t-4 border-gray-200 h-12 w-12 mb-4 mx-auto"></div>
          <p className="text-gray-600">Authenticating...</p>
        </div>
      </div>
    );
  }

  // Prevent rendering if not authenticated
  if (!isAuthenticated) {
    return null;
  }

  return (
    <Layout>
      <div className="container mx-auto p-4 flex flex-col h-screen">
        <h1 className="text-2xl font-bold mb-4">Messages</h1>
        <div className="bg-white rounded-lg shadow-md flex-grow">
          <MessagesList />
        </div>
      </div>
    </Layout>
  );
};

export default Messages;