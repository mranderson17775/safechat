package com.safechat.secure_messaging.repository;
import com.safechat.secure_messaging.model.AuditLog;
import com.safechat.secure_messaging.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Repository
public interface AuditLogRepository extends JpaRepository<AuditLog, UUID> {
   
    List<AuditLog> findByUserOrderByTimestampDesc(User user);
   
    List<AuditLog> findByTimestampBetweenOrderByTimestampDesc(LocalDateTime start, LocalDateTime end);
   
    // Example showing a complex Oracle query with multiple joins
    @Query(value = "SELECT a.* FROM AUDIT_LOG a " +
            "JOIN APP_USER u ON a.user_id = u.id " +
            "LEFT JOIN USER_ROLES r ON u.id = r.user_id " +
            "WHERE r.role = :role " +
            "AND a.timestamp >= :startDate " +
            "AND a.timestamp <= :endDate " +
            "ORDER BY a.timestamp DESC",
            nativeQuery = true)
    List<AuditLog> findLogsByUserRoleAndDateRange(
            @Param("role") String role,
            @Param("startDate") LocalDateTime startDate,
            @Param("endDate") LocalDateTime endDate);

            void deleteById(@SuppressWarnings("null")     UUID userId);
}