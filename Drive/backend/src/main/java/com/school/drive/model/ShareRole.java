package com.school.drive.model;

// Data model for share role.
public enum ShareRole {
  VIEWER,
  EDITOR,
  OWNER;

  public boolean canWrite() {
    return this == EDITOR || this == OWNER;
  }
}
