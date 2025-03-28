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
  twoFactorQrCode?: string | null;
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
  const [showTwoFactorDisableVerification, setShowTwoFactorDisableVerification] = useState(false);
  const [method, setMethod] = useState<TwoFactorMethod>('TOTP');
  const [verificationCode, setVerificationCode] = useState('');
  const [qrCode, setQrCode] = useState<string | null>(null);
  
  // Resend code state
  const [resendLoading, setResendLoading] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  const [availableMethods, setAvailableMethods] = useState<TwoFactorMethod[]>(['TOTP', 'EMAIL']);

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
      setUser((prev) => prev ? { ...prev, ...data } : null);
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

  // Enable 2FA
  const enableTwoFactorAuth = async () => {
    try {
      setError(null);
      setSuccessMessage(null);

      // Request 2FA setup with TOTP method to get QR code
      const response = await api.post('/auth/2fa/setup', { method: 'TOTP' });
      
      // Set QR code from response
      setQrCode(response.data.qrCodeImage);
      setShowTwoFactorSetup(true);
    } catch (err: any) {
      setError('Failed to initialize 2FA setup');
    }
  };

  // Verify and complete 2FA setup
  const completeTwoFactorSetup = async () => {
    try {
      setError(null);

      const response = await api.post('/auth/2fa/verify', { 
        code: verificationCode,
        username: user?.username,
        method: 'TOTP'
      });

      // Update user state - use response data to ensure type compatibility
      setUser((prev) => prev ? {
        ...prev, 
        twoFactorEnabled: true,
        twoFactorQrCode: response.data.qrCodeImage || null
      } : null);

      setShowTwoFactorSetup(false);
      setQrCode(null);
      setSuccessMessage('Two-factor authentication enabled successfully');
    } catch (err: any) {
      setError('Invalid verification code');
    }
  };

  // Handle resend 2FA code for setup
  const handleResendCode = async () => {
    setResendLoading(true);
    setResendSuccess(false);
    setError('');
 
    try {
      // Re-initiate 2FA setup to get a new QR code
      const response = await api.post('/auth/2fa/setup', { method: 'TOTP' });
      
      // Update QR code
      setQrCode(response.data.qrCodeImage);
      
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

  // Show disable 2FA verification modal
  const showDisableTwoFactorVerification = () => {
    setShowTwoFactorDisableVerification(true);
    setMethod('TOTP'); // Default to TOTP method
    setVerificationCode('');
    setError(null);
  };

  // Verify and disable 2FA
  const verifyAndDisableTwoFactorAuth = async () => {
    try {
      setError(null);

      // Verify the code before disabling 2FA
      await api.post('/auth/2fa/verify', { 
        code: verificationCode,
        username: user?.username,
        method: method
      });

      // If verification is successful, proceed to disable 2FA
      const response = await api.post('/user/2fa/disable', { 
        username: user?.username 
      });

      // Update user state
      setUser((prev) => prev ? {
        ...prev, 
        twoFactorEnabled: false,
        twoFactorQrCode: null
      } : null);

      setShowTwoFactorDisableVerification(false);
      setSuccessMessage(response.data.message || 'Two-factor authentication disabled');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Verification failed. Unable to disable two-factor authentication.');
    }
  };

  // Handle method change for 2FA verification
  const handleMethodChange = async (newMethod: TwoFactorMethod) => {
    setMethod(newMethod);
    setVerificationCode('');
    setError(null);

    // If switching to EMAIL, request a new verification code
    if (newMethod === 'EMAIL') {
      try {
        await api.post('/auth/resend', { 
          username: user?.username, 
          method: 'EMAIL' 
        });
        setSuccessMessage('Verification code sent to your email');
      } catch (err: any) {
        setError('Failed to send verification code');
      }
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
          <button onClick={showDisableTwoFactorVerification}>Disable 2FA</button>
        )}

        {/* Two-Factor Setup Modal */}
        {showTwoFactorSetup && (
          <div className="two-factor-setup">
            {qrCode && (
              <div className="qr-code-container">
                <p>Scan this QR code with your authenticator app:</p>
                <img 
                  src={qrCode} 
                  alt="Two-Factor Authentication QR Code" 
                  className="qr-code-image" 
                />
              </div>
            )}
            
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
                {resendLoading ? 'Generating New QR...' : 'Generate New QR Code'}
              </button>
              
              {resendSuccess && (
                <span className="success-message">New QR Code generated!</span>
              )}
            </div>
          </div>
        )}

        {/* Two-Factor Disable Verification Modal */}
        {showTwoFactorDisableVerification && (
          <div className="two-factor-disable-verification">
            <h3>Verify to Disable Two-Factor Authentication</h3>
            
            {/* Method selection */}
            <div className="method-tabs">
              {availableMethods.map(availableMethod => (
                <button
                  key={availableMethod}
                  type="button"
                  className={`method-tab ${method === availableMethod ? 'active' : ''}`}
                  onClick={() => handleMethodChange(availableMethod)}
                >
                  {availableMethod === 'TOTP' ? 'Authenticator App' : 'Email'}
                </button>
              ))}
            </div>

            {/* Verification input */}
            <div className="verification-form">
              <input
                type="text"
                placeholder={method === 'TOTP' 
                  ? 'Enter 6-digit code from app' 
                  : 'Enter code sent to your email'}
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value)}
                maxLength={method === 'TOTP' ? 6 : undefined}
              />
              <button onClick={verifyAndDisableTwoFactorAuth}>
                Verify & Disable 2FA
              </button>
              <button 
                type="button" 
                onClick={() => setShowTwoFactorDisableVerification(false)}
                className="cancel-button"
              >
                Cancel
              </button>
            </div>

            {/* Helper text */}
            <p className="method-info">
              {method === 'TOTP' 
                ? 'Open your authenticator app and enter the current 6-digit code.'
                : 'Check your email for the verification code.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default UserProfilePage;