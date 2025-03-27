import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import api from '../../api/axios';

type RegisterFormData = {
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
  enableTwoFactor: boolean;
};

const RegisterForm: React.FC = () => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  
  const { register, handleSubmit, formState: { errors }, watch } = useForm<RegisterFormData>({
    defaultValues: {
      enableTwoFactor: false
    }
  });
  
  const password = watch('password');
  
  const onSubmit = async (data: RegisterFormData) => {
    if (data.password !== data.confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    
    try {
      setIsSubmitting(true);
      setError(null);
      
      // Create a user object that matches your backend User entity
      const user = {
        username: data.username,
        email: data.email,
        password: data.password,
        twoFactorEnabled: data.enableTwoFactor
      };
      
      const response = await api.post('/auth/register', user);
      
      // Redirect based on 2FA preference
      if (data.enableTwoFactor) {
        // Store username and token in localStorage for 2FA setup
        localStorage.setItem('setupUsername', data.username);
        localStorage.setItem('setupToken', response.data.setupToken);
        navigate('/setup-2fa');
      } else {
        navigate('/login', { state: { message: 'Account created successfully. Please login.' } });
      }
    } catch (error: any) {
      setError(error.response?.data?.message || 'Registration failed');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  return (
    <div className="register-form-container">
      <h2>Create Your SafeChat Account</h2>
     
      {error && <div className="error-alert">{error}</div>}
     
      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="form-group">
          <label htmlFor="username">Username</label>
          <input
            id="username"
            type="text"
            {...register('username', { required: 'Username is required' })}
          />
          {errors.username && <span className="error-message">{errors.username.message}</span>}
        </div>
       
        <div className="form-group">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            {...register('email', { required: 'Email is required' })}
          />
          {errors.email && <span className="error-message">{errors.email.message}</span>}
        </div>
       
        <div className="form-group">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            {...register('password', { required: 'Password is required' })}
          />
          {errors.password && <span className="error-message">{errors.password.message}</span>}
        </div>
       
        <div className="form-group">
          <label htmlFor="confirmPassword">Confirm Password</label>
          <input
            id="confirmPassword"
            type="password"
            {...register('confirmPassword', { required: 'Please confirm your password' })}
          />
          {errors.confirmPassword && <span className="error-message">{errors.confirmPassword.message}</span>}
        </div>
        
        <div className="form-group checkbox-group">
          <label className="checkbox-label">
            <input
              type="checkbox"
              {...register('enableTwoFactor')}
            />
            Enable Two-Factor Authentication (Recommended for enhanced security)
          </label>
        </div>
       
        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Creating Account...' : 'Create Account'}
        </button>
      </form>
     
      <div className="register-footer">
        <p>Already have an account? <a href="/login">Sign in</a></p>
      </div>
    </div>
  );
};

export default RegisterForm;