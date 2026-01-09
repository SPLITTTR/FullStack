package com.school.drive.integration.docs;

import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import org.eclipse.microprofile.rest.client.inject.RegisterRestClient;

@RegisterRestClient(configKey = "document-service")
@Path("/api/documents")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public interface DocumentServiceClient {
  @POST
  DocumentResponse create(DocumentCreateRequest req);

  @GET
  @Path("/{id}")
  DocumentResponse getById(@PathParam("id") String id);

  @PUT
  @Path("/{id}")
  DocumentResponse update(@PathParam("id") String id, DocumentUpdateRequest req);

  @DELETE
  @Path("/{id}")
  void delete(@PathParam("id") String id);
}
