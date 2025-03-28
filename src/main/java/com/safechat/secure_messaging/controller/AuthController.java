package com.safechat.secure_messaging.controller;

import com.safechat.secure_messaging.dto.AuthResponse;
import com.safechat.secure_messaging.dto.LoginRequest;
import com.safechat.secure_messaging.dto.TwoFactorRequest;
import com.safechat.secure_messaging.model.User;
import com.safechat.secure_messaging.repository.UserRepository;
import com.safechat.secure_messaging.security.JwtUtils;
import com.safechat.secure_messaging.service.AuditLogService;
import com.safechat.secure_messaging.service.TwoFactorAuthService;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@RestController
@RequestMapping("/auth")
public class AuthController {
    private static final Logger logger = LoggerFactory.getLogger(AuthController.class);
    private final AuthenticationManager authenticationManager;
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtils jwtUtils;

    @Autowired
    private TwoFactorAuthService twoFactorAuthService;

    @Autowired
    private AuditLogService auditLogService;

    @Autowired
    private UserDetailsService userDetailsService;

    public AuthController(AuthenticationManager authenticationManager, UserRepository userRepository, PasswordEncoder passwordEncoder, JwtUtils jwtUtils) {
        
        this.authenticationManager = authenticationManager;
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtUtils = jwtUtils;
    }

    @PostMapping("/register")
    public ResponseEntity<?> registerUser(@RequestBody User user) {
        if (userRepository.existsByUsername(user.getUsername()) || userRepository.existsByEmail(user.getEmail())) {
            return ResponseEntity.badRequest().body("Username or email already exists");
        }
        
        // Encode password
        user.setPassword(passwordEncoder.encode(user.getPassword()));
        
        // Set default roles if needed
        Set<String> roles = new HashSet<>();
        roles.add("ROLE_USER");
        user.setRoles(roles);
        
        // Save user
        userRepository.save(user);
        
        // Log the registration
        auditLogService.logEvent(user.getUsername(), "USER_REGISTERED", 
                                 "User registered" + (user.isTwoFactorEnabled() ? " with 2FA enabled" : ""));
        
        // For users who enabled 2FA, generate a temporary token to allow them to set up 2FA
        if (user.isTwoFactorEnabled()) {
            // Generate a temporary JWT for 2FA setup
            UserDetails userDetails = userDetailsService.loadUserByUsername(user.getUsername());
            String setupToken = jwtUtils.generateToken(userDetails);
            
            Map<String, Object> response = new HashMap<>();
            response.put("message", "User registered successfully. 2FA setup required.");
            response.put("setupToken", setupToken);
            response.put("username", user.getUsername());
            
            return ResponseEntity.ok(response);
        }
        
        return ResponseEntity.ok("User registered successfully");
    }

    @PostMapping("/2fa/setup")
    public ResponseEntity setupTwoFactor(@RequestBody TwoFactorRequest request, @RequestHeader("Authorization") String token) {
        String username = jwtUtils.extractUsername(token.substring(7));
        
        User user = userRepository.findByUsername(username)
            .orElseThrow(() -> new UsernameNotFoundException("User not found"));
        
        // Only generate a new secret if one doesn't exist
        if (user.getTwoFactorSecret() == null) {
            String secret = twoFactorAuthService.generateSecret();
            user.setTwoFactorSecret(secret);
            userRepository.save(user);
        }
        
        // Always generate QR code with the STORED secret
        String qrCodeImage = twoFactorAuthService.generateQrCodeImageUri(user.getTwoFactorSecret(), username);
        
        return ResponseEntity.ok(Map.of(
            "secret", user.getTwoFactorSecret(), 
            "qrCodeImage", qrCodeImage
        ));
    }

    @PostMapping("/login")
    public ResponseEntity<?> authenticateUser(@RequestBody LoginRequest loginRequest) {
        logger.debug("Attempting login for user: {}", loginRequest.getUsername());

        try {
            Authentication authentication = authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(
                    loginRequest.getUsername(), loginRequest.getPassword()
                )
            );

            User user = userRepository.findByUsername(loginRequest.getUsername()).orElseThrow(() -> new UsernameNotFoundException("User not found"));

            if (user.isTwoFactorEnabled()) {
                if ("EMAIL".equals(user.getTwoFactorMethod())) {
                    logger.debug("2FA is enabled for user: {}. Sending email code.", user.getUsername());
                    boolean sent = twoFactorAuthService.sendEmailCode(user);
                    if (!sent) {
                        logger.error("Failed to send 2FA email code for user: {}", user.getUsername());
                    }
                }

                Map<String, Object> response = new HashMap<>();
                response.put("requires2FA", true);
                response.put("method", user.getTwoFactorMethod());
                response.put("username", user.getUsername());
                response.put("availableMethods", new String[]{"EMAIL", "TOTP"});
                response.put("defaultMethod", user.getTwoFactorMethod()); 

                auditLogService.logEvent(user.getUsername(), "LOGIN_2FA_REQUIRED", "Login attempt - 2FA required");

                return ResponseEntity.ok(response);
            }

            SecurityContextHolder.getContext().setAuthentication(authentication);
            String jwt = jwtUtils.generateToken((UserDetails) authentication.getPrincipal());

            user.setLastLogin(LocalDateTime.now());
            userRepository.save(user);

            auditLogService.logEvent(user.getUsername(), "LOGIN_SUCCESS", "User logged in successfully");
            logger.debug("User {} logged in successfully. Token generated.", user.getUsername());

            return ResponseEntity.ok(new AuthResponse(jwt, user.getUsername(), user.getRoles()));
        } catch (BadCredentialsException e) {
            auditLogService.logEvent(loginRequest.getUsername(), "LOGIN_FAILED", "Failed login attempt");
            logger.error("Login failed for user: {}", loginRequest.getUsername());
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Invalid username or password");
        }
    }

    @PostMapping("/2fa/verify")
    public ResponseEntity<?> verifyTwoFactor(@RequestBody TwoFactorRequest request) {
        String username = request.getUsername();
        String requestedMethod = request.getMethod(); // Get the method from the request
       
        logger.debug("2FA verification attempt for user: {}, code length: {}, method: {}",
                    username,
                    request.getCode() != null ? request.getCode().length() : 0,
                    requestedMethod);
       
        User user = userRepository.findByUsername(username)
            .orElseThrow(() -> new UsernameNotFoundException("User not found"));
       
        // Check if 2FA secret exists (needed for both setup and verification)
        if (user.getTwoFactorSecret() == null) {
            logger.error("2FA verification failed - No 2FA secret for user: {}", username);
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body("Two-factor authentication not properly set up");
        }
       
        // Validate that the requested method is supported and configured for this user
        // This allows a user to use any of their configured methods
        if (requestedMethod == null || 
            (!requestedMethod.equals("TOTP") && !requestedMethod.equals("EMAIL"))) {
            logger.error("Invalid 2FA method requested: {}", requestedMethod);
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body("Invalid 2FA method");
        }
       
        boolean isValid = false;
        try {
            if ("TOTP".equals(requestedMethod)) {
                isValid = twoFactorAuthService.verifyCode(user.getTwoFactorSecret(), request.getCode());
                logger.debug("TOTP verification result for user {}: {}", username, isValid);
            } else if ("EMAIL".equals(requestedMethod)) {
                isValid = twoFactorAuthService.verifyEmailCode(user.getEmail(), request.getCode());
                logger.debug("EMAIL verification result for user {}: {}", username, isValid);
            }
        } catch (Exception e) {
            logger.error("Error during 2FA verification for user: {}", username, e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body("Error during verification: " + e.getMessage());
        }
    
        if (isValid) {
            // If this is first successful verification, save the method as user's preference
            if (!user.isTwoFactorEnabled() || user.getTwoFactorMethod() == null) {
                user.setTwoFactorMethod(requestedMethod);
                user.setTwoFactorEnabled(true);
                logger.info("2FA has been enabled for user: {} with method: {}", username, requestedMethod);
            }
           
            UserDetails userDetails = userDetailsService.loadUserByUsername(username);
            Authentication authentication = new UsernamePasswordAuthenticationToken(
                    username, null, userDetails.getAuthorities());
            SecurityContextHolder.getContext().setAuthentication(authentication);
            String jwt = jwtUtils.generateToken(userDetails);
    
            user.setLastLogin(LocalDateTime.now());
            userRepository.save(user);
    
            auditLogService.logEvent(username, "2FA_VERIFIED", "Two-factor authentication verified");
            logger.info("2FA verification successful for user: {}", username);
    
            return ResponseEntity.ok(new AuthResponse(jwt, user.getUsername(), user.getRoles()));
        } else {
            auditLogService.logEvent(username, "2FA_VERIFICATION_FAILED", "2FA verification failed");
            logger.warn("2FA verification failed for user: {}", username);
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Invalid 2FA code");
        }
    }

    @PostMapping("/2fa/disable")
    public ResponseEntity<?> disableTwoFactor(@RequestBody TwoFactorRequest request, @RequestHeader("Authorization") String token) {
        try {
            // Extract username from token
            String username = jwtUtils.extractUsername(token.substring(7));
            logger.debug("2FA disable request for user: {}", username);
            
            // Verify the username matches the request
            if (!username.equals(request.getUsername())) {
                logger.warn("Username mismatch in 2FA disable request: token username {} vs request username {}", 
                          username, request.getUsername());
                return ResponseEntity.status(HttpStatus.BAD_REQUEST).body("Username mismatch");
            }
            
            // Find the user
            User user = userRepository.findByUsername(username)
                    .orElseThrow(() -> new UsernameNotFoundException("User not found"));
            
            // Disable 2FA
            user.setTwoFactorEnabled(false);
            user.setTwoFactorSecret(null);  // Clear the secret
            user.setTwoFactorMethod(null);  // Clear the method
            
            // Save the updated user
            userRepository.save(user);
            
            // Log the event
            auditLogService.logEvent(username, "2FA_DISABLED", "Two-factor authentication disabled by user");
            logger.info("2FA disabled for user: {}", username);
            
            Map<String, Object> response = new HashMap<>();
            response.put("message", "Two-factor authentication has been disabled");
            
            return ResponseEntity.ok(response);
        } catch (UsernameNotFoundException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body("User not found");
        } catch (Exception e) {
            logger.error("Error disabling 2FA", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body("Error disabling two-factor authentication: " + e.getMessage());
        }
    }

    
    @PostMapping("/resend")
    public ResponseEntity<?> resendVerificationCode(@RequestBody TwoFactorRequest request) {
        try {
            String username = request.getUsername();
            String requestedMethod = request.getMethod();
            
            User user = userRepository.findByUsername(username)
                    .orElseThrow(() -> new UsernameNotFoundException("User not found"));
            
            // Verify user has 2FA set up and has a secret
            if (user.getTwoFactorSecret() == null) {
                return ResponseEntity.badRequest().body("2FA not set up for this user");
            }
            
            // Check if requested method is supported for resending
            if (!"EMAIL".equals(requestedMethod)) {
                return ResponseEntity.badRequest().body("Only email verification codes can be resent");
            }
            
            // Temporarily set the user's method to EMAIL for this verification
            String originalMethod = user.getTwoFactorMethod();
            user.setTwoFactorMethod("EMAIL");
            
            try {
                // Send the email code
                boolean sent = twoFactorAuthService.sendEmailCode(user);
                
                // Reset the user's method to the original value
                user.setTwoFactorMethod(originalMethod);
                userRepository.save(user);
                
                if (sent) {
                    auditLogService.logEvent(username, "2FA_CODE_RESENT", "Verification code resent to user's email");
                    
                    Map<String, Object> response = new HashMap<>();
                    response.put("message", "Verification code resent successfully");
                    response.put("method", "EMAIL");
                    
                    return ResponseEntity.ok(response);
                } else {
                    return ResponseEntity.internalServerError().body("Failed to send verification code");
                }
            } catch (Exception e) {
                // Make sure to reset the method even if there's an error
                user.setTwoFactorMethod(originalMethod);
                userRepository.save(user);
                throw e;
            }
            
        } catch (RuntimeException e) {
            // This will catch the cooldown exception and return a 429 Too Many Requests status
            if (e.getMessage().contains("Please wait")) {
                return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS).body(e.getMessage());
            }
            // Otherwise, propagate the exception
            throw e;
        } catch (Exception e) {
            logger.error("Error resending verification code", e);
            return ResponseEntity.internalServerError().body("Error resending verification code: " + e.getMessage());
        }
    }
    


    
}
