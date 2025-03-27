package com.safechat.secure_messaging.dto;


import lombok.Data;

@Data
public class AdminInviteRequest {
    private String email;
    private String role;
}
