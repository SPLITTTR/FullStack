package com.splitttr.docs.dto;

// Data model for document create request.
public record DocumentCreateRequest(
    String id,
    String title,
    String content,
    String ownerId
) {}
