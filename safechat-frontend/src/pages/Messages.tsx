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
  const { isAuthenticated, loading, token } = useSelector((state: RootState) => state.auth);

  useEffect(() => {
    console.log('Messages Page - isAuthenticated:', isAuthenticated);
    console.log('Messages Page - token:', token);
    console.log('Messages Page - loading:', loading);

    if (!isAuthenticated) {
      dispatch(checkAuthStatus());
    }
  }, [isAuthenticated, dispatch, token, loading]);

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      console.log('Redirecting to login');
      navigate('/login', { replace: true });
    }
  }, [isAuthenticated, loading, navigate]);

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <Layout> {/* Layout already includes Header, so no need to add it separately */}
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
