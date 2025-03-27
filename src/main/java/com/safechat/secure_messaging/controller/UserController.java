package com.safechat.secure_messaging.controller;

import com.safechat.secure_messaging.model.User;
import com.safechat.secure_messaging.repository.UserRepository;
import com.safechat.secure_messaging.service.TwoFactorAuthService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/user")
public class UserController {
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final TwoFactorAuthService twoFactorAuthService;

    @Autowired
    public UserController(UserRepository userRepository, 
                         PasswordEncoder passwordEncoder,
                         TwoFactorAuthService twoFactorAuthService) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.twoFactorAuthService = twoFactorAuthService;
    }

    @GetMapping("/profile")
    public ResponseEntity<?> getProfile(Principal principal) {
        Optional<User> user = userRepository.findByUsername(principal.getName());
        if (user.isPresent()) {
            User userObj = user.get();
            Map<String, Object> userProfile = new HashMap<>();
            userProfile.put("id", userObj.getId().toString());  // Convert UUID to string
            userProfile.put("username", userObj.getUsername());
            userProfile.put("email", userObj.getEmail());
            userProfile.put("roles", userObj.getRoles());       // Pass the entire set of roles
            userProfile.put("twoFactorEnabled", userObj.isTwoFactorEnabled());
            userProfile.put("twoFactorMethod", userObj.getTwoFactorMethod());
            userProfile.put("phoneNumber", userObj.getPhoneNumber());
            
            return ResponseEntity.ok(userProfile);
        }
        return ResponseEntity.notFound().build();
    }

    @PutMapping("/profile")
    public ResponseEntity<?> updateProfile(Principal principal, @RequestBody Map<String, String> profileData) {
        Optional<User> user = userRepository.findByUsername(principal.getName());
        if (user.isPresent()) {
            User existingUser = user.get();
            
            // Check if username is being changed and if it's already taken
            String newUsername = profileData.get("username");
            if (!existingUser.getUsername().equals(newUsername) && 
                userRepository.findByUsername(newUsername).isPresent()) {
                return ResponseEntity.badRequest().body(Map.of("message", "Username already taken"));
            }
            
            // Check if email is being changed and if it's already taken
            String newEmail = profileData.get("email");
            if (!existingUser.getEmail().equals(newEmail) && 
                userRepository.findByEmail(newEmail).isPresent()) {
                return ResponseEntity.badRequest().body(Map.of("message", "Email already in use"));
            }
            
            existingUser.setEmail(newEmail);
            existingUser.setUsername(newUsername);
            userRepository.save(existingUser);
            
            return ResponseEntity.ok(Map.of("message", "Profile updated successfully"));
        }
        return ResponseEntity.notFound().build();
    }
    
    
    @GetMapping("/all")
    public ResponseEntity<?> getAllUsers(Principal principal) {
        String currentUsername = principal.getName();
        List<User> allUsers = userRepository.findAll();
       
        List<Map<String, Object>> userProfiles = allUsers.stream()
            .filter(user -> !user.getUsername().equals(currentUsername)) // Filter out current user
            .map(user -> {
                Map<String, Object> profile = new HashMap<>();
                profile.put("id", user.getId().toString());
                profile.put("username", user.getUsername());
                profile.put("email", user.getEmail()); // Add email
                profile.put("roles", user.getRoles()); // Add roles
                profile.put("isOnline", true); // You'll need a way to track this
                // Add avatar if you have it in your User model
                return profile;
            })
            .collect(Collectors.toList());
       
        return ResponseEntity.ok(userProfiles);
    }


    @PutMapping("/password")
    public ResponseEntity<?> changePassword(Principal principal, @RequestBody Map<String, String> passwordData) {
        Optional<User> user = userRepository.findByUsername(principal.getName());
        if (user.isPresent()) {
            User existingUser = user.get();
            
            if (!passwordEncoder.matches(passwordData.get("currentPassword"), existingUser.getPassword())) {
                return ResponseEntity.badRequest().body(Map.of("message", "Current password is incorrect or Changed"));
            }
            
            existingUser.setPassword(passwordEncoder.encode(passwordData.get("newPassword")));
            userRepository.save(existingUser);
            
            return ResponseEntity.ok(Map.of("message", "Password changed successfully"));
        }
        return ResponseEntity.notFound().build();
    }

    @PostMapping("/2fa/disable")
    public ResponseEntity<?> disableTwoFactorAuth(Principal principal) {
        Optional<User> user = userRepository.findByUsername(principal.getName());
        if (user.isPresent()) {
            User existingUser = user.get();
            
            if (!existingUser.isTwoFactorEnabled()) {
                return ResponseEntity.badRequest().body(Map.of("message", "Two-factor authentication is not enabled"));
            }
            
            existingUser.setTwoFactorEnabled(false);
            existingUser.setTwoFactorSecret(null);
            existingUser.setTwoFactorMethod(null);
            userRepository.save(existingUser);
            
            return ResponseEntity.ok(Map.of("message", "Two-factor authentication disabled successfully"));
        }
        return ResponseEntity.notFound().build();
    }
}