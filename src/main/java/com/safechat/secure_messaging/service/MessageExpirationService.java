// MessageExpirationService.java - fixing keyId issue
package com.safechat.secure_messaging.service;
import com.safechat.secure_messaging.model.Message;
import com.safechat.secure_messaging.repository.MessageRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Service
public class MessageExpirationService {
    @Autowired
    private MessageRepository messageRepository;
    
    @Autowired
    private EncryptionService encryptionService;
    
    @Autowired
    private AuditLogService auditLogService;
    
    // Run every hour to check for expired messages
    @Scheduled(fixedRate = 3600000)
    @Transactional
    public void processExpiredMessages() {
        LocalDateTime now = LocalDateTime.now();
        List<Message> expiredMessages = messageRepository.findByExpiresAtBefore(now);
        
        for (Message message : expiredMessages) {
            // Delete encryption key if available
            if (message.getKeyId() != null) {
                encryptionService.deleteKey(message.getKeyId()); // Fixed: keyId is already a String
            }
            
            // Log the expiration event
            auditLogService.logMessageExpiration(message.getId(), message.getSender().getUsername(),
                    message.getReceiver().getUsername());
        }
        
        // Delete expired messages from the database
        messageRepository.deleteByExpiresAtBefore(now);
    }
    
    // Mark message as read and handle read-once functionality
    @Transactional
    public void markMessageAsRead(UUID messageId, String username) {
        Message message = messageRepository.findById(messageId)
                .orElseThrow(() -> new RuntimeException("Message not found"));
        
        // Verify the recipient is the current user
        if (!message.getReceiver().getUsername().equals(username)) {
            throw new RuntimeException("Unauthorized access to message");
        }
        
        // Mark as read
        message.setRead(true);
        message.setReadAt(LocalDateTime.now());
        messageRepository.save(message);
        
        // Handle read-once message
        if (message.isReadOnce()) {
            // Delete the encryption key
            if (message.getKeyId() != null) {
                encryptionService.deleteKey(message.getKeyId()); // Fixed: keyId is already a String
            }
            
            // Log the read-once destruction
            auditLogService.logMessageDestruction(messageId, "Read-once message accessed");
            
            // Set expiration to now (will be cleaned up by scheduled task)
            message.setExpiresAt(LocalDateTime.now());
            messageRepository.save(message);
        }
    }
    
    // Revoke a message (admin function)
    @Transactional
    public void revokeMessage(UUID messageId, UUID adminId, String reason) {
        Message message = messageRepository.findById(messageId)
                .orElseThrow(() -> new RuntimeException("Message not found"));
        
        // Mark the message as revoked
        message.setAdminRevoked(true);
        message.setRevokedById(adminId);
        message.setRevokedAt(LocalDateTime.now());
        message.setRevocationReason(reason);
        
        // Delete encryption key
        if (message.getKeyId() != null) {
            encryptionService.deleteKey(message.getKeyId()); // Fixed: keyId is already a String
        }
        
        messageRepository.save(message);
        
        // Log the revocation event
        auditLogService.logMessageRevocation(messageId, adminId, reason);
    }
}
