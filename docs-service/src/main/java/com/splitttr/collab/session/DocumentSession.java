package com.splitttr.collab.session;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.splitttr.collab.message.ServerMessage.ActiveUser;
import io.quarkus.websockets.next.WebSocketConnection;

import java.util.List;
import java.util.concurrent.ConcurrentHashMap;

// DocumentSession.
public class DocumentSession {

    private static final ObjectMapper mapper = new ObjectMapper()
        .registerModule(new JavaTimeModule());

    private final String documentId;
    private final ConcurrentHashMap<String, UserConnection> connections = new ConcurrentHashMap<>();

    // In-memory document state for fast access
    private String content;
    private long version;

    public record UserConnection(WebSocketConnection connection, int cursorPosition) {}

    public DocumentSession(String documentId) {
        this.documentId = documentId;
    }

    // Create init content.
    public void initContent(String content, long version) {
        this.content = content;
        this.version = version;
    }

    // Retrieve get content.
    public String getContent() {
        return content;
    }

    // Retrieve get version.
    public long getVersion() {
        return version;
    }

    // Apply edit.
    public void applyEdit(String type, int position, String text, int deleteCount) {
        content = switch (type) {
            case "insert" -> content.substring(0, position) + text + content.substring(position);
            case "delete" -> content.substring(0, position) + content.substring(position + deleteCount);
            case "replace" -> content.substring(0, position) + text + content.substring(position + deleteCount);
            default -> content;
        };
        version++;
    }

    // Add user.
    public void addUser(String userId, WebSocketConnection conn) {
        connections.put(userId, new UserConnection(conn, 0));
    }

    // Delete remove user.
    public void removeUser(String userId) {
        connections.remove(userId);
    }

    // Update update cursor.
    public void updateCursor(String userId, int position) {
        var existing = connections.get(userId);
        if (existing != null) {
            connections.put(userId, new UserConnection(existing.connection(), position));
        }
    }

    // Is empty.
    public boolean isEmpty() {
        return connections.isEmpty();
    }

    // Retrieve get active users.
    public List<ActiveUser> getActiveUsers() {
        return connections.entrySet().stream()
            .map(e -> new ActiveUser(e.getKey(), e.getValue().cursorPosition()))
            .toList();
    }

    // Broadcast.
    public void broadcast(Object message, String excludeUserId) {
        String json = toJson(message);
        connections.forEach((userId, uc) -> {
            if (!userId.equals(excludeUserId)) {
                uc.connection().sendTextAndAwait(json); 
            }
        });
    }

    // Send to.
    public void sendTo(String userId, Object message) {
        var uc = connections.get(userId);
        if (uc != null) {
            uc.connection().sendTextAndAwait(toJson(message));
        }
    }

    private String toJson(Object obj) {
        try {
            return mapper.writeValueAsString(obj);
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }
}