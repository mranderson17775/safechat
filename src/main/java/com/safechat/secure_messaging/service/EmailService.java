package com.safechat.secure_messaging.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.mail.MailException;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

@Service
public class EmailService {
    private static final Logger logger = LoggerFactory.getLogger(EmailService.class);
   
    @Autowired
    private JavaMailSender mailSender;
   
    public boolean sendEmail(String to, String subject, String body) {
        if (mailSender == null) {
            logger.error("JavaMailSender is not configured properly - mailSender is null");
            return false;
        }

        logger.debug("Preparing to send email to: {}, Subject: {}", to, subject);
        
        SimpleMailMessage message = new SimpleMailMessage();
        message.setTo(to);
        message.setSubject(subject);
        message.setText(body);
        message.setFrom("mranderson8888888@gmail.com"); // Add explicit "from" address
        
        try {
            logger.debug("Sending email...");
            mailSender.send(message);
            logger.info("Email sent successfully to: {}", to);
            return true;
        } catch (MailException e) {
            logger.error("Failed to send email to: {} - Error: {}", to, e.getMessage(), e);
            // Log the stack trace for better debugging
            logger.error("Stack trace: ", e);
            return false;
        } catch (Exception e) {
            // Catch any other unexpected exceptions
            logger.error("Unexpected error sending email to: {} - Error: {}", to, e.getMessage(), e);
            logger.error("Stack trace: ", e);
            return false;
        }
    }
}