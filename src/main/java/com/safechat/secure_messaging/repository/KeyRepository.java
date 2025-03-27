package com.safechat.secure_messaging.repository;

import com.safechat.secure_messaging.model.KeyEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface KeyRepository extends JpaRepository<KeyEntity, String> {
    Optional<KeyEntity> findByKeyIdAndActiveTrue(String keyId);
}