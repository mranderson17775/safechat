package com.safechat.secure_messaging.dto;

public class TypingIndicatorRequest {
    private String senderId;
    private String receiverId;
    private boolean typing;

    // Constructors
    public TypingIndicatorRequest() {}

    public TypingIndicatorRequest(String senderId, String receiverId, boolean typing) {
        this.senderId = senderId;
        this.receiverId = receiverId;
        this.typing = typing;
    }

    // Getters and setters
    public String getSenderId() {
        return senderId;
    }

    public void setSenderId(String senderId) {
        this.senderId = senderId;
    }

    public String getReceiverId() {
        return receiverId;
    }

    public void setReceiverId(String receiverId) {
        this.receiverId = receiverId;
    }

    public boolean isTyping() {
        return typing;
    }

    public void setTyping(boolean typing) {
        this.typing = typing;
    }
}