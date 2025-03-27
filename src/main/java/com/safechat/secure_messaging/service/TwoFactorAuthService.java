package com.safechat.secure_messaging.service;

import com.safechat.secure_messaging.model.User;
import com.safechat.secure_messaging.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.security.InvalidKeyException;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.Base64;
import java.util.HashMap;
import java.util.Map;
import java.util.stream.IntStream;

import com.google.zxing.BarcodeFormat;
import com.google.zxing.client.j2se.MatrixToImageWriter;
import com.google.zxing.common.BitMatrix;
import com.google.zxing.qrcode.QRCodeWriter;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@Service
public class TwoFactorAuthService {
    private static final Logger logger = LoggerFactory.getLogger(TwoFactorAuthService.class);
    
    @Autowired
    private UserRepository userRepository;

    @Autowired
    private EmailService emailService;

    // Store recently sent codes with expiration time for rate limiting
    private final Map<String, Long> recentlySentCodes = new HashMap<>();
    private static final long RESEND_COOLDOWN_SECONDS = 5; // seconds

    // Time step in seconds (standard is 30)
    private static final long TIME_STEP = 30;

    // Window of valid codes (1 past and 1 future period)
    private static final int WINDOW_SIZE = 3;

    // Generate a random 2FA secret for a user
    public String generateSecret() {
        SecureRandom random = new SecureRandom();
        byte[] bytes = new byte[20];
        random.nextBytes(bytes);
        return Base64.getEncoder().encodeToString(bytes);
    }

    // Generate a 6-digit code based on user's secret and current time
    public String generateCode(String secret) {
        return generateCode(secret, Instant.now().getEpochSecond() / TIME_STEP);
    }

    // Generate code for a specific time counter
    private String generateCode(String secret, long counter) {
        try {
            String algorithm = "HmacSHA1";

            byte[] msg = longToBytes(counter);
            byte[] k = Base64.getDecoder().decode(secret);

            Mac mac = Mac.getInstance(algorithm);
            mac.init(new SecretKeySpec(k, algorithm));
            byte[] hash = mac.doFinal(msg);

            int offset = hash[hash.length - 1] & 0xf;
            int binary = ((hash[offset] & 0x7f) << 24) |
                    ((hash[offset + 1] & 0xff) << 16) |
                    ((hash[offset + 2] & 0xff) << 8) |
                    (hash[offset + 3] & 0xff);

            int otp = binary % 1000000;
            return String.format("%06d", otp);
        } catch (NoSuchAlgorithmException | InvalidKeyException e) {
            throw new RuntimeException("Error generating 2FA code", e);
        }
    }

    private byte[] longToBytes(long num) {
        byte[] result = new byte[8];
        for (int i = 7; i >= 0; i--) {
            result[i] = (byte) (num & 0xff);
            num >>= 8;
        }
        return result;
    }

    // Verify the code provided by the user with time window
    public boolean verifyCode(String secret, String code) {
        if (code == null || code.isEmpty()) {
            logger.error("Verification failed: Empty or null code provided");
            return false;
        }
        
        long currentTimeCounter = Instant.now().getEpochSecond() / TIME_STEP;
        
        // Use built-in formatting instead of substring for secret
        logger.debug("Verifying code: '{}' against secret: '{}...', current time counter: {}", 
                    code, secret.length() > 5 ? secret.substring(0, 5) : secret, currentTimeCounter);
        
        // Check within the time window (current, past, and future periods)
        return IntStream.rangeClosed(-WINDOW_SIZE, WINDOW_SIZE)
                .anyMatch(i -> {
                    String generatedCode = generateCode(secret, currentTimeCounter + i);
                    logger.debug("Generated code for offset {}: '{}', matches: {}", 
                               i, generatedCode, generatedCode.equals(code));
                    return generatedCode.equals(code);
                });
    }
    

    // Verify the code sent via email
    public boolean verifyEmailCode(String email, String code) {
        logger.debug("Verifying email code for {}, code length: {}", 
                    email, code != null ? code.length() : 0);
        
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("User not found"));
    
        if (user.getTwoFactorSecret() == null) {
            logger.error("2FA not set up for user with email: {}", email);
            throw new RuntimeException("2FA not set up for this user");
        }
    
        // Verify the code
        boolean isValid = verifyCode(user.getTwoFactorSecret(), code);
        logger.debug("Code verification result for email {}: {}", email, isValid);
        return isValid;
    }
    // Generate QR code for authenticator apps
    public String generateQrCodeImageUri(String secret, String username) {
        try {
            String company = "SafeChat";
            String otpAuthURL = String.format(
                    "otpauth://totp/%s:%s?secret=%s&issuer=%s&algorithm=SHA1&digits=6&period=30",
                    company, username, encodeSecretForUrl(secret), company
            );

            QRCodeWriter qrCodeWriter = new QRCodeWriter();
            BitMatrix bitMatrix = qrCodeWriter.encode(
                    otpAuthURL,
                    BarcodeFormat.QR_CODE,
                    200, 200
            );

            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            BufferedImage bufferedImage = MatrixToImageWriter.toBufferedImage(bitMatrix);
            ImageIO.write(bufferedImage, "png", baos);
            byte[] pngData = baos.toByteArray();
            return "data:image/png;base64," + Base64.getEncoder().encodeToString(pngData);
        } catch (Exception e) {
            throw new RuntimeException("Error generating QR code", e);
        }
    }

    // Encode secret in base32 format for URL (authenticator apps expect this)
    private String encodeSecretForUrl(String base64Secret) {
        // Convert from Base64 to raw bytes
        byte[] decodedSecret = Base64.getDecoder().decode(base64Secret);
        // Convert to Base32 (standard for TOTP)
        return Base32.encode(decodedSecret);
    }

    // Send verification code via email with rate limiting
    public boolean sendEmailCode(User user) {
        logger.debug("Attempting to send email code to user: {}", user.getUsername());
        
        // Check if user has 2FA method and secret (in setup or enabled state)
        if (user.getTwoFactorMethod() == null || !"EMAIL".equals(user.getTwoFactorMethod())) {
            logger.error("User {} does not have email 2FA set up", user.getUsername());
            throw new RuntimeException("Email 2FA not set up for this user");
        }
        
        if (user.getTwoFactorSecret() == null) {
            logger.error("User {} does not have a 2FA secret", user.getUsername());
            throw new RuntimeException("2FA not set up properly - No 2FA secret");
        }
        
        // Check if we've sent a code recently
        Long lastSentTime = recentlySentCodes.get(user.getEmail());
        long currentTime = Instant.now().getEpochSecond();
        
        if (lastSentTime != null && (currentTime - lastSentTime) < RESEND_COOLDOWN_SECONDS) {
            // Calculate remaining cooldown time
            long remainingTime = RESEND_COOLDOWN_SECONDS - (currentTime - lastSentTime);
            logger.debug("Rate limiting applied for user: {}. Cooldown remaining: {} seconds", 
                       user.getUsername(), remainingTime);
            throw new RuntimeException("Please wait " + remainingTime + " seconds before requesting a new code");
        }
    
        try {
            String code = generateCode(user.getTwoFactorSecret());
            String subject = "Your SafeChat Verification Code";
            String body = "Your verification code is: " + code +
                    "\nThis code will expire in 30 seconds." +
                    "\n\nDo not share this code with anyone, including SafeChat support.";
            
            logger.debug("Generated code for user: {}, attempting to send email", user.getUsername());
            boolean sent = emailService.sendEmail(user.getEmail(), subject, body);
            
            if (sent) {
                // Update the last sent time
                recentlySentCodes.put(user.getEmail(), currentTime);
                logger.info("Successfully sent verification code to user: {}", user.getUsername());
                return true;
            } else {
                logger.error("Email service failed to send verification code to user: {}", user.getUsername());
                return false;
            }
        } catch (Exception e) {
            logger.error("Exception occurred while sending verification code to user: {}", user.getUsername(), e);
            return false;
        }
    }

    // Setup 2FA for a user
    public void setupTwoFactor(User user, String method) {
        String secret = generateSecret();
        user.setTwoFactorSecret(secret);
        user.setTwoFactorEnabled(true);
        user.setTwoFactorMethod(method);
        userRepository.save(user);

        // If email method, send test email
        if ("EMAIL".equals(method)) {
            sendEmailCode(user);
        }
    }

    // Generate a temporary backup code for account recovery
    public String generateBackupCode() {
        SecureRandom random = new SecureRandom();
        byte[] bytes = new byte[5];
        random.nextBytes(bytes);
        return Base64.getEncoder().encodeToString(bytes)
                .substring(0, 10)
                .toUpperCase();
    }

    // Class to handle Base32 encoding (required for authenticator apps)
    private static class Base32 {
        private static final String BASE32_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

        public static String encode(byte[] data) {
            StringBuilder result = new StringBuilder();
            int bits = 0;
            int value = 0;

            for (byte b : data) {
                value = (value << 8) | (b & 0xff);
                bits += 8;

                while (bits >= 5) {
                    bits -= 5;
                    result.append(BASE32_CHARS.charAt((value >> bits) & 0x1f));
                }
            }

            if (bits > 0) {
                result.append(BASE32_CHARS.charAt((value << (5 - bits)) & 0x1f));
            }

            return result.toString();
        }
    }
}