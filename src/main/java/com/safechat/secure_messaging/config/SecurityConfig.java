package com.safechat.secure_messaging.config;

import com.safechat.secure_messaging.security.JwtAuthenticationEntryPoint;
import com.safechat.secure_messaging.security.JwtAuthorizationFilter;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.security.web.header.writers.XContentTypeOptionsHeaderWriter;
import java.util.Arrays;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity
public class SecurityConfig {

    private final JwtAuthorizationFilter jwtAuthorizationFilter;
    private final JwtAuthenticationEntryPoint jwtAuthenticationEntryPoint;

    @Value("${app.cors.allowed-origins}")
    private String allowedOrigins;

    @Value("${app.cors.allowed-methods}")
    private String allowedMethods;

    public SecurityConfig(JwtAuthorizationFilter jwtAuthorizationFilter,
                          JwtAuthenticationEntryPoint jwtAuthenticationEntryPoint) {
        this.jwtAuthorizationFilter = jwtAuthorizationFilter;
        this.jwtAuthenticationEntryPoint = jwtAuthenticationEntryPoint;
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
            // Enable CORS
            .cors(cors -> cors.configurationSource(corsConfigurationSource()))
            
            // Disable CSRF for REST APIs
            .csrf(csrf -> csrf.disable())
            
            // Session management
            .sessionManagement(session -> 
                session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            
            // Exception handling
            .exceptionHandling(exceptionHandling -> 
                exceptionHandling.authenticationEntryPoint(jwtAuthenticationEntryPoint))
                
            // Request authorization rules
            .authorizeHttpRequests(authz -> authz
                // Add this pattern to handle SPA routing
                .requestMatchers("/**").permitAll()
                
                // Public endpoints - allow ALL static resources
                .requestMatchers(
                    "/",                     // Root path
                    "/index.html",           // Main HTML
                    "/static/**",            // All static folder content
                    "/*.js",                 // Root JS files
                    "/*.css",                // Root CSS files
                    "/*.js.map",             // Root JS source maps
                    "/*.css.map",            // Root CSS source maps
                    "/manifest.json",        // Web app manifest
                    "/favicon.ico",          // Favicon
                    "/logo*.png",            // All logo files
                    "/asset-manifest.json",  // Asset manifest
                    "/robots.txt", 
                    "/auth/resend",   
                    "/error",       
                    "/auth/register", 
                    "/auth/2fa/verify",
                    "/api/auth/login",
                    "/api/auth/register",
                    "/api/auth/refresh-token",
                    "/api/auth/2fa/resend",
                    "/api/auth/resend",
                    "/api/auth/2fa/setup",
                    "/api/auth/user",
                    "/api/messages/{messageId}",
                    "/api/messages/typing",
                    "/api/messages/typing-stopped",
                    "/api/messages/typing-status",
                    "/api/admin/messages/{messageId}/revoke",
                    "/api/admin/messages",
                    "/api/admin/users/{userId}",
                    "/api/admin/users",
                    "/api/admin/toggle-admin/{userId}",
                    "/api/admin/**",         // All admin API endpoints
                    "/toggle-admin/**", 
                    "/api/admin/audit-logs",     // Include the toggle-admin endpoint
                    "/auth/validate-token",
                    "/auth/refresh-token",
                    "/user/all",
                    "/ws",            // WebSocket connection endpoint
                    "/ws/**",         // WebSocket-related endpoints
                    "/topic/**",      // WebSocket topic subscriptions
                    "/app/**",
                    "/user/profile",         // WebSocket application destinations
                    "/ws-sockjs/**"
                ).permitAll()
                
                // Public API endpoints
                .requestMatchers(
                    "/auth/login",
                    "/auth/register",
                    "/auth/refresh-token",
                    "/auth/2fa/resend",
                    "/auth/resend",
                    "/auth/2fa/setup"
                ).permitAll()
                
                // Protected Routes - Role-based Access
                .requestMatchers("/admin-dashboard")  // Ensure to add your admin dashboard route here
                .hasAnyRole("ADMIN", "SUPER_ADMIN", "SUPPORT_ADMIN") // You can use hasAnyRole("ADMIN", "SUPER_ADMIN") if you have multiple roles
                
                // All other requests need authentication
                .anyRequest().authenticated()
            )
            .addFilterBefore(jwtAuthorizationFilter, UsernamePasswordAuthenticationFilter.class)

            // Add CSP headers
            .headers(headers -> headers
                // XSS protection with proper enum usage
                .contentTypeOptions().disable() // Disable content type sniffing
                .frameOptions().deny() // Prevent clickjacking
                .httpStrictTransportSecurity(hsts -> hsts
                    .includeSubDomains(true)
                    .maxAgeInSeconds(31536000) // Force HTTPS for 1 year
                )
                .contentSecurityPolicy(csp -> csp.policyDirectives(
                    "default-src 'self'; " +  // Allow only same-origin requests
                    "script-src 'self' 'unsafe-inline'; " +  // Allow scripts from same-origin
                    "style-src 'self' 'unsafe-inline'; " + // Allow stylesheets from same-origin
                    "img-src 'self' data:; " + // Allow images from same-origin and inline images
                    "font-src 'self' data:; " + // Allow fonts from same-origin
                    "connect-src 'self'; " + // Allow API calls to same-origin
                    "frame-ancestors 'none'; " + // Prevent embedding in iframes
                    "form-action 'self';" // Restrict form submissions to same-origin
                ))
            );

        return http.build();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder(12);
    }

    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration authConfig) throws Exception {
        return authConfig.getAuthenticationManager();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration configuration = new CorsConfiguration();
        configuration.setAllowedOrigins(Arrays.asList(
            "http://localhost:3000", 
            "https://localhost:3000",
            "ws://localhost:3000",
            "wss://localhost:3000"
        ));
        configuration.setAllowedMethods(Arrays.asList("GET", "POST", "PUT", "DELETE", "OPTIONS"));
        configuration.setAllowedHeaders(Arrays.asList("*"));
        configuration.setAllowCredentials(true);
        
        // Specific WebSocket CORS settings
        configuration.addAllowedOriginPattern("ws://localhost:*");
        configuration.addAllowedOriginPattern("wss://localhost:*");

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);
        return source;
    }
}
