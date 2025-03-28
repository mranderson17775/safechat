// AdminController.java
package com.safechat.secure_messaging.controller;

import com.safechat.secure_messaging.model.AuditLog;
import com.safechat.secure_messaging.model.Message;
import com.safechat.secure_messaging.model.User;
import com.safechat.secure_messaging.model.UserRoles;
import com.safechat.secure_messaging.repository.AuditLogRepository;
import com.safechat.secure_messaging.repository.MessageRepository;
import com.safechat.secure_messaging.repository.UserRepository;
import com.safechat.secure_messaging.service.MessageExpirationService;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.time.LocalDateTime;
import java.util.*;

@RestController
@RequestMapping("/api/admin")
@PreAuthorize("hasRole('SUPPORT_ADMIN') or hasRole('SUPER_ADMIN')")
public class AdminController {
    private static final Logger logger = LoggerFactory.getLogger(AdminController.class);
    @Autowired
    private UserRepository userRepository;

    @Autowired
    private MessageRepository messageRepository;

    @Autowired
    private AuditLogRepository auditLogRepository;

    @Autowired
    private MessageExpirationService messageExpirationService;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @PersistenceContext
    private EntityManager entityManager;

    // User management DTOs
    public static class UserCreationRequest {
        private String username;
        private String email;
        private String password;
        private Set<String> roles;
        private boolean twoFactorEnabled;
        private String twoFactorMethod;
        private String phoneNumber;
        // Getters and setters
        public String getUsername() {
            return username;
        }

        public void setUsername(String username) {
            this.username = username;
        }

        public String getEmail() {
            return email;
        }

        public void setEmail(String email) {
            this.email = email;
        }

        public String getPassword() {
            return password;
        }

        public void setPassword(String password) {
            this.password = password;
        }

        public Set<String> getRoles() {
            return roles;
        }

        public void setRoles(Set<String> roles) {
            this.roles = roles;
        }

        public boolean isTwoFactorEnabled() {
            return twoFactorEnabled;
        }

        public void setTwoFactorEnabled(boolean twoFactorEnabled) {
            this.twoFactorEnabled = twoFactorEnabled;
        }

        public String getTwoFactorMethod() {
            return twoFactorMethod;
        }

        public void setTwoFactorMethod(String twoFactorMethod) {
            this.twoFactorMethod = twoFactorMethod;
        }

        public String getPhoneNumber() {
            return phoneNumber;
        }

        public void setPhoneNumber(String phoneNumber) {
            this.phoneNumber = phoneNumber;
        }
    }

    // User update DTO
    public static class UserUpdateRequest {
        private String email;
        private String password;
        private Set<String> roles;
        private boolean twoFactorEnabled;
        private String twoFactorMethod;
        private String phoneNumber;
        private boolean active;
        private boolean accountNonLocked;

        // Getters and setters
        public String getEmail() {
            return email;
        }

        public void setEmail(String email) {
            this.email = email;
        }

        public String getPassword() {
            return password;
        }

        public void setPassword(String password) {
            this.password = password;
        }

        public Set<String> getRoles() {
            return roles;
        }

        public void setRoles(Set<String> roles) {
            this.roles = roles;
        }

        public boolean isTwoFactorEnabled() {
            return twoFactorEnabled;
        }

        public void setTwoFactorEnabled(boolean twoFactorEnabled) {
            this.twoFactorEnabled = twoFactorEnabled;
        }

        public String getTwoFactorMethod() {
            return twoFactorMethod;
        }

        public void setTwoFactorMethod(String twoFactorMethod) {
            this.twoFactorMethod = twoFactorMethod;
        }

        public String getPhoneNumber() {
            return phoneNumber;
        }

        public void setPhoneNumber(String phoneNumber) {
            this.phoneNumber = phoneNumber;
        }

        public boolean isActive() {
            return active;
        }

        public void setActive(boolean active) {
            this.active = active;
        }

        public boolean isAccountNonLocked() {
            return accountNonLocked;
        }

        public void setAccountNonLocked(boolean accountNonLocked) {
            this.accountNonLocked = accountNonLocked;
        }
    }

    // Get current authenticated admin
    private User getCurrentAdmin() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        return userRepository.findByUsername(auth.getName())
                .orElseThrow(() -> new RuntimeException("Admin not found"));
    }

    // Get all users
    @GetMapping("/users")
    public ResponseEntity<?> getAllUsers() {
        try {
            List<User> users = userRepository.findAll();
            return ResponseEntity.ok(users);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Failed to retrieve users: " + e.getMessage()));
        }
    }

    // Get user by ID
    @GetMapping("/users/{userId}")
    public ResponseEntity<?> getUserById(@PathVariable UUID userId) {
        try {
            User user = userRepository.findById(userId)
                    .orElseThrow(() -> new RuntimeException("User not found"));
            return ResponseEntity.ok(user);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Failed to retrieve user: " + e.getMessage()));
        }
    }

    // Create new user
    @PostMapping("/users")
    public ResponseEntity<?> createUser(@RequestBody UserCreationRequest request) {
        try {
            // Check if username or email already exists
            if (userRepository.findByUsername(request.getUsername()).isPresent()) {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                        .body(Map.of("error", "Username already exists"));
            }
            if (userRepository.findByEmail(request.getEmail()).isPresent()) {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                        .body(Map.of("error", "Email already exists"));
            }

            // Create new user
            User newUser = new User();
            newUser.setUsername(request.getUsername());
            newUser.setEmail(request.getEmail());
            newUser.setPassword(passwordEncoder.encode(request.getPassword()));
            
            // Set roles
            Set<String> roles = request.getRoles();
            if (roles == null || roles.isEmpty()) {
                roles = new HashSet<>();
                roles.add("ROLE_USER");
            }
            newUser.setRoles(roles);

            // Set 2FA if enabled
            newUser.setTwoFactorEnabled(request.isTwoFactorEnabled());
            if (request.isTwoFactorEnabled()) {
                newUser.setTwoFactorMethod(request.getTwoFactorMethod());
                if ("SMS".equals(request.getTwoFactorMethod())) {
                    newUser.setPhoneNumber(request.getPhoneNumber());
                }
                // In a real app, you'd generate and store a 2FA secret here
                newUser.setTwoFactorSecret(UUID.randomUUID().toString());
            }

            // Save user
            User savedUser = userRepository.save(newUser);

            // Log the action
            AuditLog log = new AuditLog();
            log.setUser(getCurrentAdmin());
            log.setAction("USER_CREATED");
            log.setDetails("Admin created new user: " + request.getUsername());
            log.setTimestamp(LocalDateTime.now());
            auditLogRepository.save(log);

            return ResponseEntity.status(HttpStatus.CREATED).body(savedUser);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Failed to create user: " + e.getMessage()));
        }
    }

    // Update user
    @PutMapping("/users/{userId}")
    public ResponseEntity<?> updateUser(@PathVariable UUID userId, @RequestBody UserUpdateRequest request) {
        try {
            User user = userRepository.findById(userId)
                    .orElseThrow(() -> new RuntimeException("User not found"));

            // Update email if provided and not already in use
            if (request.getEmail() != null && !request.getEmail().equals(user.getEmail())) {
                if (userRepository.findByEmail(request.getEmail()).isPresent()) {
                    return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                            .body(Map.of("error", "Email already in use"));
                }
                user.setEmail(request.getEmail());
            }

            // Update password if provided
            if (request.getPassword() != null && !request.getPassword().isEmpty()) {
                user.setPassword(passwordEncoder.encode(request.getPassword()));
            }

            // Update roles if provided
            if (request.getRoles() != null && !request.getRoles().isEmpty()) {
                user.setRoles(request.getRoles());
            }

            // Update 2FA settings
            user.setTwoFactorEnabled(request.isTwoFactorEnabled());
            if (request.isTwoFactorEnabled()) {
                user.setTwoFactorMethod(request.getTwoFactorMethod());
                if ("SMS".equals(request.getTwoFactorMethod()) && request.getPhoneNumber() != null) {
                    user.setPhoneNumber(request.getPhoneNumber());
                }
            }

            // Update account status
            user.setActive(request.isActive());
            user.setAccountNonLocked(request.isAccountNonLocked());
            
            // If unlocking account, reset failed attempts
            if (request.isAccountNonLocked() && !user.isAccountNonLocked()) {
                user.setFailedAttempts(0);
                user.setLockTime(null);
            }

            // Save updated user
            User updatedUser = userRepository.save(user);

            // Log the action
            AuditLog log = new AuditLog();
            log.setUser(getCurrentAdmin());
            log.setAction("USER_UPDATED");
            log.setDetails("Admin updated user: " + user.getUsername());
            log.setTimestamp(LocalDateTime.now());
            auditLogRepository.save(log);

            return ResponseEntity.ok(updatedUser);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Failed to update user: " + e.getMessage()));
        }
    }

    @DeleteMapping("/users/{userId}")
    public ResponseEntity<?> deleteUser(@PathVariable UUID userId) {
        // Create a static final logger for the current class
    
        try {
            User user = userRepository.findById(userId)
                    .orElseThrow(() -> new RuntimeException("User not found"));
           
            // Get the current admin for authorization and audit log
            User currentAdmin = getCurrentAdmin();
           
            // Check if attempting to delete a super admin
            if (user.getRoles().contains(UserRoles.ROLE_SUPER_ADMIN)) {
                // Only another super admin can delete a super admin
                if (!currentAdmin.getRoles().contains(UserRoles.ROLE_SUPER_ADMIN)) {
                    return ResponseEntity.status(HttpStatus.FORBIDDEN)
                            .body(Map.of("error", "Cannot delete a super admin user"));
                }
            }
           
            // Store username for audit log
            String username = user.getUsername();
           
            // Handle all dependencies in order
            // 1. Delete messages related to this user
            messageRepository.deleteByReceiverIdOrSenderIdOrRevokedBy(userId, userId, user);
           
            // 2. Delete audit logs for this user (modify based on your actual audit log repository)
            auditLogRepository.deleteById(userId);
           
            // 3. Remove user roles
            user.getRoles().clear();
            userRepository.save(user);
           
            // 4. Finally delete the user
            userRepository.delete(user);
           
            // Create a new audit log entry for the deletion
            AuditLog log = new AuditLog();
            log.setUser(currentAdmin);
            log.setAction("USER_DELETED");
            log.setDetails("Admin deleted user: " + username);
            log.setTimestamp(LocalDateTime.now());
            auditLogRepository.save(log);
           
            return ResponseEntity.ok(Map.of(
                    "deleted", true,
                    "userId", userId
            ));
        } catch (Exception e) {
            // Proper logging using SLF4J
            logger.error("Failed to delete user", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Failed to delete user", "details", e.getMessage()));
        }
    }

    // Message moderation DTO
    public static class MessageModerationRequest {
        private String reason;

        public String getReason() {
            return reason;
        }

        public void setReason(String reason) {
            this.reason = reason;
        }
    }

    // Get all messages (with pagination)
    @GetMapping("/messages")
    public ResponseEntity<?> getAllMessages(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        try {
            // In a real app, you'd implement proper pagination with PageRequest
            List<Message> messages = messageRepository.findAll();
            
            // Simple pagination
            int startIndex = page * size;
            int endIndex = Math.min(startIndex + size, messages.size());
            
            if (startIndex >= messages.size()) {
                return ResponseEntity.ok(new ArrayList<>());
            }
            
            List<Message> pagedMessages = messages.subList(startIndex, endIndex);
            
            return ResponseEntity.ok(Map.of(
                    "messages", pagedMessages,
                    "totalCount", messages.size(),
                    "page", page,
                    "size", size
            ));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Failed to retrieve messages: " + e.getMessage()));
        }
    }

    // Revoke/moderate a message
    @PostMapping("/messages/{messageId}/revoke")
    public ResponseEntity<?> revokeMessage(
            @PathVariable UUID messageId, 
            @RequestBody MessageModerationRequest request) {
        try {
            Message message = messageRepository.findById(messageId)
                    .orElseThrow(() -> new RuntimeException("Message not found"));
            
            User admin = getCurrentAdmin();
            
            // Revoke the message
            messageExpirationService.revokeMessage(messageId, admin.getId(), request.getReason());
            
            return ResponseEntity.ok(Map.of(
                    "revoked", true,
                    "messageId", messageId,
                    "reason", request.getReason()
            ));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Failed to revoke message: " + e.getMessage()));
        }
    }

    // Get audit logs (with filtering)
    @GetMapping("/audit-logs")
    public ResponseEntity<?> getAuditLogs(
            @RequestParam(required = false) String action,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime endDate,
            @RequestParam(required = false) String role) {
        try {
            List<AuditLog> logs;
            
            // Apply filters
            if (role != null && startDate != null && endDate != null) {
                logs = auditLogRepository.findLogsByUserRoleAndDateRange(role, startDate, endDate);
            } else if (startDate != null && endDate != null) {
                logs = auditLogRepository.findByTimestampBetweenOrderByTimestampDesc(startDate, endDate);
            } else {
                logs = auditLogRepository.findAll();
                logs.sort(Comparator.comparing(AuditLog::getTimestamp).reversed());
            }
            
            // Filter by action if provided
            if (action != null && !action.isEmpty()) {
                logs = logs.stream()
                    .filter(log -> action.equals(log.getAction()))
                    .toList();
            }
            
            return ResponseEntity.ok(logs);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Failed to retrieve audit logs: " + e.getMessage()));
        }
    }

    // System stats
    @GetMapping("/stats")
    public ResponseEntity<?> getSystemStats() {
        try {
            long totalUsers = userRepository.count();
            long totalMessages = messageRepository.count();
            long totalLogs = auditLogRepository.count();
            
            // Get active users in last 24 hours (placeholder - you'd implement this with a custom query)
            long activeUsers = 0;
            
            Map<String, Object> stats = new HashMap<>();
            stats.put("totalUsers", totalUsers);
            stats.put("totalMessages", totalMessages);
            stats.put("totalAuditLogs", totalLogs);
            stats.put("activeUsers24h", activeUsers);
            stats.put("serverTime", LocalDateTime.now());
            
            return ResponseEntity.ok(stats);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Failed to retrieve system stats: " + e.getMessage()));
        }
    }

    @PostMapping("/toggle-admin/{userId}")
    public ResponseEntity<?> toggleAdminRole(@PathVariable UUID userId) {
        try {
            // Get the current admin user
            User currentAdmin = getCurrentAdmin();
           
            // Only super admins can toggle admin status
            if (!currentAdmin.getRoles().contains(UserRoles.ROLE_SUPER_ADMIN)) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("error", "Only super admins can modify admin roles"));
            }
           
            // Find the target user
            User user = userRepository.findById(userId)
                    .orElseThrow(() -> new RuntimeException("User not found"));
           
            // Cannot modify super admin roles
            if (user.getRoles().contains(UserRoles.ROLE_SUPER_ADMIN)) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("error", "Cannot modify super admin roles"));
            }
           
            // Create a completely new HashSet for roles
            Set<String> updatedRoles = new HashSet<>(user.getRoles());
           
            // Toggle the admin role
            boolean willBeAdmin = !updatedRoles.contains(UserRoles.ROLE_SUPPORT_ADMIN);
            if (willBeAdmin) {
                updatedRoles.add(UserRoles.ROLE_SUPPORT_ADMIN);
            } else {
                updatedRoles.remove(UserRoles.ROLE_SUPPORT_ADMIN);
            }
           
            // Set the new roles collection
            user.setRoles(updatedRoles);
            
            // Explicitly flush to the database
            userRepository.saveAndFlush(user);
            
            // Clear the persistence context to refresh the entity state
            entityManager.clear();
           
            // Log the action
            AuditLog log = new AuditLog();
            log.setUser(currentAdmin);
            log.setAction(willBeAdmin ? "ADMIN_ROLE_GRANTED" : "ADMIN_ROLE_REMOVED");
            log.setDetails("Modified roles for user: " + user.getUsername());
            log.setTimestamp(LocalDateTime.now());
            auditLogRepository.save(log);
           
            // Fetch the freshly updated user from the database to confirm changes
            User updatedUser = userRepository.findById(userId).orElseThrow();
           
            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "userId", userId.toString(),
                    "isAdmin", updatedUser.getRoles().contains(UserRoles.ROLE_SUPPORT_ADMIN),
                    "roles", updatedUser.getRoles()
            ));
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Failed to toggle admin role: " + e.getMessage()));
        }
    }
}
