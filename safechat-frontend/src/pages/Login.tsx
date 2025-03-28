import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { loginSuccess } from '../store/slices/AuthSlice';
import api from '../api/axios';
import { AxiosError } from 'axios';

type TwoFactorMethod = 'EMAIL' | 'TOTP';

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [requires2FA, setRequires2FA] = useState(false);
  const [method, setMethod] = useState<TwoFactorMethod>('EMAIL');
  const [availableMethods, setAvailableMethods] = useState<TwoFactorMethod[]>([]);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  const [error, setError] = useState('');
  const [tempToken, setTempToken] = useState('');
  const [debugInfo, setDebugInfo] = useState<any>(null); // For debugging
  
  // QR code related states
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [qrCodeLoading, setQrCodeLoading] = useState(false);
  const [secret, setSecret] = useState<string | null>(null);
  
  const navigate = useNavigate();
  const dispatch = useDispatch(); // Add dispatch

  // Handle login attempt (username/password)
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      // Log the request for debugging
      console.log('Sending login request with:', { username });

      const response = await api.post('/auth/login', { username, password });
      const data = response.data;

      // Log the response for debugging
      console.log('Received login response:', data);
      setDebugInfo(data);

      if (data.requires2FA) {
        // If 2FA is required, set state and show 2FA form
        setRequires2FA(true);
        
        // Set the default method from response, or default to first available
        setMethod(data.defaultMethod || data.availableMethods?.[0] || 'EMAIL');
        
        // Store available methods (email, app/totp, etc)
        setAvailableMethods(data.availableMethods || ['EMAIL']);
        
        // Store temporary token if provided (for 2FA operations)
        if (data.tempToken) {
          setTempToken(data.tempToken);
          localStorage.setItem('tempToken', data.tempToken);
          console.log('Stored tempToken:', data.tempToken);
        }
        
        // Store username in localStorage for the 2FA flow
        localStorage.setItem('pendingUsername', username);
        
        // Show message about verification code being sent
        if (data.defaultMethod === 'EMAIL' || !data.defaultMethod) {
          setResendSuccess(true);
          setTimeout(() => {
            setResendSuccess(false);
          }, 5000);
        }

        // If TOTP is an available method, attempt to fetch QR code
        if (availableMethods.includes('TOTP') || data.availableMethods?.includes('TOTP')) {
          fetchQRCode(username, data.tempToken);
        }
      } else {
        // If no 2FA, proceed to the home page and update Redux
        localStorage.setItem('token', data.token);

        // Add this line to store the user object directly
        localStorage.setItem('user', JSON.stringify({
          id: data.id || '',
          username: data.username,
          email: data.email || '',
          roles: data.roles || []
        }));
        
        // Dispatch loginSuccess action to Redux
        dispatch(loginSuccess({ 
          user: {
            id: data.id || '',
            username: data.username,
            email: data.email || '',
            roles: data.roles || []
          }, 
          token: data.token 
        }));
        
        navigate('/');
        window.location.reload(); // Added page reload
      }
    } catch (err: any) {
      console.error('Login error:', err);
      
      // More detailed error handling
      if (err.response) {
        setError(`Login failed (${err.response.status}): ${err.response.data?.message || 'Please check your credentials.'}`);
        setDebugInfo(err.response.data);
      } else if (err.request) {
        setError('Network error: No response received from server.');
      } else {
        setError(`Login error: ${err.message}`);
      }
    }
  };

  // Fetch QR code for TOTP setup - this is now always attempted for TOTP
  const fetchQRCode = async (username: string, token: string) => {
    const setupCompleted = localStorage.getItem(`2fa_setup_${username}`);
    const isInitialSetup = !setupCompleted;
  
    try {
      const requestBody = isInitialSetup 
        ? { method: 'TOTP', username: username } 
        : { username: username };
     
      const response = await api.post('/auth/2fa/setup', requestBody, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
     
      if (response.data && response.data.qrCodeImage) {
        setQrCode(response.data.qrCodeImage);
        
        if (isInitialSetup) {
          setSecret(response.data.secret || null);
          localStorage.setItem(`2fa_setup_${username}`, 'true');
        }
      }
    } catch (err: any) {
      console.error('QR code fetch error:', err?.response?.data || err);
    }
  };


  
  // Handle 2FA code submission
  const handle2FAVerification = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
  
    try {
      // Log request for debugging
      console.log('Sending 2FA verification with:', { username, method, codeLength: twoFactorCode.length });
  
      // Make sure the code is properly formatted (remove spaces if any)
      const formattedCode = twoFactorCode.replace(/\s/g, '');
  
      const response = await api.post('/auth/2fa/verify', { 
        username, 
        code: formattedCode, // Use formatted code
        method
      });

      const data = response.data;

      // Log response for debugging
      console.log('Received 2FA verification response:', data);

      if (data.token) {
        // Save token and update Redux
        localStorage.setItem('token', data.token);
        localStorage.removeItem('tempToken');
        localStorage.removeItem('pendingUsername');
        
        // Dispatch loginSuccess action to Redux
        dispatch(loginSuccess({ 
          user: {
            id: data.id || '',
            username: data.username,
            email: data.email || '',
            roles: data.roles || []
          }, 
          token: data.token 
        }));
        
        navigate('/');
        window.location.reload(); // Added page reload
      } else {
        setError('Verification successful but no token received. Please try again.');
      }
    } catch (err: any) {
      console.error('2FA verification error:', err);
      
      // More detailed error handling
      if (err.response) {
        setError(`Verification failed (${err.response.status}): ${err.response.data?.message || 'Please try again.'}`);
        setDebugInfo(err.response.data);
      } else if (err.request) {
        setError('Network error: No response received from server.');
      } else {
        setError(`Verification error: ${err.message}`);
      }
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
      console.log('Attempting to resend code for user:', username);
      
      // Include all required fields, even if code is empty
      const response = await api.post(
        '/auth/resend', 
        { 
          username, 
          method: 'EMAIL',
          code: '' // Include this even if it's empty
        }
      );
      
      console.log('Resend response:', response.data);
      setResendSuccess(true);
      setTimeout(() => {
        setResendSuccess(false);
      }, 5000);
    } catch (err: unknown) {
      // Type assertion to handle err as AxiosError
      if (err instanceof AxiosError) {
        console.error('Error response:', err.response?.data);
        setError(`Resend failed (${err.response?.status}): ${err.response?.data?.message || err.response?.data || 'Please try again.'}`);
      } else {
        setError(`Resend error: ${(err as Error).message}`);
      }
    }
  
    setResendLoading(false);
  };
  
  // Switch between 2FA methods
  const handleMethodChange = (newMethod: TwoFactorMethod) => {
    setMethod(newMethod);
    setTwoFactorCode(''); // Clear code when switching methods
    setError(''); // Clear any errors
    
    if (newMethod === 'EMAIL') {
      // Automatically send email code when switching to EMAIL method
      handleResendCode();
    } else if (newMethod === 'TOTP' && !qrCode && tempToken) {
      // If switching to TOTP and we don't have a QR code yet, try to fetch it
      fetchQRCode(username, tempToken);
    }
  };

  // Try to restore session if page is refreshed during 2FA
  useEffect(() => {
    const storedUsername = localStorage.getItem('pendingUsername');
    const storedToken = localStorage.getItem('tempToken');
    
    if (storedUsername && requires2FA === false) {
      setUsername(storedUsername);
      setRequires2FA(true);
      if (storedToken) {
        setTempToken(storedToken);
        
        // Also fetch QR code if we're in a restored session
        fetchQRCode(storedUsername, storedToken);
      }
    }
  }, []);

  // Listen for method change to fetch QR if needed
  useEffect(() => {
    if (method === 'TOTP' && requires2FA && !qrCode && !qrCodeLoading && tempToken) {
      fetchQRCode(username, tempToken);
    }
  }, [method, requires2FA]);

  return (
    <div className="login-container">
      {!requires2FA ? (
        // Main login form (username/password)
        <form onSubmit={handleLogin} className="login-form">
          <h2>Login</h2>
          <div className="form-group">
            <label htmlFor="username-input">Username</label>
            <input
              id="username-input"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="password-input">Password</label>
            <input
              id="password-input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <button type="submit" className="login-button">Login</button>
          {error && <output className="error-message">{error}</output>}
        </form>
      ) : (
        // 2FA verification form
        <div className="two-factor-container">
          <h2>Two-Factor Authentication</h2>
          
          {/* Method selection buttons */}
          <div className="method-tabs" role="tablist">
            {availableMethods.includes('EMAIL') && (
              <button 
                type="button"
                role="tab"
                aria-selected={method === 'EMAIL'}
                className={`method-tab ${method === 'EMAIL' ? 'active' : ''}`}
                onClick={() => handleMethodChange('EMAIL')}
              >
                Email Verification
              </button>
            )}
            {availableMethods.includes('TOTP') && (
              <button 
                type="button"
                role="tab"
                aria-selected={method === 'TOTP'}
                className={`method-tab ${method === 'TOTP' ? 'active' : ''}`}
                onClick={() => handleMethodChange('TOTP')}
              >
                App Verification
              </button>
            )}
          </div>
          
          {/* QR Code display for TOTP - always show if available */}
          {method === 'TOTP' && (
            <div className="qr-container">
              {qrCodeLoading ? (
                <p>Loading QR code...</p>
              ) : qrCode ? (
                <>
                  <p>Scan this QR code with your authenticator app:</p>
                  <img 
                    src={qrCode} 
                    alt="QR Code for 2FA setup" 
                    style={{ 
                      maxWidth: "200px", 
                      margin: "15px auto", 
                      display: "block",
                      border: "1px solid #ccc"
                    }} 
                  />
                </>
              ) : (
                <p>No QR code available. Enter the code from your authenticator app.</p>
              )}
            </div>
          )}
          
          {/* Verification code form */}
          <form onSubmit={handle2FAVerification} className="verification-form">
            <div className="form-group">
              <label htmlFor="verification-code-input">
                {method === 'EMAIL' 
                  ? 'Enter the code sent to your email' 
                  : 'Enter the 6-digit code from your authenticator app'}
              </label>
              <input
                id="verification-code-input"
                type="text"
                inputMode={method === 'TOTP' ? "numeric" : "text"} // Better mobile keyboard for TOTP
                maxLength={method === 'TOTP' ? 6 : undefined} // Limit to 6 characters for TOTP
                value={twoFactorCode}
                onChange={(e) => setTwoFactorCode(e.target.value)}
                placeholder={method === 'TOTP' ? "123456" : "Verification code"}
                required
                autoComplete="one-time-code" // Better autocomplete behavior
              />
            </div>
            
            <button type="submit" className="verify-button">Verify</button>
            
            {/* Show resend option only for email method */}
            {method === 'EMAIL' && (
              <button
                type="button"
                onClick={handleResendCode}
                disabled={resendLoading}
                className="resend-button"
              >
                {resendLoading ? 'Sending...' : 'Resend Code'}
              </button>
            )}
            
            {resendSuccess && <output className="success-message">Verification code sent to your email!</output>}
            {error && <output className="error-message">{error}</output>}
            
            {/* Back button */}
            <button 
              type="button"
              onClick={() => {
                setRequires2FA(false);
                setQrCode(null);
                setSecret(null);
                localStorage.removeItem('pendingUsername');
                localStorage.removeItem('tempToken');
              }}
              className="back-button"
            >
              Back to Login
            </button>
          </form>
          
          {/* Helper text based on method */}
          <div className="method-info">
            {method === 'EMAIL' ? (
              <p>Check your email inbox for the verification code. If you don't see it, check your spam folder.</p>
            ) : qrCode ? (
              <p>Scan the QR code with an authenticator app like Google Authenticator or Authy, then enter the 6-digit code shown in the app.</p>
            ) : (
              <p>Open your authenticator app (like Google Authenticator or Authy) and enter the code shown for this account.</p>
            )}
          </div>
        </div>
      )}
      
      {/* Debug information (only visible in development) */}
      {process.env.NODE_ENV === 'development' && debugInfo && (
        <div className="debug-info" style={{ marginTop: '20px', fontSize: '0.8rem', color: '#666' }}>
          <details>
            <summary>Debug Info</summary>
            <pre>{JSON.stringify(debugInfo, null, 2)}</pre>
          </details>
        </div>
      )}
    </div>
  );
};

export default Login;