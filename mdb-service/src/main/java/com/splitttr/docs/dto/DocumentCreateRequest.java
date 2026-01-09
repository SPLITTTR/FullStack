package com.splitttr.docs.dto;

public record DocumentCreateRequest(
    String id,
    String title,
    String content,
    String ownerId
) {}
