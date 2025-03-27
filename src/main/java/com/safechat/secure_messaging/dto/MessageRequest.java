// Update MessageRequest.java
package com.safechat.secure_messaging.dto;

import lombok.Data;

@Data
public class MessageRequest {
    private String recipientUsername;
    private String content;
    private int expirationMinutes; // 0 means no expiration
    private boolean readOnce;
    private Long conversationId;
}