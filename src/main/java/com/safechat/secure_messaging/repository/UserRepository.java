// Update your existing UserRepository.java
package com.safechat.secure_messaging.repository;

import com.safechat.secure_messaging.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface UserRepository extends JpaRepository<User, UUID> {
    Optional<User> findByUsername(String username);
    
    Optional<User> findByEmail(String email);
    
    boolean existsByUsername(String username);
    
    boolean existsByEmail(String email);
    
    Optional<User> findByAdminInvitationToken(String token);
    
    List<User> findByRoles(String role);

    void deleteById(@SuppressWarnings("null") UUID id);
   @Modifying
    @Query("DELETE FROM Message m WHERE m.sender = :user OR m.receiver = :user OR m.user = :user")
    void deleteMessagesByUser(@Param("user") User user);

    @Modifying
    @Query("DELETE FROM AuditLog a WHERE a.user = :user")
    void deleteAuditLogsByUser(@Param("user") User user);
}
