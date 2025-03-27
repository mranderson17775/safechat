// Adding a skeleton for the missing method in AuditLogService
package com.safechat.secure_messaging.service;
import com.safechat.secure_messaging.model.AuditLog;
import com.safechat.secure_messaging.model.User;
import com.safechat.secure_messaging.repository.AuditLogRepository;
import com.safechat.secure_messaging.repository.UserRepository;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
public class AuditLogService {
    @Autowired
    private AuditLogRepository auditLogRepository;
    
    @Autowired
    private UserRepository userRepository;
    
    // Log message expiration (added to match service calls)
    public void logMessageExpiration(UUID messageId, String senderUsername, String receiverUsername) {
        AuditLog log = new AuditLog();
        log.setAction("MESSAGE_EXPIRED");
        log.setDetails("Message with ID " + messageId + " from user " + senderUsername + 
                " to user " + receiverUsername + " has expired and been deleted");
        log.setTimestamp(LocalDateTime.now());
        log.setIpAddress(getClientIpAddress());
        auditLogRepository.save(log);
    }
    
    // Log message destruction (added to match service calls)
    public void logMessageDestruction(UUID messageId, String reason) {
        AuditLog log = new AuditLog();
        log.setAction("MESSAGE_DESTROYED");
        log.setDetails("Message with ID " + messageId + " was destroyed. Reason: " + reason);
        log.setTimestamp(LocalDateTime.now());
        log.setIpAddress(getClientIpAddress());
        auditLogRepository.save(log);
    }
    
    // Log message revocation (admin function)
    public void logMessageRevocation(UUID messageId, UUID adminId, String reason) {
        Optional<User> adminOpt = userRepository.findById(adminId);
        if (adminOpt.isPresent()) {
            AuditLog log = new AuditLog();
            log.setUser(adminOpt.get());
            log.setAction("MESSAGE_REVOKED");
            log.setDetails("Message with ID " + messageId + " was revoked by admin with ID " + adminId + " due to: " + reason);
            log.setTimestamp(LocalDateTime.now());
            log.setIpAddress(getClientIpAddress());
            auditLogRepository.save(log);
        }
    }

    public void logEvent(String username, String action, String details) {
        Optional<User> userOpt = userRepository.findByUsername(username);
        if (userOpt.isPresent()) {
            AuditLog log = new AuditLog();
            log.setUser(userOpt.get());
            log.setAction(action);
            log.setDetails(details);
            log.setTimestamp(LocalDateTime.now());
            log.setIpAddress(getClientIpAddress());
            auditLogRepository.save(log);
        }
    }
    
    // Helper method to get client IP address from the request
    private String getClientIpAddress() {
        try {
            ServletRequestAttributes attributes = (ServletRequestAttributes) RequestContextHolder.getRequestAttributes();
            if (attributes != null) {
                HttpServletRequest request = attributes.getRequest();
                String xForwardedFor = request.getHeader("X-Forwarded-For");
                if (xForwardedFor != null && !xForwardedFor.isEmpty()) {
                    return xForwardedFor.split(",")[0].trim();
                }
                return request.getRemoteAddr();
            }
        } catch (Exception e) {
            // Log exception
        }
        return "0.0.0.0";
    }
}