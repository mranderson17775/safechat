import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/axios';

const SetupTwoFactorPage: React.FC = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [verificationCode, setVerificationCode] = useState('');
  const [twoFactorMethod, setTwoFactorMethod] = useState('TOTP'); // Default to TOTP
  const [resendLoading, setResendLoading] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const setupUsername = localStorage.getItem('setupUsername');
    const setupToken = localStorage.getItem('setupToken');
    
    if (!setupUsername || !setupToken) {
      setError('Setup information missing. Please register again.');
      setIsLoading(false);
      return;
    }
    
    // Request 2FA setup information
    const setup2FA = async () => {
      try {
        const response = await api.post('/auth/2fa/setup', { 
          method: twoFactorMethod,
          username: setupUsername
        }, {
          headers: {
            'Authorization': `Bearer ${setupToken}`
          }
        });
        
        setQrCode(response.data.qrCodeImage);
        setSecret(response.data.secret);
        setIsLoading(false);
      } catch (err: any) {
        setError('Failed to set up two-factor authentication. Please try again.');
        setIsLoading(false);
      }
    };
    
    setup2FA();
  }, [twoFactorMethod]);
  
  const handleMethodChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setTwoFactorMethod(e.target.value);
  };
  
  const handleVerify = async () => {
    try {
      const setupUsername = localStorage.getItem('setupUsername');
      
      const response = await api.post('/auth/2fa/verify', {
        username: setupUsername,
        code: verificationCode,
        method: twoFactorMethod
      });
      
      // Store the authentication token properly - this is crucial
      if (response.data && response.data.token) {
        localStorage.setItem('token', response.data.token);
      } else {
        console.error('No token received from server');
      }
      
      // Clear all temporary setup storage
      localStorage.removeItem('setupUsername');
      localStorage.removeItem('setupToken');
      localStorage.removeItem('tempToken'); // Just in case this exists
      
      // Redirect to home page instead of dashboard
      navigate('/');
    } catch (err: any) {
      setError('Invalid verification code. Please try again.');
      console.error('Verification error:', err.response?.data || err.message);
    }
  };

  const handleResendCode = async () => {
    if (twoFactorMethod !== 'EMAIL') {
      return; // Only email codes can be resent
    }
  
    setResendLoading(true);
    setResendSuccess(false);
    setError(null);
    
    try {
      const setupUsername = localStorage.getItem('setupUsername');
      const setupToken = localStorage.getItem('setupToken');
      
      // Updated to match the controller endpoint
      await api.post("/auth/resend", {
        username: setupUsername,
        method: twoFactorMethod
      }, {
        headers: {
          'Authorization': `Bearer ${setupToken}`
        }
      });
      
      setResendSuccess(true);
      setTimeout(() => {
        setResendSuccess(false);
      }, 3000);
    } catch (err: any) {
      setError(err.response?.data || 'Failed to resend verification code.');
    }
    
    setResendLoading(false);
  };

  const handleSkipForNow = async () => {
    try {
      const setupUsername = localStorage.getItem('setupUsername');
      const setupToken = localStorage.getItem('setupToken');

      // Call the backend to disable 2FA
      await api.post('/auth/2fa/disable', {
        username: setupUsername
      }, {
        headers: {
          'Authorization': `Bearer ${setupToken}`
        }
      });

      // Clear all related storage
      localStorage.removeItem('setupUsername');
      localStorage.removeItem('setupToken');

      // Navigate to home page instead of dashboard
      navigate('/login');
    } catch (err) {
      console.error('Error disabling 2FA:', err);
      // Navigate to home page even if there's an error
      localStorage.removeItem('setupUsername');
      localStorage.removeItem('setupToken');
      navigate('/login');
    }
  };

  if (isLoading) {
    return <div className="loading">Setting up two-factor authentication...</div>;
  }

  return (
    <div className="setup-2fa-container">
      <h2>Set Up Two-Factor Authentication</h2>
      
      {error && <div className="error-alert">{error}</div>}
      {resendSuccess && <div className="success-alert">Verification code resent successfully!</div>}
      
      <div className="method-selector">
        <label htmlFor="method">Authentication Method:</label>
        <select id="method" value={twoFactorMethod} onChange={handleMethodChange}>
          <option value="TOTP">Authenticator App (Google Authenticator, Authy, etc.)</option>
          <option value="EMAIL">Email</option>
        </select>
      </div>
      
      {twoFactorMethod === 'TOTP' && qrCode && (
        <div className="qr-container">
          <p>Scan this QR code with your authenticator app:</p>
          <img src={qrCode} alt="QR Code for 2FA setup" />
        </div>
      )}
      
      {twoFactorMethod === 'EMAIL' && (
        <div className="email-container">
          <p>A verification code has been sent to your email address.</p>
          <button 
            onClick={handleResendCode} 
            disabled={resendLoading}
            className="resend-button"
          >
            {resendLoading ? "Sending..." : "Resend Code"}
          </button>
        </div>
      )}
      
      <div className="verification-form">
        <label htmlFor="verificationCode">Enter Verification Code:</label>
        <input
          id="verificationCode"
          type="text"
          value={verificationCode}
          onChange={(e) => setVerificationCode(e.target.value)}
          placeholder="6-digit code"
        />
        
        <button onClick={handleVerify}>Verify & Complete Setup</button>
      </div>
      
      <div className="skip-section">
        <p>
          <button
            className="skip-link"
            onClick={handleSkipForNow}
          >
            Skip for now (not recommended)
          </button>
        </p>
      </div>
    </div>
  );
};

export default SetupTwoFactorPage;