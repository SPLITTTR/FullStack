package com.splitttr.docs.repository;

import io.quarkus.mongodb.panache.PanacheMongoRepositoryBase;
import jakarta.enterprise.context.ApplicationScoped;
import com.splitttr.docs.entity.Document;
import java.util.List;

// Database access for document repository.
@ApplicationScoped
public class DocumentRepository implements PanacheMongoRepositoryBase<Document, String> {

    // Retrieve find by owner.
    public List<Document> findByOwner(String ownerId) {
        return find("ownerId", ownerId).list();
    }

    // Search.
    public List<Document> search(String query) {
        return find("title like ?1", "(?i).*" + query + ".*").list();
    }
}
