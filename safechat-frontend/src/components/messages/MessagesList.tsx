import React, { useState, useEffect, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import axios from 'api/axios';
import { format } from 'date-fns';
import { RootState } from 'store';
import { Send, Clock, Lock } from 'lucide-react';

interface MessageType {
  id: string;
  messageId: string;
  senderId: string;
  receiverId: string;
  content: string;
  timestamp: string;
  read: boolean;
  expired: boolean;
  revoked: boolean;
  iv: string;
  keyId: string;
  isEncrypted: boolean;
  expiresAt?: string;
  isReadOnce?: boolean;
  senderUsername?: string;
  receiverUsername?: string;
}

interface User {
  id: string;
  username: string;
  avatar?: string;
  isOnline: boolean;
}

interface AuthUser {
  id: string;
  username: string;
}

const MessagesList: React.FC = () => {
  const [messages, setMessages] = useState<MessageType[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [typingTimeout, setTypingTimeout] = useState<NodeJS.Timeout | null>(null);
  const [useExpiration, setUseExpiration] = useState(true);
  const [typingUser, setTypingUser] = useState<string | null>(null);
  const [deletingMessages, setDeletingMessages] = useState<Set<string>>(new Set());
  const [messageError, setMessageError] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const currentUser = useSelector((state: RootState) => state.auth.user as AuthUser | null);
  const dispatch = useDispatch();

  const isValidUUID = (uuid: string): boolean => {
    const regex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
    return regex.test(uuid);
  };

  // Auto-resize textarea function
  const autoResizeTextarea = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 150)}px`; 
    }
  };

  // Fetch users effect
  useEffect(() => {
    if (!currentUser) return;

    const fetchUsers = async () => {
      try {
        const response = await axios.get('/user/all');
        console.log('Fetched Users:', response.data);
        setUsers(response.data);
        
        if (response.data.length > 0 && !selectedUser) {
          setSelectedUser(response.data[0].id);
        }
      } catch (error) {
        console.error('Error fetching users:', error);
      }
    };

    fetchUsers();
    const intervalId = setInterval(fetchUsers, 30000);

    return () => clearInterval(intervalId);
  }, [currentUser, selectedUser]);

  // Typing status effect
  useEffect(() => {
    if (!currentUser) return;

    const checkTypingStatus = async () => {
      if (selectedUser) {
        try {
          const response = await axios.get(`/api/messages/typing-status?userId=${currentUser.id}`);
          
          if (response.data.isTyping) {
            const typingUsername = users.find(u => u.id === response.data.typingUserId)?.username;
            setTypingUser(typingUsername || null);
          } else {
            setTypingUser(null);
          }
          console.log("Current typing user:", typingUser);
        } catch (error) {
          console.error('Error checking typing status:', error);
        }
      }
    };

    const intervalId = setInterval(checkTypingStatus, 1000);
    return () => clearInterval(intervalId);
  }, [currentUser, selectedUser, users]);

  // Message expiration check
  const isMessageExpired = (message: MessageType): boolean => {
    if (message.expired) return true;
    if (message.expiresAt) {
      const now = new Date();
      const expiryDate = new Date(message.expiresAt);
      return now > expiryDate;
    }
    return false;
  };

  // Fetch messages effect
  useEffect(() => {
    if (!currentUser) return;

    const fetchMessages = async () => {
      if (!selectedUser || !isValidUUID(selectedUser)) return;
    
      try {
        const response = await axios.get(`/api/messages?conversationWith=${selectedUser}`);
        console.log('Fetched Messages:', response.data);
        
        const decryptedMessages = await Promise.all(response.data.map(async (message: MessageType) => {
          if (message.isEncrypted) {
            try {
              const decryptedContent = await axios.post('/api/decrypt', {
                encryptedContent: message.content,
                iv: message.iv,
                keyId: message.keyId,
              });
              return { ...message, content: decryptedContent.data };
            } catch (error) {
              console.error(`Failed to decrypt message with ID ${message.id}`, error);
              return { ...message, content: '[Message no longer available]' };
            }
          }
          return message;
        }));
    
        const filteredMessages = decryptedMessages.filter(message => {
          const msgExpired = isMessageExpired(message);
          return !msgExpired && !message.revoked;
        });
  
        const processedMessages = filteredMessages.map(msg => ({
          ...msg,
          id: msg.id || '',
          senderId: msg.senderId || 'unknown'
        }));
  
        setMessages(processedMessages);
    
        const unreadMessages = processedMessages.filter(
          (msg) => !msg.read && msg.receiverId === currentUser.id
        );
    
        if (unreadMessages.length > 0) {
          await axios.post('/api/messages/read', {
            messageIds: unreadMessages.map((msg) => msg.id),
          });
        }
      } catch (error) {
        console.error('Error fetching messages:', error);
      }
    };
  
    fetchMessages();
    const intervalId = setInterval(fetchMessages, 3000);
  
    return () => clearInterval(intervalId);
  }, [selectedUser, currentUser]);

  // Handle typing indicator
  const handleTyping = () => {
    if (!currentUser || !selectedUser) return;

    if (!isTyping) {
      setIsTyping(true);
      axios.post('/api/messages/typing', { 
        senderId: currentUser.id, 
        receiverId: selectedUser 
      });
    }

    if (typingTimeout) clearTimeout(typingTimeout);

    const timeout = setTimeout(() => {
      setIsTyping(false);
      axios.post('/api/messages/typing-stopped', { 
        senderId: currentUser.id, 
        receiverId: selectedUser 
      });
    }, 2000);

    setTypingTimeout(timeout);
  };

  // Send message function
  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();

    setMessageError(null);

    if (newMessage.length > 1000) {
      setMessageError('Message cannot exceed 1000 characters');
      return;
    }

    if (!currentUser || !selectedUser || !newMessage.trim()) return;

    try {
      const response = await axios.post('/api/messages', {
        receiverId: selectedUser,
        content: newMessage,
        expirationMinutes: useExpiration ? 1 : 0,
      });

      const optimisticMessage = {
        ...response.data,
        senderId: currentUser.id,
        senderUsername: currentUser.username
      };

      setMessages([...messages, optimisticMessage]);
      setNewMessage('');

      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }

      if (typingTimeout) clearTimeout(typingTimeout);
      setIsTyping(false);
      axios.post('/api/messages/typing-stopped', { 
        senderId: currentUser.id, 
        receiverId: selectedUser 
      });
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  // Delete message function
  const deleteMessage = async (message: MessageType) => {
    console.log('Delete message called with:', message);
    console.log('Current user:', currentUser);
  
    if (!message || !currentUser) {
      console.error('Cannot delete: Invalid message or user');
      return;
    }
  
    const deleteId = message.messageId || message.id;
  
    if (!deleteId) {
      console.error('Cannot delete: No valid message ID found');
      return;
    }
  
    try {
      setDeletingMessages(prev => new Set(prev.add(deleteId)));
  
      const response = await axios.delete(`/api/messages/${deleteId}`);
      console.log('Delete response:', response.data);
  
      setMessages(prevMessages => 
        prevMessages.filter((msg) => 
          msg.messageId !== deleteId && msg.id !== deleteId
        )
      );
    } catch (error) {
      console.error('Delete error:', error);
    } finally {
      setDeletingMessages(prev => {
        const updated = new Set(prev);
        updated.delete(deleteId);
        return updated;
      });
    }
  };
  
  // Not authenticated state
  if (!currentUser) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-gray-500">Please log in to view messages</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Contacts Sidebar */}
      <div className="w-72 bg-white border-r shadow-sm">
        <div className="p-4 border-b">
          <h2 className="text-xl font-semibold text-gray-800">Contacts</h2>
        </div>
        <ul className="divide-y">
          {users.map((user) => (
            <li 
              key={user.id} 
              className={`p-3 hover:bg-gray-100 cursor-pointer transition-colors ${selectedUser === user.id ? 'bg-blue-50' : ''}`}
              onClick={() => setSelectedUser(user.id)}
            >
              <div className="flex items-center">
                <div className="relative">
                  <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden">
                    {user.avatar ? (
                      <img 
                        src={user.avatar} 
                        alt={user.username} 
                        className="w-full h-full object-cover" 
                      />
                    ) : (
                      <span className="text-gray-600 font-medium">
                        {user.username.charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div 
                    className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${
                      user.isOnline ? 'bg-green-500' : 'bg-gray-400'
                    }`}
                  />
                </div>
                <div className="ml-3 flex-1">
                  <div className="font-medium text-gray-800">{user.username}</div>
                  <div className="text-xs text-gray-500">
                    {user.isOnline ? 'Online' : 'Offline'}
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col">
        {selectedUser ? (
          <>
            {/* Chat Header */}
            <div className="p-4 border-b bg-white shadow-sm flex items-center">
              <h2 className="text-lg font-semibold text-gray-800">
                {users.find((u) => u.id === selectedUser)?.username}
              </h2>
            </div>

            {/* Messages Container */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.map((message) => {
                const isOwn = message.senderId === currentUser?.id;
                const senderName = 
                  message.senderUsername || 
                  users.find(u => u.id === message.senderId)?.username || 
                  (isOwn ? currentUser.username : `Unknown User`);

                return (
                  <div 
                    key={message.id} 
                    className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className="max-w-[70%] flex flex-col">
                      <div 
                        className={`text-xs mb-1 ${
                          isOwn ? 'text-right text-blue-700' : 'text-left text-gray-600'
                        }`}
                      >
                        {senderName}
                      </div>
                      <div 
                        className={`p-3 rounded-xl w-full ${
                          isOwn 
                            ? 'bg-blue-500 text-white' 
                            : 'bg-gray-200 text-gray-800'
                        }`}
                      >
                        <div className="flex items-center space-x-1">
                          {message.isEncrypted && <Lock size={14} />}
                          <span className="break-words">{message.content}</span>
                        </div>
                        
                        <div className={`text-xs mt-1 flex justify-between ${
                          isOwn 
                            ? 'text-blue-200' 
                            : 'text-gray-500'
                        }`}>
                          <span>{format(new Date(message.timestamp), 'HH:mm')}</span>
                          {isOwn && (
                            <span>{message.read ? '✓✓' : '✓'}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
              
              {/* Typing Indicator */}
              {typingUser && (
                <div className="text-sm text-gray-500 italic">
                  {typingUser} is typing...
                </div>
              )}
            </div>

            {/* Message Input Area */}
            <div className="p-4 border-t bg-white">
              <form onSubmit={sendMessage} className="flex items-center space-x-2">
                <div className="flex-1 relative">
                  <textarea
                    ref={textareaRef}
                    value={newMessage}
                    onChange={(e) => {
                      const truncatedMessage = e.target.value.slice(0, 1000);
                      setNewMessage(truncatedMessage);
                      handleTyping();
                      autoResizeTextarea();
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        sendMessage(e as unknown as React.FormEvent);
                      }
                    }}
                    className="w-full p-2 pr-10 border rounded-lg resize-none overflow-hidden"
                    placeholder="Type a message..."
                    rows={1}
                  />
                  {newMessage.length > 0 && (
                    <div className="absolute right-2 bottom-2 text-xs text-gray-500">
                      {newMessage.length}/1000
                    </div>
                  )}
                </div>

                <div className="flex items-center space-x-2">
                  <label 
                    htmlFor="expiration-toggle" 
                    className="flex items-center space-x-1 text-sm text-gray-600 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      id="expiration-toggle"
                      checked={useExpiration}
                      onChange={() => setUseExpiration(!useExpiration)}
                      className="mr-1"
                    />
                    <Clock size={16} className="text-gray-500" />
                  </label>
                  
                  <button
                    type="submit"
                    className="p-2 bg-blue-500 text-white rounded-full hover:bg-blue-600 transition-colors disabled:opacity-50"
                    disabled={newMessage.length === 0 || newMessage.length > 1000}
                  >
                    <Send size={18} />
                  </button>
                </div>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-500">
            Select a contact to start chatting
          </div>
        )}
      </div>
    </div>
  );
};

export default MessagesList;