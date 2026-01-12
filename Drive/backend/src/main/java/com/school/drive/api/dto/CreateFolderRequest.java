package com.school.drive.api.dto;

import java.util.UUID;

// REST endpoints for create folder request.
public class CreateFolderRequest {
  public UUID parentId; // null = root
  public String name;
}
