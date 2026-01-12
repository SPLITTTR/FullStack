package com.school.drive.api.dto;

import java.util.UUID;

// REST endpoints for patch item request.
public class PatchItemRequest {
  public String name;   // optional
  public UUID parentId; // optional
}
