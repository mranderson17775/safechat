package com.safechat.secure_messaging;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.ComponentScan;

@SpringBootApplication
@ComponentScan(basePackages = {
    "com.safechat.secure_messaging",
    "com.safechat.secure_messaging.security",
    "com.safechat.secure_messaging.config",
    "com.safechat.secure_messaging.repository"
})
public class SecureMessagingApplication {
    public static void main(String[] args) {
        SpringApplication.run(SecureMessagingApplication.class, args);
    }
}