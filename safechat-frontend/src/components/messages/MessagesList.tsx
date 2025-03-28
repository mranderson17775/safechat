import React, { useState, useEffect, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import axios from 'api/axios';
import { format, addMinutes } from 'date-fns';
import { RootState } from 'store';

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
  // Add other necessary fields
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
      textarea.style.height = `${Math.min(textarea.scrollHeight, 400)}px`; // Increased max height to 400px
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

    const intervalId = setInterval(checkTypingStatus, 2000);
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
        expirationMinutes: useExpiration ? 1 : null, // Change to null if no expiration
        readOnce: false  // Add this if you want to support read-once messages
      });

      const optimisticMessage = {
        ...response.data,
        senderId: currentUser.id,
        senderUsername: currentUser.username,
        expiresAt: useExpiration ? new Date(Date.now() + 60000).toISOString() : undefined
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
    <div className="flex h-full">
      <div className="w-1/4 bg-gray-100 overflow-y-auto">
        <h2 className="p-4 text-lg font-semibold border-b">Contacts</h2>
        <ul>
          {users.map((user) => {
            const isSelected = selectedUser === user.id;
            return (
              <li
                key={user.id}
                className={`p-4 border-b flex items-center cursor-pointer ${isSelected ? 'bg-blue-100' : ''}`}
              >
                <button
                  type="button"
                  className="w-full text-left"
                  onClick={() => setSelectedUser(user.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') setSelectedUser(user.id);
                  }}
                >
                  <div className="relative">
                    <div className="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center text-xl">
                      {user.avatar ? (
                        <img
                          src={user.avatar}
                          alt={user.username}
                          className="w-10 h-10 rounded-full"
                        />
                      ) : (
                        user.username.charAt(0).toUpperCase()
                      )}
                    </div>
                    <div
                      className={`absolute bottom-0 right-0 w-3 h-3 rounded-full ${
                        user.isOnline ? 'bg-green-500' : 'bg-gray-400'
                      }`}
                    ></div>
                  </div>
                  <div className="ml-3">
                    <div className="font-medium">{user.username}</div>
                    <div className="text-sm text-gray-500">
                      {user.isOnline ? 'Online' : 'Offline'}
                    </div>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="w-3/4 flex flex-col">
        {selectedUser ? (
          <>
            <div className="p-4 border-b flex items-center">
              <h2 className="font-medium">
                {users.find((u) => u.id === selectedUser)?.username}
              </h2>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              <div className="max-w-full flex flex-col items-stretch space-y-2">
                {messages.map((message) => {
                  const isOwn = 
                    message.senderUsername || 
                    users.find(u => u.id === message.senderId)?.username || 
                    (message.senderId === currentUser?.id ? currentUser.username : `Unknown User (ID: ${message.senderId.slice(0, 8)})`);
                  
                  const senderName = 
                    message.senderUsername || 
                    users.find(u => u.id === message.senderId)?.username || 
                    (message.senderId === currentUser?.id ? currentUser.username : `Unknown User (ID: ${message.senderId.slice(0, 8)})`);

                  return (
                    <div
                      key={message.id}
                      className={`flex ${
                        isOwn ? 'justify-end' : 'justify-start'
                      } w-full`}
                    >
                      <div className="flex flex-col w-full max-w-[80%]">
                        <div 
                          className={`text-xs mb-1 ${
                            isOwn ? 'text-right' : 'text-left'
                          } ${isOwn ? 'text-blue-700' : 'text-gray-600'}`}
                        >
                          {senderName}
                        </div>
                        
                        <div className="flex items-center w-full">
                          <div
                            className={`p-3 rounded-lg break-words w-full border ${
                              isOwn
                              ? 'bg-blue-500 text-white border-blue-600'
                              : 'bg-gray-300 border-gray-400'
                            }`}
                          >
                            <div className="flex items-center">
                              {message.isEncrypted && (
                                <span className="mr-1 text-xs">🔒</span>
                              )}
                              <div className="break-words w-full whitespace-pre-wrap">{message.content}</div>
                            </div>
                            
                            {message.isReadOnce && (
                              <div className="text-xs mt-1 italic">
                                Read once message
                              </div>
                            )}
                            
                            {message.expiresAt && (
                              <div className="text-xs mt-1 italic">
                                Expires in {format(new Date(message.expiresAt), 'HH:mm:ss')}
                              </div>
                            )}
                            
                            <div className={`text-xs mt-1 flex justify-between ${
                              isOwn ? 'text-blue-200' : 'text-gray-600'
                            }`}>
                              <span>{format(new Date(message.timestamp), 'HH:mm')}</span>
                              {isOwn && (
                                <span className="ml-2">
                                  {message.read ? '✓✓' : '✓'}
                                </span>
                              )}
                            </div>
                          </div>
                          
                          {isOwn && (
                            <div className="ml-2 flex flex-col justify-end mb-2">
                              <button
                                onClick={() => deleteMessage(message)}
                                disabled={deletingMessages.has(message.messageId || message.id)}
                                className={`text-xs hover:text-red-500 ${
                                  deletingMessages.has(message.messageId || message.id)
                                    ? 'text-gray-400 cursor-not-allowed' 
                                    : 'text-gray-500'
                                }`}
                              >
                                {deletingMessages.has(message.messageId || message.id) 
                                  ? 'Deleting...' 
                                  : 'Delete'}
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
                
                {/* Typing indicator */}
                {typingUser && (
                  <div className="text-sm text-gray-500 p-2">
                    {typingUser} is typing...
                  </div>
                )}
              </div>
            </div>

            <form onSubmit={sendMessage} className="p-4 border-t">
              <div className="flex items-center">
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
                    className="w-full border rounded-lg py-2 px-4 mr-2 resize-none overflow-hidden"
                    placeholder="Type a message..."
                    rows={6}  // Increased rows from 4 to 6
                  />
                  {messageError && (
                    <div className="absolute text-red-500 text-xs mt-1">
                      {messageError}
                    </div>
                  )}
                  {newMessage.length > 0 && (
                    <div className="absolute right-4 bottom-2 text-xs text-gray-500">
                      {newMessage.length}/1000
                    </div>
                  )}
                </div>
                
                <div className="flex items-center mr-2">
                  <input
                    type="checkbox"
                    id="expiration-toggle"
                    checked={useExpiration}
                    onChange={() => setUseExpiration(!useExpiration)}
                    className="mr-1"
                  />
                  <label htmlFor="expiration-toggle" className="text-xs text-gray-600">
                    1m Expiry
                  </label>
                </div>
                
                <button
                  type="submit"
                  className="bg-blue-500 text-white px-4 py-2 rounded-full h-full w-full max-w-[50px]"
                  disabled={newMessage.length > 1000}
                >
                  Send
                </button>
              </div>
            </form>
          </>
        ) : (
          <div className="text-center">Select a contact to start chatting</div>
        )}
      </div>
    </div>
  );
};

export default MessagesList;