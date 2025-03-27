package com.safechat.secure_messaging.dto;

import lombok.Data;

@Data
public class MessageRevokeRequest {
    private Long messageId;  // Use Long for consistency
    private String reason;   // Keep the reason field

    public MessageRevokeRequest() {
    }

    public MessageRevokeRequest(Long messageId, String reason) {
        this.messageId = messageId;
        this.reason = reason;
    }
}
