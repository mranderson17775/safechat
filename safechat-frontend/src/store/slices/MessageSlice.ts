// MessageSlice.ts - enhanced with encryption state
import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface Message {
  id: string;
  senderId: string;
  receiverId: string;
  content: string;
  encryptedContent?: string;
  iv?: string;
  keyId?: string;
  timestamp: string;
  read: boolean;
  expired: boolean;
  revoked: boolean;
  expiresAt?: string;
  isReadOnce?: boolean;
  isEncrypted: boolean;
}

interface TypingStatus {
  userId: string;
  isTyping: boolean;
}

interface MessageState {
  messages: Message[];
  typingUsers: Record<string, boolean>;
  loading: boolean;
  error: string | null;
}

const initialState: MessageState = {
  messages: [],
  typingUsers: {},
  loading: false,
  error: null
};

const messageSlice = createSlice({
  name: 'messages',
  initialState,
  reducers: {
    fetchMessagesStart(state) {
      state.loading = true;
      state.error = null;
    },
    fetchMessagesSuccess(state, action: PayloadAction<Message[]>) {
      state.messages = action.payload;
      state.loading = false;
    },
    fetchMessagesFailure(state, action: PayloadAction<string>) {
      state.loading = false;
      state.error = action.payload;
    },
    addMessage(state, action: PayloadAction<Message>) {
      state.messages.push(action.payload);
    },
    updateMessage(state, action: PayloadAction<Message>) {
      const index = state.messages.findIndex(msg => msg.id === action.payload.id);
      if (index !== -1) {
        state.messages[index] = action.payload;
      }
    },
    revokeMessage(state, action: PayloadAction<string>) {
      const index = state.messages.findIndex(msg => msg.id === action.payload);
      if (index !== -1) {
        state.messages[index].revoked = true;
      }
    },
    expireMessage(state, action: PayloadAction<string>) {
      const index = state.messages.findIndex(msg => msg.id === action.payload);
      if (index !== -1) {
        state.messages[index].expired = true;
      }
    },
    setTypingStatus(state, action: PayloadAction<TypingStatus>) {
      state.typingUsers[action.payload.userId] = action.payload.isTyping;
    }
  }
});

export const {
  fetchMessagesStart,
  fetchMessagesSuccess,
  fetchMessagesFailure,
  addMessage,
  updateMessage,
  revokeMessage,
  expireMessage,
  setTypingStatus
} = messageSlice.actions;

export default messageSlice.reducer;