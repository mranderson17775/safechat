import { store } from '../store';
import { setTypingStatus } from '../store/slices/MessageSlice';

class WebSocketService {
  private socket: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  
  connect(token: string): void {
    // Close existing connection if any
    if (this.socket) {
      this.socket.close();
    }
    
    // Connect to WebSocket server with authentication token
    this.socket = new WebSocket(`wss://your-domain.com/api/ws?token=${token}`);
    
    this.socket.onopen = this.onOpen.bind(this);
    this.socket.onmessage = this.onMessage.bind(this);
    this.socket.onclose = this.onClose.bind(this);
    this.socket.onerror = this.onError.bind(this);
  }
  
  disconnect(): void {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
  }
  
  private onOpen(event: Event): void {
    this.reconnectAttempts = 0;
  }
  
  private onMessage(event: MessageEvent): void {
    try {
      const data = JSON.parse(event.data);
      
      // Handle different types of messages
      switch (data.type) {
        case 'new_message':
          // Handle new message event
          // This will be handled by our polling for now, but we could dispatch directly here
          break;
          
        case 'typing_indicator':
          // Update typing indicator in Redux
          store.dispatch(
            setTypingStatus({
              userId: data.senderId,
              isTyping: data.isTyping
            })
          );
          break;
          
        case 'message_read':
          // Handle read receipt
          // This will be handled by our polling for now
          break;
          
        case 'message_revoked':
          // Handle message revocation
          // This will be handled by our polling for now
          break;
          
        case 'user_status':
          // Handle user online/offline status
          // This will be handled by our polling for now
          break;
          
        default:
      }
    } catch (error) {
      console.error('Error parsing WebSocket message:', error);
    }
  }
  
  private onClose(event: CloseEvent): void {

    
    // Attempt to reconnect if not a normal closure
    if (event.code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
      
      this.reconnectTimeout = setTimeout(() => {
        const token = store.getState().auth.token;
        if (token) {
          this.connect(token);
        }
      }, delay);
    }
  }
  
  private onError(event: Event): void {
    console.error('WebSocket error:', event);
  }
  
  // Send typing indicator
  sendTypingIndicator(receiverId: string, isTyping: boolean): void {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(
        JSON.stringify({
          type: 'typing_indicator',
          receiverId,
          isTyping
        })
      );
    }
  }
  
  // Send message read status
  sendReadReceipt(messageIds: string[]): void {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(
        JSON.stringify({
          type: 'read_receipt',
          messageIds
        })
      );
    }
  }
}

export const webSocketService = new WebSocketService();
export default webSocketService;