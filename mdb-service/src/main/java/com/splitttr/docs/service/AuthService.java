package com.splitttr.docs.service;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.eclipse.microprofile.jwt.JsonWebToken;

/**
 * Extracts the authenticated user's Clerk ID from the JWT token.
 * The 'sub' claim contains the Clerk user ID (e.g., "user_2abc123...").
 */
@ApplicationScoped
public class AuthService {

    @Inject
    JsonWebToken jwt;

    /**
     * Get the current user's Clerk ID from the JWT subject claim.
     * This ID is shared across your mdb-service and your colleague's drive-backend.
     */
    public String getCurrentUserId() {
        String clerkUserId = jwt.getSubject();
        if (clerkUserId == null || clerkUserId.isBlank()) {
            throw new IllegalStateException("JWT missing sub claim");
        }
        return clerkUserId;
    }

    /**
     * Get email if available (Clerk includes this in some token configs)
     */
    public String getEmail() {
        return jwt.getClaim("email");
    }
}
