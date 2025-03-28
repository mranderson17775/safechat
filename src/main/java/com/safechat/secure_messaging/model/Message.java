package com.safechat.secure_messaging.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "messages")
public class Message {
    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    private UUID id;  // Using UUID for ID with AUTO generation strategy
    
    @ManyToOne
    @JoinColumn(name = "sender_id", nullable = false)
    private User sender;
    
    @ManyToOne
    @JoinColumn(name = "receiver_id", nullable = false)
    private User receiver;
    
    @Column(columnDefinition = "TEXT", nullable = false)
    private String content;
    
    @Column(nullable = false)
    private LocalDateTime timestamp;
    
    @Column(nullable = false)
    private boolean read;
    
    @Column(nullable = false)
    private boolean revoked;
    
    @Column
    private LocalDateTime expiresAt;
    
    @Column
    private String keyId; // Encryption Key ID
    
    @Column
    private boolean readOnce;
    
    @Column
    private String revocationReason;
    
    @Column
    private LocalDateTime revokedAt;
    
    @Column
    private LocalDateTime readAt; // Added for the readAt functionality mentioned in service
    
    @ManyToOne
    @JoinColumn(name = "revoked_by_id")
    private User revokedBy;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column
    private String iv; // Initialization Vector (IV) for encryption
    
    // Getters and Setters
    public UUID getId() {
        return id;
    }
    
    public void setId(UUID id) {
        this.id = id;
    }
    
    public User getSender() {
        return sender;
    }
    
    public void setSender(User sender) {
        this.sender = sender;
    }
    
    public User getReceiver() {
        return receiver;
    }
    
    public void setReceiver(User receiver) {
        this.receiver = receiver;
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
    
    public boolean isRevoked() {
        return revoked;
    }
    
    public void setRevoked(boolean revoked) {
        this.revoked = revoked;
    }
    
    public LocalDateTime getExpiresAt() {
        return expiresAt;
    }
    
    public void setExpiresAt(LocalDateTime expiresAt) {
        this.expiresAt = expiresAt;
    }
    
    public String getKeyId() {
        return keyId;
    }
    
    public void setKeyId(String keyId) {
        this.keyId = keyId;
    }
    
    public boolean isReadOnce() {
        return readOnce;
    }
    
    public void setReadOnce(boolean readOnce) {
        this.readOnce = readOnce;
    }
    
    public String getRevocationReason() {
        return revocationReason;
    }
    
    public void setRevocationReason(String revocationReason) {
        this.revocationReason = revocationReason;
    }
    
    public LocalDateTime getRevokedAt() {
        return revokedAt;
    }
    
    public void setRevokedAt(LocalDateTime revokedAt) {
        this.revokedAt = revokedAt;
    }
    
    public User getRevokedBy() {
        return revokedBy;
    }
    
    public void setRevokedBy(User revokedBy) {
        this.revokedBy = revokedBy;
    }
    
    public LocalDateTime getReadAt() {
        return readAt;
    }
    
    public void setReadAt(LocalDateTime readAt) {
        this.readAt = readAt;
    }
    
    public String getIv() {
        return iv;
    }

    public void setIv(String iv) {
        this.iv = iv;
    }
    
    // Custom methods for revocation and other features
    public void setAdminRevoked(boolean revoked) {
        this.revoked = revoked;
    }
    
    public void setRevokedById(UUID revokedById) {
        if (this.revokedBy == null) {
            this.revokedBy = new User();
        }
        this.revokedBy.setId(revokedById);  // Assuming User has a setId method
    }
}
