package com.safechat.secure_messaging.service;

import com.safechat.secure_messaging.model.User;
import com.safechat.secure_messaging.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

@Component
public class SuperAdminInitializer implements CommandLineRunner {
    @Autowired
    private AdminService adminService;
    
    @Autowired
    private UserRepository userRepository;
    
    @Autowired
    private TwoFactorAuthService twoFactorAuthService;
   
    @Value("${setup.mode:false}")
    private boolean setupMode;
   
    @Value("${setup.admin.username:}")
    private String adminUsername;
   
    @Value("${setup.admin.email:}")
    private String adminEmail;
   
    @Value("${setup.admin.password:}")
    private String adminPassword;
   
    @Override
    public void run(String... args) throws Exception {
        if (setupMode && !adminUsername.isEmpty() && !adminEmail.isEmpty() && !adminPassword.isEmpty()) {
            try {
                // Create the super admin using your existing service
                User superAdmin = adminService.createSuperAdmin(adminUsername, adminEmail, adminPassword);
                
                // Enable 2FA automatically without requiring setup
                String secret = twoFactorAuthService.generateSecret();
                superAdmin.setTwoFactorSecret(secret);
                superAdmin.setTwoFactorMethod("TOTP"); // Default to TOTP
                superAdmin.setTwoFactorEnabled(true);
                userRepository.save(superAdmin);
                
                System.out.println("Super admin created successfully: " + superAdmin.getUsername());
                System.out.println("Two-factor authentication has been automatically enabled");
                System.out.println("Initial setup complete. You can now disable setup mode.");
            } catch (Exception e) {
                System.err.println("Failed to create super admin: " + e.getMessage());
            }
        }
    }
}