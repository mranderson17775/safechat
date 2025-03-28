package com.safechat.secure_messaging.service;

import com.safechat.secure_messaging.model.KeyEntity;
import com.safechat.secure_messaging.repository.KeyRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

@Service
public class EncryptionService {
    private final KeyRepository keyRepository;
    private final SecretKey masterKey;
    
    public EncryptionService(
        KeyRepository keyRepository, 
        @Value("${ENCRYPTION_KEY}") String masterKeyStr
    ) {
        this.keyRepository = keyRepository;
        
        try {
            // More comprehensive key validation
            if (masterKeyStr == null || masterKeyStr.trim().isEmpty()) {
                throw new IllegalArgumentException("ENCRYPTION_KEY must be a non-empty Base64 encoded 256-bit AES key");
            }
            
            byte[] keyBytes = Base64.getDecoder().decode(masterKeyStr);
            
            // Additional key length validation
            if (keyBytes.length != 32) {  // 256 bits = 32 bytes
                throw new IllegalArgumentException("Invalid key length. Must be 256 bits (32 bytes)");
            }
            
            this.masterKey = new SecretKeySpec(keyBytes, "AES");
        } catch (IllegalArgumentException e) {
            // Log the specific error
            System.err.println("Master Key Initialization Error: " + e.getMessage());
            throw new RuntimeException("Failed to initialize master encryption key", e);
        }
    }
    
    // Generate a new AES-256 key
    public String generateKey() {
        try {
            KeyGenerator keyGen = KeyGenerator.getInstance("AES");
            keyGen.init(256);
            SecretKey key = keyGen.generateKey();
            
            // Store key with a unique ID
            String keyId = UUID.randomUUID().toString();
            
            // Store encoded key in database
            String encodedKey = Base64.getEncoder().encodeToString(key.getEncoded());
            keyRepository.save(new KeyEntity(keyId, encodedKey));
            
            // Also cache the key in memory
            keyCache.put(keyId, key);
            
            return keyId;
        } catch (Exception e) {
            throw new RuntimeException("Error generating encryption key", e);
        }
    }
    
    // Get a key by ID, looking first in cache then in database
    private SecretKey getKeyById(String keyId) {
        // Check cache first
        SecretKey cachedKey = keyCache.get(keyId);
        if (cachedKey != null) {
            return cachedKey;
        }
        
        // If not in cache, look in database
        KeyEntity keyEntity = keyRepository.findByKeyIdAndActiveTrue(keyId)
                .orElseThrow(() -> new RuntimeException("Key not found with ID: " + keyId));
        
        // Convert stored key back to SecretKey
        byte[] keyBytes = Base64.getDecoder().decode(keyEntity.getKeyMaterial());
        SecretKey key = new SecretKeySpec(keyBytes, "AES");
        
        // Add to cache for future use
        keyCache.put(keyId, key);
        
        return key;
    }
    
    // Encrypt a message using a key from the keystore
    public Map<String, String> encrypt(String plaintext, String keyId) {
        try {
            // Get key from store or use master key if keyId is null
            SecretKey key;
            if (keyId != null) {
                try {
                    key = getKeyById(keyId);
                } catch (RuntimeException e) {
                    // If key not found, use master key
                    key = masterKey;
                    keyId = "master";
                }
            } else {
                key = masterKey;
                keyId = "master";
            }
            
            // Initialize cipher with GCM mode
            Cipher cipher = Cipher.getInstance(ALGORITHM);
            byte[] iv = new byte[12]; // GCM recommended IV size
            new SecureRandom().nextBytes(iv);
            GCMParameterSpec parameterSpec = new GCMParameterSpec(GCM_TAG_LENGTH, iv);
            cipher.init(Cipher.ENCRYPT_MODE, key, parameterSpec);
            
            // Encrypt
            byte[] encryptedData = cipher.doFinal(plaintext.getBytes());
            
            // Return encrypted data and IV
            Map<String, String> result = new HashMap<>();
            result.put("encryptedContent", Base64.getEncoder().encodeToString(encryptedData));
            result.put("iv", Base64.getEncoder().encodeToString(iv));
            result.put("keyId", keyId);
            
            return result;
        } catch (Exception e) {
            throw new RuntimeException("Encryption error", e);
        }
    }
    
    // Method to encrypt with the master key
    public Map<String, String> encrypt(String plaintext) {
        return encrypt(plaintext, null);
    }
    
    // Decrypt a message
    public String decrypt(String encryptedContent, String iv, String keyId) {
        try {
            // Get key from store or use master key
            SecretKey key;
            if ("master".equals(keyId)) {
                key = masterKey;
            } else {
                try {
                    key = getKeyById(keyId);
                } catch (RuntimeException e) {
                    throw new RuntimeException("Key not found with ID: " + keyId);
                }
            }
            
            // Decode from Base64
            byte[] encryptedData = Base64.getDecoder().decode(encryptedContent);
            byte[] ivBytes = Base64.getDecoder().decode(iv);
            
            // Initialize cipher for decryption
            Cipher cipher = Cipher.getInstance(ALGORITHM);
            GCMParameterSpec parameterSpec = new GCMParameterSpec(GCM_TAG_LENGTH, ivBytes);
            cipher.init(Cipher.DECRYPT_MODE, key, parameterSpec);
            
            // Decrypt
            byte[] decryptedData = cipher.doFinal(encryptedData);
            return new String(decryptedData);
        } catch (Exception e) {
            throw new RuntimeException("Decryption error", e);
        }
    }
    
    // Delete a key (for read-once messages)
    public void deleteKey(String keyId) {
        if (!"master".equals(keyId)) {
            // Remove from cache
            keyCache.remove(keyId);
            
            // Mark as inactive in database
            keyRepository.findById(keyId).ifPresent(key -> {
                key.setActive(false);
                keyRepository.save(key);
            });
        }
    }
}