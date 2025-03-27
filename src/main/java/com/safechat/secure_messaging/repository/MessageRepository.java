// MessageRepository.java - Fix method naming
package com.safechat.secure_messaging.repository;
import com.safechat.secure_messaging.model.Message;
import com.safechat.secure_messaging.model.User;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public interface MessageRepository extends JpaRepository<Message, UUID> {
    @Query("SELECT m FROM Message m WHERE " +
           "(m.sender.id = :userId1 AND m.receiver.id = :userId2) OR " +
           "(m.sender.id = :userId2 AND m.receiver.id = :userId1) " +
           "ORDER BY m.timestamp ASC")
    List<Message> findMessagesBetweenUsers(@Param("userId1") UUID userId1, @Param("userId2") UUID userId2);
    
    List<Message> findBySenderId(UUID senderId);
    
    List<Message> findByReceiverId(UUID receiverId);
    
    List<Message> findByReceiverIdAndReadFalse(UUID receiverId);
    
    // Added this method to match the service call
    List<Message> findByExpiresAtBefore(LocalDateTime dateTime);
    
    @Query("SELECT COUNT(m) FROM Message m WHERE m.receiver.id = :userId AND m.read = false")
    Long countUnreadMessagesByReceiverId(@Param("userId") UUID userId);

    @Modifying
    @Transactional
    void deleteByReceiverIdOrSenderIdOrRevokedBy(UUID receiverId, UUID senderId, User revokedBy);

    
    void deleteByExpiresAtBefore(LocalDateTime dateTime);
}
