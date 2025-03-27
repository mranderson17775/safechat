import React, { useState } from 'react';
import axios from 'api/axios';

const AdminInviteForm: React.FC = () => {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email) {
      setError('Email is required');
      return;
    }

    try {
      const response = await axios.post('/api/admin/invite', { email });
      setSuccess('Invitation sent successfully');
      setEmail('');
      setError('');
    } catch (error) {
      console.error('Error sending invitation:', error);
      setError('Failed to send invitation');
      setSuccess('');
    }
  };

  return (
    <div className="max-w-md mx-auto p-4 bg-white rounded shadow">
      <h2 className="text-xl font-semibold text-center">Invite User</h2>
      <form onSubmit={handleInvite} className="mt-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium">Email</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full mt-2 p-2 border rounded-md"
            placeholder="Enter user's email"
          />
        </div>

        {error && <p className="text-red-500 mt-2">{error}</p>}
        {success && <p className="text-green-500 mt-2">{success}</p>}

        <button
          type="submit"
          className="mt-4 w-full py-2 bg-blue-500 text-white rounded"
        >
          Send Invitation
        </button>
      </form>
    </div>
  );
};

export default AdminInviteForm;
