import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import api from '../api/axios';

// Define types for user profile and password change forms
type ProfileFormData = {
  username: string;
  email: string;
};

type PasswordFormData = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

type UserType = {
  username: string;
  email: string;
  twoFactorEnabled: boolean;
};

type TwoFactorMethod = 'EMAIL' | 'TOTP';

const UserProfilePage: React.FC = () => {
  // State management
  const [user, setUser] = useState<UserType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // State for 2FA
  const [showTwoFactorSetup, setShowTwoFactorSetup] = useState(false);
  const [method, setMethod] = useState<TwoFactorMethod>('EMAIL');
  const [verificationCode, setVerificationCode] = useState('');
  
  // Resend code state
  const [resendLoading, setResendLoading] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);

  // React Hook Form setup
  const {
    register: registerProfile,
    handleSubmit: handleProfileSubmit,
    setValue: setProfileValue,
    formState: { errors: profileErrors }
  } = useForm<ProfileFormData>();

  const {
    register: registerPassword,
    handleSubmit: handlePasswordSubmit,
    watch: watchPassword,
    formState: { errors: passwordErrors }
  } = useForm<PasswordFormData>();

  const newPassword = watchPassword('newPassword');

  useEffect(() => {
    // Fetch user profile on mount
    const fetchUserProfile = async () => {
      try {
        const response = await api.get('/user/profile');
        setUser(response.data);

        // Pre-fill form fields
        setProfileValue('username', response.data.username);
        setProfileValue('email', response.data.email);

        setLoading(false);
      } catch (err: any) {
        setError('Failed to load user profile');
        setLoading(false);
      }
    };

    fetchUserProfile();
  }, [setProfileValue]);

  // Handle profile update
  const onProfileSubmit = async (data: ProfileFormData) => {
    try {
      setError(null);
      setSuccessMessage(null);

      await api.put('/user/profile', data);
      setSuccessMessage('Profile updated successfully');

      // Update local user state
      setUser((prev) => (prev ? { ...prev, ...data } : prev));
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to update profile');
    }
  };

  // Handle password change
  const onPasswordSubmit = async (data: PasswordFormData) => {
    if (data.newPassword !== data.confirmPassword) {
      setError('New passwords do not match');
      return;
    }

    try {
      setError(null);
      setSuccessMessage(null);

      await api.put('/user/password', {
        currentPassword: data.currentPassword,
        newPassword: data.newPassword
      });

      setSuccessMessage('Password changed successfully');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to change password');
    }
  };

  // Enable 2FA with email by default
  const enableTwoFactorAuth = async () => {
    try {
      setError(null);
      setSuccessMessage(null);

      // Specify EMAIL as the method
      const response = await api.post('/auth/2fa/setup', { method: 'EMAIL' });
      
      // Email will be sent automatically by the backend
      setSuccessMessage('A verification code has been sent to your email');
      setShowTwoFactorSetup(true);
    } catch (err: any) {
      setError('Failed to initialize 2FA setup');
    }
  };

  // Verify and complete 2FA setup
  const completeTwoFactorSetup = async () => {
    try {
      setError(null);

      await api.post('/auth/2fa/verify', { 
        code: verificationCode,
        username: user?.username,
        method: 'EMAIL'
      });

      // Update user state
      setUser((prev) => (prev ? { ...prev, twoFactorEnabled: true } : prev));

      setShowTwoFactorSetup(false);
      setSuccessMessage('Two-factor authentication enabled successfully');
    } catch (err: any) {
      setError('Invalid verification code');
    }
  };

  // Handle resend 2FA code
  const handleResendCode = async () => {
    if (method !== 'EMAIL') {
      return;
    }
 
    setResendLoading(true);
    setResendSuccess(false);
    setError('');
 
    try {
      // Include all required fields, even if code is empty
      const response = await api.post(
        '/auth/resend',
        {
          username: user?.username,
          method: 'EMAIL',
          code: '' // Include this even if it's empty
        }
      );
     
      setResendSuccess(true);
      setTimeout(() => {
        setResendSuccess(false);
      }, 5000);
    } catch (err: any) {
      if (err.response) {
        setError(`Resend failed (${err.response.status}): ${err.response?.data?.message || err.response?.data || 'Please try again.'}`);
      } else {
        setError(`Resend error: ${err.message}`);
      }
    }
 
    setResendLoading(false);
  };

  // Disable 2FA
  const disableTwoFactorAuth = async () => {
    if (!window.confirm('Are you sure you want to disable two-factor authentication?')) {
      return;
    }

    try {
      setError(null);
      setSuccessMessage(null);

      await api.post('/user/2fa/disable');

      // Update user state
      setUser((prev) => (prev ? { ...prev, twoFactorEnabled: false } : prev));

      setSuccessMessage('Two-factor authentication disabled');
    } catch (err: any) {
      setError('Failed to disable two-factor authentication');
    }
  };

  if (loading) {
    return <div className="loading">Loading profile...</div>;
  }

  return (
    <div className="user-profile-container">
      <h1>Account Settings</h1>

      {error && <div className="error-alert">{error}</div>}
      {successMessage && <div className="success-alert">{successMessage}</div>}

      <div className="profile-section">
        <h2>Profile Information</h2>
        <form onSubmit={handleProfileSubmit(onProfileSubmit)}>
          <div className="form-group">
            <label htmlFor="username">Username</label>
            <input id="username" type="text" {...registerProfile('username', { required: 'Username is required' })} />
            {profileErrors.username && <span className="error-message">{profileErrors.username.message}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input id="email" type="email" {...registerProfile('email', { required: 'Email is required' })} />
            {profileErrors.email && <span className="error-message">{profileErrors.email.message}</span>}
          </div>

          <button type="submit">Update Profile</button>
        </form>
      </div>

      <div className="password-section">
        <h2>Change Password</h2>
        <form onSubmit={handlePasswordSubmit(onPasswordSubmit)}>
          <div className="form-group">
            <label htmlFor="currentPassword">Current Password</label>
            <input 
              id="currentPassword" 
              type="password" 
              {...registerPassword('currentPassword', { required: 'Current password is required' })} 
            />
            {passwordErrors.currentPassword && <span className="error-message">{passwordErrors.currentPassword.message}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="newPassword">New Password</label>
            <input 
              id="newPassword" 
              type="password" 
              {...registerPassword('newPassword', { 
                required: 'New password is required',
                minLength: { value: 1, message: 'Password must be at least 1 characters long' } 
              })} 
            />
            {passwordErrors.newPassword && <span className="error-message">{passwordErrors.newPassword.message}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="confirmPassword">Confirm New Password</label>
            <input 
              id="confirmPassword" 
              type="password" 
              {...registerPassword('confirmPassword', { 
                required: 'Please confirm your password',
                validate: value => value === newPassword || 'Passwords do not match'
              })} 
            />
            {passwordErrors.confirmPassword && <span className="error-message">{passwordErrors.confirmPassword.message}</span>}
          </div>

          <button type="submit">Change Password</button>
        </form>
      </div>

      <div className="security-section">
        <h2>Two-Factor Authentication</h2>
        <p>
          {user?.twoFactorEnabled
            ? 'Two-factor authentication is enabled.'
            : 'Enable two-factor authentication for extra security.'}
        </p>

        {!user?.twoFactorEnabled ? (
          <button onClick={enableTwoFactorAuth}>Enable 2FA</button>
        ) : (
          <button onClick={disableTwoFactorAuth}>Disable 2FA</button>
        )}

        {showTwoFactorSetup && (
          <div className="two-factor-setup">
            <p>A verification code has been sent to your email.</p>
            
            <div className="verification-form">
              <input
                type="text"
                placeholder="Enter 6-digit code"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value)}
              />
              <button onClick={completeTwoFactorSetup}>Verify & Enable</button>
            </div>
            
            <div className="resend-section">
              <button 
                onClick={handleResendCode} 
                disabled={resendLoading}
                className="resend-button"
              >
                {resendLoading ? 'Sending...' : 'Resend Code'}
              </button>
              
              {resendSuccess && (
                <span className="success-message">Code sent successfully!</span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default UserProfilePage;