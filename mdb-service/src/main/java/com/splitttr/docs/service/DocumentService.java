package com.splitttr.docs.service;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import com.splitttr.docs.entity.Document;
import com.splitttr.docs.repository.DocumentRepository;
import java.time.Instant;
import java.util.List;
import java.util.Optional;

@ApplicationScoped
public class DocumentService {

    @Inject
    DocumentRepository repo;

    public List<Document> listAll() {
        return repo.listAll();
    }

    public List<Document> listByOwner(String ownerId) {
        return repo.findByOwner(ownerId);
    }

    public Optional<Document> getById(String id) {
        return Optional.ofNullable(repo.findById(id));
    }

    public Document create(String id, String title, String content, String ownerId) {
    Document doc = new Document();
    doc.id = (id == null || id.isBlank()) ? null : id;
    doc.title = title;
    doc.content = content != null ? content : "";
    doc.ownerId = ownerId;
    doc.createdAt = Instant.now();
    doc.updatedAt = doc.createdAt;
    doc.version = 1;
    repo.persist(doc);
    return doc;
}

    public Optional<Document> update(String id, String title, String content) {
        Document doc = repo.findById(id);
        if (doc == null) return Optional.empty();

        if (title != null) doc.title = title;
        if (content != null) doc.content = content;
        doc.updatedAt = Instant.now();
        doc.version++;
        repo.update(doc);
        return Optional.of(doc);
    }

    public boolean delete(String id) {
        return repo.deleteById(id);
    }
}
