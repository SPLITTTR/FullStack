package com.splitttr.collab.client;

import java.time.Instant;

// DocumentResponse.
public record DocumentResponse(
    String id,
    String title,
    String content,
    String ownerId,
    Instant createdAt,
    Instant updatedAt,
    long version
) {}