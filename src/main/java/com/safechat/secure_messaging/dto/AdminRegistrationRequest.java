package com.safechat.secure_messaging.dto;

import lombok.Data;

@Data
public class AdminRegistrationRequest {
    private String token;
    private String username;
    private String email;
    private String password;
}
