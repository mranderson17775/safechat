import java.security.SecureRandom;
import java.util.Base64;

public class EncryptionKeyGenerator {
    public static void main(String[] args) {
        try {
            SecureRandom random = new SecureRandom();
            byte[] keyBytes = new byte[32]; // 256-bit key
            random.nextBytes(keyBytes);
            String base64Key = Base64.getEncoder().encodeToString(keyBytes);
            System.out.println("Generated Encryption Key: " + base64Key);
        } catch (Exception e) {
            System.err.println("Error generating key: " + e.getMessage());
            e.printStackTrace();
        }
    }
}