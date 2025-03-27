package com.safechat.secure_messaging.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "encryption_keys")
public class KeyEntity {
    @Id
    private String keyId;
    
    @Column(nullable = false, length = 512)
    private String keyMaterial;
    
    @Column(nullable = false)
    private boolean active = true;
    
    public KeyEntity() {
    }
    
    public KeyEntity(String keyId, String keyMaterial) {
        this.keyId = keyId;
        this.keyMaterial = keyMaterial;
    }
    
    public String getKeyId() {
        return keyId;
    }
    
    public void setKeyId(String keyId) {
        this.keyId = keyId;
    }
    
    public String getKeyMaterial() {
        return keyMaterial;
    }
    
    public void setKeyMaterial(String keyMaterial) {
        this.keyMaterial = keyMaterial;
    }
    
    public boolean isActive() {
        return active;
    }
    
    public void setActive(boolean active) {
        this.active = active;
    }
}