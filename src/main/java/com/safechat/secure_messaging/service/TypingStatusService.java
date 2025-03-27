package com.safechat.secure_messaging.service;

import org.springframework.stereotype.Service;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class TypingStatusService {
    private final Map<String, String> typingUsers = new ConcurrentHashMap<>();

    public void setTyping(String senderId, String receiverId) {
        typingUsers.put(senderId, receiverId);
    }

    public void removeTyping(String senderId) {
        typingUsers.remove(senderId);
    }

    public String getTypingUser(String receiverId) {
        return typingUsers.entrySet().stream()
            .filter(entry -> entry.getValue().equals(receiverId))
            .map(Map.Entry::getKey)
            .findFirst()
            .orElse(null);
    }
}
