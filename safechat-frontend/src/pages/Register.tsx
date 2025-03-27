import React from 'react';
import RegisterForm from '../components/auth/RegisterForm';

const Register: React.FC = () => {
  return (
    <div className="register-page">
      <div className="register-container">
        <RegisterForm />
      </div>
    </div>
  );
};

export default Register;