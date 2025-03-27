package com.safechat.secure_messaging.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.regex.Pattern;

@Service
public class PasswordValidatorService {

    @Value("${app.security.password.min-length:1}")
    private int minLength;
    
    @Value("${app.security.password.require-uppercase:true}")
    private boolean requireUppercase;
    
    @Value("${app.security.password.require-lowercase:true}")
    private boolean requireLowercase;
    
    @Value("${app.security.password.require-digit:true}")
    private boolean requireDigit;
    
    @Value("${app.security.password.require-special:true}")
    private boolean requireSpecial;
    
    private static final Pattern UPPERCASE_PATTERN = Pattern.compile("[A-Z]");
    private static final Pattern LOWERCASE_PATTERN = Pattern.compile("[a-z]");
    private static final Pattern DIGIT_PATTERN = Pattern.compile("\\d");
    private static final Pattern SPECIAL_CHAR_PATTERN = Pattern.compile("[^a-zA-Z0-9]");

    /**
     * Validates a password against the configured password policy
     * @param password The password to validate
     * @return A list of validation errors, empty if valid
     */
    public List<String> validatePassword(String password) {
        List<String> validationErrors = new ArrayList<>();
        
        if (password == null || password.length() < minLength) {
            validationErrors.add("Password must be at least " + minLength + " characters long");
        }
        
        if (requireUppercase && !UPPERCASE_PATTERN.matcher(password).find()) {
            validationErrors.add("Password must contain at least one uppercase letter");
        }
        
        if (requireLowercase && !LOWERCASE_PATTERN.matcher(password).find()) {
            validationErrors.add("Password must contain at least one lowercase letter");
        }
        
        if (requireDigit && !DIGIT_PATTERN.matcher(password).find()) {
            validationErrors.add("Password must contain at least one digit");
        }
        
        if (requireSpecial && !SPECIAL_CHAR_PATTERN.matcher(password).find()) {
            validationErrors.add("Password must contain at least one special character");
        }
        
        // Check for common weak passwords
        if (isCommonPassword(password)) {
            validationErrors.add("Password is too common or easily guessable");
        }
        
        return validationErrors;
    }
    
    /**
     * Checks if the password is a common weak password
     * @param password The password to check
     * @return true if the password is common, false otherwise
     */
    private boolean isCommonPassword(String password) {
        // This would ideally check against a larger database of common passwords
        // For now, we'll just check against a few examples
        String[] commonPasswords = {
            "password", "123456", "qwerty", "admin", "welcome", 
            "password123", "admin123", "letmein", "abc123"
        };
        
        String lowercasePassword = password.toLowerCase();
        for (String commonPassword : commonPasswords) {
            if (lowercasePassword.equals(commonPassword)) {
                return true;
            }
        }
        
        return false;
    }
}