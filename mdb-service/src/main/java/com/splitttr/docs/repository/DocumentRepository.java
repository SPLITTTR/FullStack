package com.splitttr.docs.repository;

import io.quarkus.mongodb.panache.PanacheMongoRepositoryBase;
import jakarta.enterprise.context.ApplicationScoped;
import com.splitttr.docs.entity.Document;
import java.util.List;

@ApplicationScoped
public class DocumentRepository implements PanacheMongoRepositoryBase<Document, String> {

    public List<Document> findByOwner(String ownerId) {
        return find("ownerId", ownerId).list();
    }

    public List<Document> search(String query) {
        return find("title like ?1", "(?i).*" + query + ".*").list();
    }
}
