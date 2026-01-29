package com.school.drive.service;

import com.azure.storage.blob.BlobClient;
import com.azure.storage.blob.BlobContainerClient;
import com.azure.storage.blob.BlobServiceClient;
import com.azure.storage.blob.BlobServiceClientBuilder;
import com.azure.storage.blob.models.BlobHttpHeaders;
import com.azure.storage.common.StorageSharedKeyCredential;
import jakarta.annotation.PostConstruct;
import jakarta.enterprise.context.ApplicationScoped;
import org.eclipse.microprofile.config.inject.ConfigProperty;

import java.io.InputStream;
import java.nio.file.Path;

/**
 * Azure Blob Storage adapter (used when app.storage.provider=azure).
 *
 * Config:
 *  - app.azure.blob.container
 *  - app.azure.blob.connection-string OR (app.azure.blob.account-name + app.azure.blob.account-key)
 */
@ApplicationScoped
public class AzureBlobStorage {

  @ConfigProperty(name = "app.azure.blob.container")
  String container;

  @ConfigProperty(name = "app.azure.blob.connection-string")
  java.util.Optional<String> connectionString;

  @ConfigProperty(name = "app.azure.blob.account-name")
  java.util.Optional<String> accountName;

  @ConfigProperty(name = "app.azure.blob.account-key")
  java.util.Optional<String> accountKey;

  @ConfigProperty(name = "app.azure.blob.endpoint")
  java.util.Optional<String> endpoint;

  BlobContainerClient containerClient;

  @PostConstruct
  void init() {
    BlobServiceClient svc;

    if (connectionString.isPresent() && !connectionString.get().isBlank()) {
      svc = new BlobServiceClientBuilder()
          .connectionString(connectionString.get())
          .buildClient();
    } else {
      if (accountName.isEmpty() || accountKey.isEmpty()) {
        throw new IllegalStateException("Azure Blob config missing: provide app.azure.blob.connection-string or account-name+account-key");
      }
      String acct = accountName.get();
      String ep = endpoint.orElse("https://" + acct + ".blob.core.windows.net");
      StorageSharedKeyCredential cred = new StorageSharedKeyCredential(acct, accountKey.get());
      svc = new BlobServiceClientBuilder()
          .endpoint(ep)
          .credential(cred)
          .buildClient();
    }

    containerClient = svc.getBlobContainerClient(container);
    // best-effort: create container if missing
    try {
      containerClient.createIfNotExists();
    } catch (Exception ignored) {}
  }

  public void uploadFromFile(Path localFile, String blobName, String contentType) {
    BlobClient blob = containerClient.getBlobClient(blobName);
    blob.uploadFromFile(localFile.toString(), true);
    if (contentType != null && !contentType.isBlank()) {
      try {
        blob.setHttpHeaders(new BlobHttpHeaders().setContentType(contentType));
      } catch (Exception ignored) {}
    }
  }

  public InputStream openStream(String blobName) {
    BlobClient blob = containerClient.getBlobClient(blobName);
    return blob.openInputStream();
  }

  public void delete(String blobName) {
    try {
      containerClient.getBlobClient(blobName).deleteIfExists();
    } catch (Exception ignored) {}
  }
}
