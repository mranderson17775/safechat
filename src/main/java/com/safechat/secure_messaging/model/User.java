// User.java
package com.safechat.secure_messaging.model;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import jakarta.persistence.*;

@Entity
@Table(name = "APP_USER")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class User {
   
    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)  // Changed to AUTO for UUID
    private UUID id;
   
    @Column(nullable = false, unique = true)
    private String username;
   
    @Column(nullable = false, unique = true)
    private String email;
   
    @Column(nullable = false)
    private String password;
   
    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "USER_ROLES", joinColumns = {@JoinColumn(name = "user_id")})
    @Column(name = "role")
    private Set<String> roles = new HashSet<>();
       @OneToMany(mappedBy = "sender", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<Message> sentMessages = new ArrayList<>();

    @OneToMany(mappedBy = "receiver", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<Message> receivedMessages = new ArrayList<>();

    @OneToMany(mappedBy = "user", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<AuditLog> auditLogs = new ArrayList<>();
    
    // 2FA fields
    private boolean twoFactorEnabled = false;
    private String twoFactorSecret;
    private String twoFactorMethod; // "EMAIL" or "SMS"
    private String phoneNumber; // For SMS 2FA
   
    // Admin-related fields
    private String adminInvitationToken; // For admin invitation process
    private LocalDateTime tokenExpirationDate;
   
    private LocalDateTime lastLogin;
   
    private boolean active = true;
   
    private boolean accountNonLocked = true;
   
    private int failedAttempts = 0;
   
    private LocalDateTime lockTime;
}