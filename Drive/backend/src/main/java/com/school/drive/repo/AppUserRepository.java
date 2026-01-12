package com.school.drive.repo;

import com.school.drive.model.AppUser;
import io.quarkus.hibernate.orm.panache.PanacheRepositoryBase;
import jakarta.enterprise.context.ApplicationScoped;

import java.util.UUID;

// Database access for app user repository.
@ApplicationScoped
public class AppUserRepository implements PanacheRepositoryBase<AppUser, UUID> {
  // Retrieve find by clerk user id.
  public AppUser findByClerkUserId(String clerkUserId) {
    return find("clerkUserId", clerkUserId).firstResult();
  }

  // Retrieve find by username.
  public AppUser findByUsername(String username) {
    return find("username", username).firstResult();
  }
}
