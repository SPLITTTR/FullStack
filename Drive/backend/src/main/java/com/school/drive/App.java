package com.school.drive;

import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;

// App.
@Path("/health")
public class App {
  @GET
  // Ok.
  public String ok() {
    return "ok";
  }
}
