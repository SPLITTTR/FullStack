package com.splitttr.docs.dto;

// Data model for document update request.
public record DocumentUpdateRequest(
    String title,
    String content
) {}
