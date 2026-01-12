package com.school.drive.api;

import com.school.drive.service.ItemService;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.ext.ExceptionMapper;
import jakarta.ws.rs.ext.Provider;

// REST endpoints for exception mappers.
public class ExceptionMappers {

  public static class ErrorBody {
    public String error;
    public ErrorBody(String error) { this.error = error; }
  }

  @Provider
  public static class NotFoundMapper implements ExceptionMapper<ItemService.NotFoundException> {
    @Override
    // HTTP handler: to response.
    public Response toResponse(ItemService.NotFoundException e) {
      String msg = e.getMessage();
      if (msg == null || msg.isBlank()) msg = "not_found";
      return Response.status(404).type(MediaType.APPLICATION_JSON).entity(new ErrorBody(msg)).build();
    }
  }

  @Provider
  public static class ForbiddenMapper implements ExceptionMapper<ItemService.ForbiddenException> {
    @Override
    // HTTP handler: to response.
    public Response toResponse(ItemService.ForbiddenException e) {
      return Response.status(403).type(MediaType.APPLICATION_JSON).entity(new ErrorBody(e.getMessage())).build();
    }
  }

  @Provider
  public static class BadRequestMapper implements ExceptionMapper<ItemService.BadRequestException> {
    @Override
    // HTTP handler: to response.
    public Response toResponse(ItemService.BadRequestException e) {
      return Response.status(400).type(MediaType.APPLICATION_JSON).entity(new ErrorBody(e.getMessage())).build();
    }
  }
}
