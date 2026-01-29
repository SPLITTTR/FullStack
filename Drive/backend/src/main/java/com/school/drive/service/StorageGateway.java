package com.school.drive.service;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import software.amazon.awssdk.core.ResponseInputStream;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectResponse;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;

import java.io.InputStream;
import java.nio.file.Path;

/**
 * Small abstraction so ItemService does not care whether we use MinIO/S3 or Azure Blob.
 *
 * app.storage.provider:
 *  - s3   (default, local MinIO)
 *  - azure (Azure Blob)
 */
@ApplicationScoped
public class StorageGateway {

  @ConfigProperty(name = "app.storage.provider", defaultValue = "s3")
  String provider;

  @Inject
  S3Client s3;

  @Inject
  S3Storage s3Storage;

  @Inject
  AzureBlobStorage azure;

  public String provider() {
    return provider == null ? "s3" : provider.trim().toLowerCase();
  }

  public void upload(Path localFile, String key, String contentType) {
    if ("azure".equals(provider())) {
      azure.uploadFromFile(localFile, key, contentType);
      return;
    }

    PutObjectRequest put = PutObjectRequest.builder()
        .bucket(s3Storage.bucket())
        .key(key)
        .contentType(contentType != null && !contentType.isBlank() ? contentType : "application/octet-stream")
        .build();

    s3.putObject(put, RequestBody.fromFile(localFile));
  }

  public InputStream download(String key) {
    if ("azure".equals(provider())) {
      return azure.openStream(key);
    }

    GetObjectRequest get = GetObjectRequest.builder()
        .bucket(s3Storage.bucket())
        .key(key)
        .build();

    ResponseInputStream<GetObjectResponse> stream = s3.getObject(get);
    return stream;
  }

  public void delete(String key) {
    if ("azure".equals(provider())) {
      azure.delete(key);
      return;
    }

    s3.deleteObject(DeleteObjectRequest.builder().bucket(s3Storage.bucket()).key(key).build());
  }
}
