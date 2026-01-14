package com.splitttr.collab.message;

// ClientMessage.
public record ClientMessage(
    String type,            // "join", "edit", "cursor", "leave"
    String documentId,
    String userId,
    String username,
    EditOperation edit,
    Integer cursorPosition
) {}