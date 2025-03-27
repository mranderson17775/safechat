package com.safechat.secure_messaging.dto;

import lombok.Data;

@Data
public class TwoFactorRequest {
    private String username;
    private String code;
    private String method; // Optional, if you need it

    // Getters and setters
    public String getUsername() {
        return username;
    }

    public void setUsername(String username) {
        this.username = username;
    }

    public String getCode() {
        return code;
    }

    public void setCode(String code) {
        this.code = code;
    }

    public String getMethod() {
        return method;
    }

    public void setMethod(String method) {
        this.method = method;
    }
}