package com.safechat.secure_messaging.dto;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.util.Set;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class AuthResponse {
    private String token;
    private String username;
    private Set<String> roles;
    private boolean twoFactorEnabled;
    
    // Add a constructor that matches your current one for backward compatibility
    public AuthResponse(String token, String username, Set<String> roles) {
        this.token = token;
        this.username = username;
        this.roles = roles;
        this.twoFactorEnabled = false;
    }
}