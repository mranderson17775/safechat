import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'api/axios';
import { AxiosError } from 'axios';

interface User {
  id: string;
  username: string;
  email: string;
  roles?: string[]; // Make roles optional with the ? operator
  isAdmin: boolean; // This will be calculated
  isOnline: boolean;
}

interface Message {
  id: string;
  senderUsername: string;
  receiverUsername: string;
  content: string;
  timestamp: string;
  expiresAt: string | null;
  keyId?: string; // Optional field to match backend
}

const AdminDashboard: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [error, setError] = useState('');
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [systemStats, setSystemStats] = useState<any>(null);
  const [newUser, setNewUser] = useState({
    username: '',
    email: '',
    password: '',
    roles: ['USER'],
    twoFactorEnabled: false,
    phoneNumber: '',
  });

  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Fetch current user details on component mount
  useEffect(() => {
    const fetchCurrentUser = async () => {
      try {
        const response = await axios.get('/user/profile');
        setCurrentUser(response.data);
        
        console.log("Current user roles:", response.data.roles); // Debug roles
        
        // Make sure you're checking for the same role names here
        if (
          !response.data.roles.includes('ROLE_SUPPORT_ADMIN') &&
          !response.data.roles.includes('ROLE_SUPER_ADMIN')
        ) {
          navigate('/home'); // Redirect if not admin
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
        setError('Authentication failed. Please log in with an admin account.');
        navigate('/login');
      } finally {
        setLoading(false);
      }
    };
  
    fetchCurrentUser();
  }, [navigate]);

  useEffect(() => {
    if (currentUser) {
      // Fetch users, logs, and stats only if the current user has valid roles
      const fetchData = async () => {
        try {
          // Add error handling for each request
          try {
            await fetchUsers(); // Use the fetchUsers function here
          } catch (error) {
            console.error('Error fetching users:', error);
          }

          try {
            const logsResponse = await axios.get('/api/admin/audit-logs');
            setAuditLogs(logsResponse.data);
          } catch (error) {
            console.error('Error fetching audit logs:', error);
          }

          try {
            const statsResponse = await axios.get('/api/admin/stats');
            setSystemStats(statsResponse.data);
          } catch (error) {
            console.error('Error fetching system stats:', error);
          }

          try {
            const messagesResponse = currentUser?.roles?.includes('ROLE_SUPPORT_ADMIN') || 
                                      currentUser?.roles?.includes('ROLE_SUPER_ADMIN')
              ? await axios.get('/api/admin/messages')  // New admin-specific endpoint
              : await axios.get('/api/messages');       // Original user-specific endpoint
            
            console.log("Raw messages:", messagesResponse.data);
            
            const messagesWithLogging = messagesResponse.data.map((message: Message) => {
              console.log(`Message ${message.id}`);
              return message;
            });
            
            setMessages(messagesWithLogging);
          } catch (error) {
            console.error('Error fetching messages:', error);
          }
        } catch (error) {
          console.error('Error fetching data:', error);
          setError('Failed to load data');
        }
      };

      fetchData();
    }
  }, [currentUser]);

  const handleError = (error: unknown) => {
    if (error instanceof AxiosError) {
      // Handle Axios errors
      setError(error.response?.data?.message || 'An unexpected error occurred');
    } else {
      setError('An unknown error occurred');
    }
  };

  const fetchAuditLogs = async () => {
    try {
      const logsResponse = await axios.get('/api/admin/audit-logs');
      setAuditLogs(logsResponse.data);
    } catch (error) {
      console.error('Error fetching audit logs:', error);
    }
  };

  // Toggle admin status
  const toggleAdminStatus = async (userId: string, userRoles: string[]) => {
    // Check if the current user is a super admin
    const isSuperAdmin = currentUser?.roles?.includes('ROLE_SUPER_ADMIN');

    // If not a super admin, show the specific error
    if (!isSuperAdmin) {
      setError('Only a Super Admin can toggle Admin status.');
      return;
    }

    // Previous existing protection for super admin user
    if (userRoles.includes('ROLE_SUPER_ADMIN')) {
      setError('Cannot revoke Super Admin status.');
      return;
    }

    try {
      setLoading(true);
      const response = await axios.post(`/api/admin/toggle-admin/${userId}`);
      
      if (response.data.success) {
        // Completely refresh both users and audit logs from server
        try {
          const usersResponse = await axios.get('/user/all');
          const mappedUsers = usersResponse.data.map((user: any) => ({
            ...user,
            isAdmin: user.roles ? 
              (user.roles.includes('ROLE_SUPPORT_ADMIN') || 
               user.roles.includes('ROLE_SUPER_ADMIN')) : 
              false
          }));
          setUsers(mappedUsers);
        } catch (error) {
          console.error('Error refreshing users:', error);
        }
        
        try {
          const logsResponse = await axios.get('/api/admin/audit-logs');
          setAuditLogs(logsResponse.data);
        } catch (error) {
          console.error('Error refreshing audit logs:', error);
        }
      } else {
        setError('Failed to update user role');
      }
    } catch (error) {
      console.error("Toggle admin error:", error);
      handleError(error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await axios.get('/user/all');
      console.log("Raw user data:", response.data);
      
      const mappedUsers = response.data.map((user: { roles: string | string[]; username: any; }) => {
        const hasAdminRole = user.roles && (
          user.roles.includes('ROLE_SUPPORT_ADMIN') || 
          user.roles.includes('ROLE_SUPER_ADMIN')
        );
        console.log(`User ${user.username} - has admin role: ${hasAdminRole}`);
        
        return {
          ...user,
          isAdmin: hasAdminRole
        };
      });
      
      console.log("Processed users:", mappedUsers);
      setUsers(mappedUsers);
      return mappedUsers;
    } catch (error) {
      console.error('Error fetching users:', error);
      setError('Failed to load users');
      return [];
    }
  };

  // Delete user
  const handleDeleteUser = async (userId: string, userRoles: string[]) => {
    try {
      const response = await axios.delete(`/api/admin/users/${userId}`);
      
      if (response.data.deleted) {
        // Successfully deleted
        setUsers((prevUsers) => prevUsers.filter((user) => user.id !== userId));
        await fetchAuditLogs();
      } else {
        // Handle unexpected response
        setError(response.data.error || 'Failed to delete user');
      }
    } catch (error) {
      console.error('Error deleting user:', error);
      
      // Type-safe error handling
      if (error instanceof AxiosError) {
        // Handle Axios-specific errors
        if (error.response) {
          // The request was made and the server responded with a status code
          // that falls out of the range of 2xx
          setError(error.response.data.error || 'Failed to delete user');
        } else if (error.request) {
          // The request was made but no response was received
          setError('No response received from server');
        } else {
          // Something happened in setting up the request that triggered an Error
          setError('Error setting up the request');
        }
      } else {
        // Handle generic errors
        setError('An unexpected error occurred');
      }
    }
  };

  // Revoke a message
  const handleRevokeMessage = async (messageId: string, reason: string) => {
    try {
      await axios.post(`/api/admin/messages/${messageId}/revoke`, { reason });
      setMessages((prevMessages) =>
        prevMessages.filter((message) => message.id !== messageId)
      );
    } catch (error) {
      console.error('Error revoking message:', error);
      setError('Failed to revoke message');
    }
  };

  // View a specific message
  const handleViewMessage = async (messageId: string) => {
    try {
      const response = await axios.get(`/api/messages/${messageId}`);
      
      console.log("Full message details:", JSON.stringify(response.data, null, 2));
      
      // Set the selected message without `isEncrypted` and `readOnce`
      setSelectedMessage({
        ...response.data,
      });
    } catch (error) {
      console.error('Error fetching message:', error);
      setError('Failed to fetch message');
    }
  };

  // Handle create new user
  const handleCreateUser = async () => {
    try {
      if (!newUser.username || !newUser.email || !newUser.password) {
        setError('Please fill in all required fields');
        return;
      }
      
      const response = await axios.post('/api/admin/users', newUser);
      setUsers((prevUsers) => [...prevUsers, response.data]);
      setNewUser({
        username: '',
        email: '',
        password: '',
        roles: ['USER'],
        twoFactorEnabled: false,
        phoneNumber: '',
      });
      setError(''); // Clear any previous errors
    } catch (error) {
      console.error('Error creating user:', error);
      setError('Failed to create user');
    }
  };

  // Clear message selection
  const clearSelectedMessage = () => {
    setSelectedMessage(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="spinner-border text-primary" role="status">
            <span className="sr-only">Loading...</span>
          </div>
          <p className="mt-2">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error && !currentUser) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <h3 className="text-xl text-red-500">{error}</h3>
          <button 
            onClick={() => navigate('/login')} 
            className="mt-4 px-4 py-2 bg-blue-500 text-white rounded"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4">
      <h2 className="text-2xl font-semibold">Admin Dashboard</h2>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mt-4">
          <span>{error}</span>
          <button 
            onClick={() => setError('')} 
            className="float-right text-red-700"
          >
            &times;
          </button>
        </div>
      )}

      {/* Display User List */}
      <div className="mt-4">
        <h3 className="text-xl font-medium">Users</h3>
        <table className="w-full mt-2 border-collapse">
          <thead>
            <tr className="border-b">
              <th className="py-2 px-4 text-left">Username</th>
              <th className="py-2 px-4 text-left">Email</th>
              <th className="py-2 px-4 text-left">Role</th>
              <th className="py-2 px-4 text-left">Status</th>
              <th className="py-2 px-4 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-4">No users found</td>
              </tr>
            ) : (
              users.map((user) => {
                // Check if current user is a super admin
                const isSuperAdmin = currentUser?.roles?.includes('ROLE_SUPER_ADMIN');
                
                // Determine if delete should be allowed
                const canDelete = 
                  isSuperAdmin || // Super admin can delete anyone
                  (!user.isAdmin && !user.roles?.includes('ROLE_SUPPORT_ADMIN')); // Non-admins can delete non-admin users

                return (
                  <tr key={user.id}>
                    <td className="py-2 px-4">{user.username}</td>
                    <td className="py-2 px-4">{user.email}</td>
                    <td className="py-2 px-4">
                      {user.roles?.includes('ROLE_SUPER_ADMIN') 
                        ? 'Super Admin' 
                        : (user.isAdmin === true ? 'Admin' : 'User')
                      }
                    </td>
                    <td className="py-2 px-4">
                      <span className={`inline-block w-3 h-3 rounded-full ${user.isOnline ? 'bg-green-500' : 'bg-gray-400'} mr-2`}></span>
                      {user.isOnline ? 'Online' : 'Offline'}
                    </td>
                    <td className="py-2 px-4 flex space-x-2">
                      {!user.roles?.includes('ROLE_SUPER_ADMIN') && (
                        <>
                          <button
                            onClick={() => toggleAdminStatus(user.id, user.roles || [])}
                            className="text-blue-500 hover:underline"
                          >
                            {user.isAdmin ? 'Revoke Admin' : 'Make Admin'}
                          </button>
                          {canDelete && (
                            <button
                              onClick={() => handleDeleteUser(user.id, user.roles || [])}
                              className="text-red-500 hover:underline"
                            >
                              Delete
                            </button>
                          )}
                        </>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>


      {/* Display Messages */}
      <div className="mt-4">
        <h3 className="text-xl font-medium">Messages</h3>
        <table className="w-full mt-2 border-collapse">
          <thead>
            <tr className="border-b">
              <th className="py-2 px-4 text-left">Sender</th>
              <th className="py-2 px-4 text-left">Receiver</th>
              <th className="py-2 px-4 text-left">Content</th>
              <th className="py-2 px-4 text-left">Timestamp</th>
              <th className="py-2 px-4 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {messages.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-4">No messages found</td>
              </tr>
            ) : (
              messages.map((message) => (
                <tr key={message.id}>
                  <td className="py-2 px-4">{message.senderUsername}</td>
                  <td className="py-2 px-4">{message.receiverUsername}</td>
                  <td className="py-2 px-4 truncate max-w-xs">{message.content}</td>
                  <td className="py-2 px-4">{new Date(message.timestamp).toLocaleString()}</td>
                  <td className="py-2 px-4 flex space-x-2">
                    <button
                      onClick={() => handleViewMessage(message.id)}
                      className="text-blue-500 hover:underline"
                    >
                      View
                    </button>
                    <button
                      onClick={() => handleRevokeMessage(message.id, 'Admin action')}
                      className="text-red-500 hover:underline"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Display Selected Message */}
      {selectedMessage && (
        <div className="mt-4 p-4 border rounded">
          <div className="flex justify-between">
            <h3 className="text-xl font-medium">Message Details</h3>
            <button onClick={clearSelectedMessage} className="text-gray-500">&times;</button>
          </div>
          <div className="mt-2">
            <p><strong>Sender:</strong> {selectedMessage.senderUsername}</p>
            <p><strong>Receiver:</strong> {selectedMessage.receiverUsername}</p>
            <p><strong>Content:</strong> {selectedMessage.content}</p>
            <p><strong>Timestamp:</strong> {new Date(selectedMessage.timestamp).toLocaleString()}</p>
            <p><strong>Expires At:</strong> {selectedMessage.expiresAt ? new Date(selectedMessage.expiresAt).toLocaleString() : 'Never'}</p>
          </div>
        </div>
      )}

      {/* User Creation Form */}
      <div className="mt-4 p-4 border rounded">
        <h3 className="text-xl font-medium">Create New User</h3>
        <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Username</label>
            <input
              type="text"
              className="mt-1 p-2 w-full border rounded"
              placeholder="Username"
              value={newUser.username}
              onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Email</label>
            <input
              type="email"
              className="mt-1 p-2 w-full border rounded"
              placeholder="Email"
              value={newUser.email}
              onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Password</label>
            <input
              type="password"
              className="mt-1 p-2 w-full border rounded"
              placeholder="Password"
              value={newUser.password}
              onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Phone Number (Optional)</label>
            <input
              type="text"
              className="mt-1 p-2 w-full border rounded"
              placeholder="Phone Number"
              value={newUser.phoneNumber}
              onChange={(e) => setNewUser({ ...newUser, phoneNumber: e.target.value })}
            />
          </div>
          <div className="flex items-center">
            <input
              type="checkbox"
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              checked={newUser.twoFactorEnabled}
              onChange={(e) => setNewUser({ ...newUser, twoFactorEnabled: e.target.checked })}
            />
            <label className="ml-2 block text-sm text-gray-900">Enable Two-Factor Authentication</label>
          </div>
        </div>
        <div className="mt-4">
          <button
            className="p-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            onClick={handleCreateUser}
          >
            Create User
          </button>
        </div>
      </div>

      {/* Audit Logs Section */}
      <div className="mt-4">
        <h3 className="text-xl font-medium">Audit Logs</h3>
        <table className="w-full mt-2 border-collapse">
          <thead>
            <tr className="border-b">
              <th className="py-2 px-4 text-left">Action</th>
              <th className="py-2 px-4 text-left">User</th>
              <th className="py-2 px-4 text-left">Details</th>
              <th className="py-2 px-4 text-left">Timestamp</th>
            </tr>
          </thead>
          <tbody>
            {auditLogs.length === 0 ? (
              <tr>
                <td colSpan={4} className="text-center py-4">No audit logs found</td>
              </tr>
            ) : (
              auditLogs.map((log, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="py-2 px-4">{log.action}</td>
                  <td className="py-2 px-4">{log.username || 'System'}</td>
                  <td className="py-2 px-4 truncate max-w-xs">{log.details}</td>
                  <td className="py-2 px-4">{new Date(log.timestamp).toLocaleString()}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* System Stats Section */}
      <div className="mt-4 p-4 border rounded">
        <h3 className="text-xl font-medium">System Stats</h3>
        {systemStats ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
            <div className="p-4 bg-blue-100 rounded">
              <p className="text-xl font-bold">{systemStats.totalUsers}</p>
              <p className="text-sm text-gray-600">Total Users</p>
            </div>
            <div className="p-4 bg-green-100 rounded">
              <p className="text-xl font-bold">{systemStats.totalMessages}</p>
              <p className="text-sm text-gray-600">Total Messages</p>
            </div>
            <div className="p-4 bg-yellow-100 rounded">
              <p className="text-xl font-bold">{systemStats.activeUsers24h}</p>
              <p className="text-sm text-gray-600">Active Users (24h)</p>
            </div>
            <div className="p-4 bg-purple-100 rounded">
              <p className="text-xl font-bold">{systemStats.totalAuditLogs}</p>
              <p className="text-sm text-gray-600">Total Audit Logs</p>
            </div>
            <div className="p-4 bg-gray-100 rounded col-span-2">
              <p className="text-sm text-gray-600">Server Time</p>
              <p className="text-xl">{new Date(systemStats.serverTime).toLocaleString()}</p>
            </div>
          </div>
        ) : (
          <div className="flex justify-center items-center h-32">
            <p>Loading system stats...</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;