package com.safechat.secure_messaging.controller;

import com.safechat.secure_messaging.model.Message;
import com.safechat.secure_messaging.model.User;
import com.safechat.secure_messaging.repository.MessageRepository;
import com.safechat.secure_messaging.repository.UserRepository;
import com.safechat.secure_messaging.service.EncryptionService;
import com.safechat.secure_messaging.service.MessageExpirationService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/messages")
public class MessageController {

    // Typing users map at class level
    private static Map<String, String> typingUsers = new ConcurrentHashMap<>();

    @Autowired
    private MessageRepository messageRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private EncryptionService encryptionService;

    @Autowired
    private MessageExpirationService messageExpirationService;

    // DTO for sending messages
    public static class MessageRequest {
        private UUID receiverId;
        private String content;
        private boolean readOnce;
        private Integer expirationMinutes;

        public UUID getReceiverId() {
            return receiverId;
        }

        public void setReceiverId(UUID receiverId) {
            this.receiverId = receiverId;
        }

        public String getContent() {
            return content;
        }

        public void setContent(String content) {
            this.content = content;
        }

        public boolean isReadOnce() {
            return readOnce;
        }

        public void setReadOnce(boolean readOnce) {
            this.readOnce = readOnce;
        }

        public Integer getExpirationMinutes() {
            return expirationMinutes;
        }

        public void setExpirationMinutes(Integer expirationMinutes) {
            this.expirationMinutes = expirationMinutes;
        }
    }

    // DTO for message responses
    public static class MessageResponse {
        private UUID id;
        private String senderUsername;
        private String receiverUsername;
        private String content;
        private LocalDateTime timestamp;
        private boolean read;
        private boolean readOnce;
        private LocalDateTime expiresAt;
        private boolean isEncrypted;

        public MessageResponse(Message message, String decryptedContent) {
            this.id = message.getId();
            this.senderUsername = message.getSender().getUsername();
            this.receiverUsername = message.getReceiver().getUsername();
            this.content = decryptedContent;
            this.timestamp = message.getTimestamp();
            this.read = message.isRead();
            this.readOnce = message.isReadOnce();
            this.expiresAt = message.getExpiresAt();
            this.isEncrypted = message.getKeyId() != null;
        }

        // Getters and setters for all fields
        public UUID getId() {
            return id;
        }

        public void setId(UUID id) {
            this.id = id;
        }

        public String getSenderUsername() {
            return senderUsername;
        }

        public void setSenderUsername(String senderUsername) {
            this.senderUsername = senderUsername;
        }

        public String getReceiverUsername() {
            return receiverUsername;
        }

        public void setReceiverUsername(String receiverUsername) {
            this.receiverUsername = receiverUsername;
        }

        public String getContent() {
            return content;
        }

        public void setContent(String content) {
            this.content = content;
        }

        public LocalDateTime getTimestamp() {
            return timestamp;
        }

        public void setTimestamp(LocalDateTime timestamp) {
            this.timestamp = timestamp;
        }

        public boolean isRead() {
            return read;
        }

        public void setRead(boolean read) {
            this.read = read;
        }

        public boolean isReadOnce() {
            return readOnce;
        }

        public void setReadOnce(boolean readOnce) {
            this.readOnce = readOnce;
        }

        public LocalDateTime getExpiresAt() {
            return expiresAt;
        }

        public void setExpiresAt(LocalDateTime expiresAt) {
            this.expiresAt = expiresAt;
        }

        public boolean isEncrypted() {
            return isEncrypted;
        }

        public void setEncrypted(boolean encrypted) {
            isEncrypted = encrypted;
        }
    }

    // DTO for Typing Notification
    public static class TypingNotification {
        private String senderId;
        private String receiverId;
        
        public String getSenderId() { 
            return senderId; 
        }
        
        public void setSenderId(String senderId) { 
            this.senderId = senderId; 
        }
        
        public String getReceiverId() { 
            return receiverId; 
        }
        
        public void setReceiverId(String receiverId) { 
            this.receiverId = receiverId; 
        }
    }

    // Get current authenticated user
    private User getCurrentUser() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        return userRepository.findByUsername(auth.getName())
                .orElseThrow(() -> new RuntimeException("User not found"));
    }

    // Send a new message
    @PostMapping
    public ResponseEntity<?> sendMessage(@RequestBody MessageRequest request) {
        try {
            User sender = getCurrentUser();
            User receiver = userRepository.findById(request.getReceiverId())
                    .orElseThrow(() -> new RuntimeException("Recipient not found"));
    
            // Encrypt the message content
            String keyId = encryptionService.generateKey();
            Map<String, String> encryptedData = encryptionService.encrypt(request.getContent(), keyId);
    
            // Create and save the message
            Message message = new Message();
            message.setSender(sender);
            message.setReceiver(receiver);
            message.setContent(encryptedData.get("encryptedContent"));
            message.setKeyId(keyId);
            message.setTimestamp(LocalDateTime.now());
            message.setRead(false);
            message.setRevoked(false);
            message.setReadOnce(request.isReadOnce());
            message.setIv(encryptedData.get("iv"));
    
            // Set expiration if requested
            if (request.getExpirationMinutes() != null && request.getExpirationMinutes() > 0) {
                LocalDateTime expirationTime = LocalDateTime.now().plusMinutes(request.getExpirationMinutes());
                message.setExpiresAt(expirationTime);
            } else {
                // Explicitly set to null if no expiration
                message.setExpiresAt(null);
            }
    
            message = messageRepository.save(message);
    
            return ResponseEntity.status(HttpStatus.CREATED).body(Map.of(
                    "messageId", message.getId(),
                    "sent", true,
                    "timestamp", message.getTimestamp(),
                    "expiresAt", message.getExpiresAt()
            ));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Failed to send message: " + e.getMessage()));
        }
    }

    // Get all messages for the current user
        @GetMapping
        public ResponseEntity<?> getMessages(
                @RequestParam(required = false) UUID conversationWith,
                @RequestParam(required = false, defaultValue = "false") boolean unreadOnly) {
            try {
                User currentUser = getCurrentUser();
                List<Message> messages;

                if (conversationWith != null) {
                    // Get conversation with specific user
                    messages = messageRepository.findMessagesBetweenUsers(currentUser.getId(), conversationWith);
                } else if (unreadOnly) {
                    // Get only unread messages
                    messages = messageRepository.findByReceiverIdAndReadFalse(currentUser.getId());
                } else {
                    // Get all messages where user is sender or receiver
                    List<Message> sent = messageRepository.findBySenderId(currentUser.getId());
                    List<Message> received = messageRepository.findByReceiverId(currentUser.getId());
                    
                    messages = new ArrayList<>();
                    messages.addAll(sent);
                    messages.addAll(received);
                    
                    // Sort by timestamp
                    messages.sort(Comparator.comparing(Message::getTimestamp).reversed());
                }

                // Filter out expired messages
                LocalDateTime now = LocalDateTime.now();
                messages = messages.stream()
                    .filter(msg -> msg.getExpiresAt() == null || msg.getExpiresAt().isAfter(now))
                    .collect(Collectors.toList());

                List<MessageResponse> responses = new ArrayList<>();
                for (Message message : messages) {
                    // Decryption logic remains the same
                    try {
                        String decryptedContent;
                        if (message.getKeyId() != null && message.getIv() != null) {
                            decryptedContent = encryptionService.decrypt(message.getContent(), message.getIv(), message.getKeyId());
                        } else {
                            decryptedContent = "[Message no longer available]";
                        }
                        responses.add(new MessageResponse(message, decryptedContent));
                    } catch (Exception e) {
                        responses.add(new MessageResponse(message, "[Unable to decrypt message]"));
                    }
                }

                return ResponseEntity.ok(responses);
            } catch (Exception e) {
                return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                        .body(Map.of("error", "Failed to retrieve messages: " + e.getMessage()));
            }
        }

    // Get a specific message
    @GetMapping("/{messageId}")
    public ResponseEntity<?> getMessage(@PathVariable UUID messageId) {
        try {
            User currentUser = getCurrentUser();
            Message message = messageRepository.findById(messageId)
                    .orElseThrow(() -> new RuntimeException("Message not found"));
    
            // Check if user is authorized to view this message
            if (!message.getSender().getId().equals(currentUser.getId()) && 
                !message.getReceiver().getId().equals(currentUser.getId())) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                        .body(Map.of("error", "You are not authorized to view this message"));
            }
    
            // If user is the receiver and message is unread, mark as read
            if (message.getReceiver().getId().equals(currentUser.getId()) && !message.isRead()) {
                messageExpirationService.markMessageAsRead(messageId, currentUser.getUsername());
                // Reload the message after marking as read
                message = messageRepository.findById(messageId).orElseThrow();
            }
    
            // Decrypt message properly
            String decryptedContent;
            if (!message.isRevoked() && message.getKeyId() != null && message.getIv() != null) {
                decryptedContent = encryptionService.decrypt(message.getContent(), message.getIv(), message.getKeyId());
            } else if (message.isRevoked()) {
                decryptedContent = "[Message has been revoked by an Admin]";
            } else {
                decryptedContent = "[Message no longer available]";
            }
    
            return ResponseEntity.ok(new MessageResponse(message, decryptedContent));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Failed to retrieve message: " + e.getMessage()));
        }
    }

    // Delete a message (only sender can delete)
    @DeleteMapping("/{messageId}")
    public ResponseEntity<?> deleteMessage(@PathVariable UUID messageId) {
        try {
            User currentUser = getCurrentUser();
            Message message = messageRepository.findById(messageId)
                    .orElseThrow(() -> new RuntimeException("Message not found"));
    
            // Verify the sender is the current user
            if (!message.getSender().getId().equals(currentUser.getId())) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                        .body(Map.of("error", "Only the sender can delete this message"));
            }
    
            // Hard delete the message
            messageRepository.delete(message);
    
            // Delete the encryption key if it exists
            if (message.getKeyId() != null) {
                encryptionService.deleteKey(message.getKeyId());
            }
    
            return ResponseEntity.ok(Map.of(
                    "deleted", true,
                    "messageId", messageId
            ));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Failed to delete message: " + e.getMessage()));
        }
    }

    // Count unread messages
    @GetMapping("/unread/count")
    public ResponseEntity<?> getUnreadCount() {
        try {
            User currentUser = getCurrentUser();
            Long unreadCount = messageRepository.countUnreadMessagesByReceiverId(currentUser.getId());
            
            return ResponseEntity.ok(Map.of("unreadCount", unreadCount));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Failed to get unread count: " + e.getMessage()));
        }
    }

    // Typing indicator
    @PostMapping("/typing")
    public ResponseEntity<?> handleTyping(@RequestBody TypingNotification typingNotification) {
        System.out.println("User " + typingNotification.getSenderId() + " is typing to " + typingNotification.getReceiverId());
        typingUsers.put(typingNotification.getSenderId(), typingNotification.getReceiverId());
        return ResponseEntity.ok(Map.of("status", "typing"));
    }

    @PostMapping("/typing-stopped")
    public ResponseEntity<?> handleTypingStopped(@RequestBody TypingNotification typingNotification) {
        System.out.println("User " + typingNotification.getSenderId() + " stopped typing.");
        typingUsers.remove(typingNotification.getSenderId());
        return ResponseEntity.ok(Map.of("status", "not typing"));
    }


    // Endpoint to check who is typing to the current user
    @GetMapping("/typing-status")
    public ResponseEntity<?> getTypingStatus(@RequestParam String userId) {
        try {
            // Log the incoming userId for debugging
            System.out.println("Checking typing status for userId: " + userId);
    
            // Ensure userId is not null or empty
            if (userId == null || userId.trim().isEmpty()) {
                return ResponseEntity.badRequest().body(Map.of(
                    "error", "Invalid user ID",
                    "isTyping", false
                ));
            }
    
            // Find who is typing to this user
            String typingUser = typingUsers.entrySet().stream()
                .filter(entry -> entry.getValue().equals(userId))
                .map(Map.Entry::getKey)
                .findFirst()
                .orElse(null);
    
            // Log the result for debugging
            System.out.println("Typing user found: " + (typingUser != null ? typingUser : "None"));
    
            return ResponseEntity.ok(Map.of(
                "isTyping", typingUser != null, 
                "typingUserId", typingUser != null ? typingUser : ""
            ));
        } catch (Exception e) {
            // Log the full exception for server-side debugging
            e.printStackTrace();
            
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(Map.of(
                    "error", "Failed to check typing status: " + e.getMessage(),
                    "isTyping", false
                ));
        }
    }
}