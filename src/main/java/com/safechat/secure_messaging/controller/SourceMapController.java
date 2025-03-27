package com.safechat.secure_messaging.controller;

import org.springframework.core.io.ClassPathResource;
import org.springframework.core.io.Resource;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@RestController
public class SourceMapController {
    
    private static final Logger logger = LoggerFactory.getLogger(SourceMapController.class);
    
    @GetMapping(value = "/main.{hash}.js.map")
    public ResponseEntity<Resource> serveJsSourceMap(@PathVariable String hash) {
        logger.info("Serving JS source map for hash: {}", hash);
        
        // Look for the file in the /static/js directory
        Resource resource = new ClassPathResource("/static/js/main." + hash + ".js.map");
        
        if (resource.exists()) {
            logger.info("Found JS source map in /static/js/");
            return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_JSON)
                .body(resource);
        }
        
        logger.warn("JS source map not found for hash: {}", hash);
        return ResponseEntity.notFound().build();
    }
    
    @GetMapping(value = "/main.{hash}.css.map")
    public ResponseEntity<Resource> serveCssSourceMap(@PathVariable String hash) {
        logger.info("Serving CSS source map for hash: {}", hash);
        
        // Look for the file in the /static/css directory
        Resource resource = new ClassPathResource("/static/css/main." + hash + ".css.map");
        
        if (resource.exists()) {
            logger.info("Found CSS source map in /static/css/");
            return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_JSON)
                .body(resource);
        }
        
        logger.warn("CSS source map not found for hash: {}", hash);
        return ResponseEntity.notFound().build();
    }
}
