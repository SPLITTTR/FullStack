package com.school.drive.repo;

import com.school.drive.model.ItemShare;
import com.school.drive.model.ItemShareId;
import io.quarkus.hibernate.orm.panache.PanacheRepositoryBase;
import jakarta.enterprise.context.ApplicationScoped;

import java.util.List;
import java.util.UUID;

// Database access for item share repository.
@ApplicationScoped
public class ItemShareRepository implements PanacheRepositoryBase<ItemShare, ItemShareId> {

  // Retrieve find share.
  public ItemShare findShare(UUID itemId, UUID sharedWithUserId) {
    return findById(new ItemShareId(itemId, sharedWithUserId));
  }

  // Retrieve list shares for user.
  public List<ItemShare> listSharesForUser(UUID sharedWithUserId) {
    return list("id.sharedWithUserId = ?1 order by createdAt desc", sharedWithUserId);
  }
}
