package com.school.drive.api.dto;

import java.time.Instant;
import java.util.UUID;

public class DocResponse {
  public UUID id;
  public UUID parentId;
  public String title;
  public String content;
  public Instant createdAt;
  public Instant updatedAt;
  public long version;
}
