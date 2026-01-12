package com.school.drive.api.dto;

import com.school.drive.model.ShareRole;

// REST endpoints for share request.
public class ShareRequest {
  public String targetUsername;
  public String targetClerkUserId;
  public ShareRole role;
}
