package com.school.drive.api.dto;

import java.time.Instant;
import java.util.UUID;

// REST endpoints for doc response.
public class DocResponse {
  public UUID id;
  public UUID parentId;
  public String title;
  public String content;
  public Instant createdAt;
  public Instant updatedAt;
  public long version;

  // Access role for current user: NONE | VIEWER | EDITOR
  public String access;
  // Convenience flag
  public boolean canWrite;
}

