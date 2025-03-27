package com.safechat.secure_messaging.controller;

import jakarta.servlet.RequestDispatcher;
import jakarta.servlet.http.HttpServletRequest;

import org.springframework.boot.web.servlet.error.ErrorController;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseBody;

import java.util.HashMap;
import java.util.Map;

@Controller
public class CustomErrorController implements ErrorController {

    @RequestMapping("/error")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> handleError(HttpServletRequest request) {
        Object status = request.getAttribute(RequestDispatcher.ERROR_STATUS_CODE);
        Object message = request.getAttribute(RequestDispatcher.ERROR_MESSAGE);
        Object path = request.getAttribute(RequestDispatcher.ERROR_REQUEST_URI);
        
        Map<String, Object> errorDetails = new HashMap<>();
        errorDetails.put("path", path != null ? path : request.getRequestURI());
        errorDetails.put("status", "error");
        
        HttpStatus httpStatus = HttpStatus.INTERNAL_SERVER_ERROR;
        
        if (status != null) {
            int statusCode = Integer.parseInt(status.toString());
            httpStatus = HttpStatus.valueOf(statusCode);
            errorDetails.put("code", statusCode);
            
            // Customize messages based on status codes
            if (statusCode == HttpStatus.NOT_FOUND.value()) {
                errorDetails.put("message", "Resource not found");
            } else if (statusCode == HttpStatus.UNAUTHORIZED.value()) {
                errorDetails.put("message", "Authentication required");
            } else if (statusCode == HttpStatus.FORBIDDEN.value()) {
                errorDetails.put("message", "Access denied");
            } else {
                errorDetails.put("message", message != null ? message : "An error occurred");
            }
        } else {
            errorDetails.put("code", HttpStatus.INTERNAL_SERVER_ERROR.value());
            errorDetails.put("message", "An unexpected error occurred");
        }
        
        return new ResponseEntity<>(errorDetails, httpStatus);
    }
}