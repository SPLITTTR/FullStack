package com.splitttr.docs.dto;

import com.splitttr.docs.entity.Document;
import java.time.Instant;

public record DocumentResponse(
    String id,
    String title,
    String content,
    String ownerId,
    Instant createdAt,
    Instant updatedAt,
    long version
) {
    public static DocumentResponse from(Document doc) {
        return new DocumentResponse(
            doc.id,
            doc.title,
            doc.content,
            doc.ownerId,
            doc.createdAt,
            doc.updatedAt,
            doc.version
        );
    }
}
