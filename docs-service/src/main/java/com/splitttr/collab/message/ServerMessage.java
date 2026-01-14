package com.splitttr.collab.message;

import java.util.List;

// ServerMessage.
public record ServerMessage(
    String type,
    String documentId,
    String content,
    long version,
    EditOperation edit,
    String userId,
    String username,
    Integer cursorPosition,
    List<ActiveUser> activeUsers,
    String error
) {
    public record ActiveUser(String userId, String username, int cursorPosition) {}

    // Create init.
    public static ServerMessage init(String docId, String content, long version, List<ActiveUser> users) {
        return new ServerMessage("init", docId, content, version, null, null, null, null, users, null);
    }

    // Edit.
    public static ServerMessage edit(String docId, EditOperation op) {
        return new ServerMessage("edit", docId, null, 0, op, op.userId(), null, null, null, null);
    }

    // Cursor.
    public static ServerMessage cursor(String docId, String userId, String username, int position) {
        return new ServerMessage("cursor", docId, null, 0, null, userId, username, position, null, null);
    }

    // User joined.
    public static ServerMessage userJoined(String docId, String userId, String username, List<ActiveUser> users) {
        return new ServerMessage("user_joined", docId, null, 0, null, userId, username, null, users, null);
    }

    // User left.
    public static ServerMessage userLeft(String docId, String userId, String username) {
        return new ServerMessage("user_left", docId, null, 0, null, userId, username, null, null, null);
    }

    // Error.
    public static ServerMessage error(String message) {
        return new ServerMessage("error", null, null, 0, null, null, null, null, null, message);
    }
}
