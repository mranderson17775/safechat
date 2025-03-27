// Create a new file: AdminService.java
package com.safechat.secure_messaging.service;

import com.safechat.secure_messaging.model.User;
import com.safechat.secure_messaging.model.UserRoles;
import com.safechat.secure_messaging.repository.MessageRepository;
import com.safechat.secure_messaging.repository.UserRepository;

import org.springframework.transaction.annotation.Transactional;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.Base64;
import java.util.HashSet;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

@Service
public class AdminService {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private MessageRepository messageRepository;
    
    @Autowired
    private PasswordEncoder passwordEncoder;
    
    @Autowired
    private EmailService emailService;
    
    // Generate invitation token for new admin
    public String generateInvitationToken() {
        SecureRandom random = new SecureRandom();
        byte[] bytes = new byte[32];
        random.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }
    
    // Create invitation for a new admin
    public void createAdminInvitation(String email, Set<String> roles, String invitedBy) {
        // Check if user already exists
        if (userRepository.findByEmail(email).isPresent()) {
            throw new RuntimeException("User with this email already exists");
        }
        
        // Create temporary user with invitation token
        User user = new User();
        user.setEmail(email);
        user.setUsername(email); // Temporary username
        user.setPassword(passwordEncoder.encode(generateRandomPassword()));
        user.setRoles(roles);
        user.setActive(false); // Not active until they complete registration
        user.setAdminInvitationToken(generateInvitationToken());
        user.setTokenExpirationDate(LocalDateTime.now().plusDays(7)); // Token valid for 7 days
        
        userRepository.save(user);
        
        // Send invitation email
        String subject = "Invitation to join SafeChat as Admin";
        String invitationUrl = "https://yourdomain.com/admin/accept-invitation?token=" + 
                             user.getAdminInvitationToken();
        
        String body = "You've been invited to join SafeChat as an administrator by " + invitedBy + ".\n\n" +
                    "Please click the link below to set up your account:\n" +
                    invitationUrl + "\n\n" +
                    "This invitation will expire in 7 days.";
                    
        emailService.sendEmail(email, subject, body);
    }
    
    // Validate invitation token and complete admin registration
    public boolean completeAdminRegistration(String token, String username, String password) {
        Optional<User> userOpt = userRepository.findByAdminInvitationToken(token);
        
        if (userOpt.isEmpty()) {
            return false;
        }
        
        User user = userOpt.get();
        
        // Check if token is expired
        if (user.getTokenExpirationDate().isBefore(LocalDateTime.now())) {
            return false;
        }
        
        // Update user details
        user.setUsername(username);
        user.setPassword(passwordEncoder.encode(password));
        user.setActive(true);
        user.setAdminInvitationToken(null);
        user.setTokenExpirationDate(null);
        
        userRepository.save(user);
        return true;
    }
    
    // Helper method to generate a random password
    private String generateRandomPassword() {
        SecureRandom random = new SecureRandom();
        byte[] bytes = new byte[16];
        random.nextBytes(bytes);
        return Base64.getEncoder().encodeToString(bytes);
    }
    
    // Create a super admin (first admin)
    public User createSuperAdmin(String username, String email, String password) {
        // Check if any super admin already exists
        if (userRepository.findByRoles(UserRoles.ROLE_SUPER_ADMIN).size() > 0) {
            throw new RuntimeException("Super Admin already exists");
        }
        
        User superAdmin = new User();
        superAdmin.setUsername(username);
        superAdmin.setEmail(email);
        superAdmin.setPassword(passwordEncoder.encode(password));
        
        Set<String> roles = new HashSet<>();
        roles.add(UserRoles.ROLE_USER);
        roles.add(UserRoles.ROLE_SUPER_ADMIN);
        superAdmin.setRoles(roles);
        
        return userRepository.save(superAdmin);
    }
    @Transactional  // This ensures all delete operations happen inside a transaction
    public void deleteUser(UUID userId) {
        User user = userRepository.findById(userId)
            .orElseThrow(() -> new RuntimeException("User not found"));

        // Delete all messages where the user is involved
        messageRepository.deleteByReceiverIdOrSenderIdOrRevokedBy(userId, userId, user);

        // Delete the user
        userRepository.deleteById(userId);
    }


}