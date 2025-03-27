package com.safechat.secure_messaging.dto;

import lombok.Data;
import java.time.LocalDateTime;
import java.util.UUID;

import com.safechat.secure_messaging.model.Message;

@Data
public class MessageResponse {
    private UUID id;
    private String senderUsername;
    private String recipientUsername;
    private String content;
    private LocalDateTime sentAt;
    private LocalDateTime readAt;
    private boolean read;
    private boolean readOnce;
    private LocalDateTime expirationTime;
    private boolean adminRevoked;
    private boolean expired;
    private boolean isEncrypted;
    private String keyId;  // Add this to capture the key ID

    public MessageResponse(Message message, String decryptedContent) {
        // Add very detailed logging
        System.out.println("=================== MESSAGE RESPONSE CREATION ===================");
        System.out.println("Message ID: " + message.getId());
        System.out.println("Message Raw KeyID: " + message.getKeyId());
        System.out.println("Message KeyID toString: " + (message.getKeyId() != null ? message.getKeyId().toString() : "null"));
        System.out.println("Is Encrypted (Null Check): " + (message.getKeyId() != null));
        
        this.id = message.getId();
        this.senderUsername = message.getSender().getUsername();
        this.recipientUsername = message.getReceiver().getUsername();
        this.content = decryptedContent;
        this.sentAt = message.getTimestamp();
        this.readAt = message.getReadAt();
        this.read = message.isRead();
        this.readOnce = message.isReadOnce();
        this.expirationTime = message.getExpiresAt();
        this.adminRevoked = message.isRevoked();
        this.expired = message.getExpiresAt() != null && message.getExpiresAt().isBefore(LocalDateTime.now());
        
        // Explicit encryption status check
        this.keyId = message.getKeyId() != null ? message.getKeyId().toString() : null;
        this.isEncrypted = this.keyId != null && !this.keyId.isEmpty();
        
        System.out.println("Final Encryption Status: " + this.isEncrypted);
        System.out.println("Final KeyID: " + this.keyId);
        System.out.println("=============================================================");
    }
}