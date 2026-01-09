# Build stage
FROM maven:3.9.6-eclipse-temurin-21 AS build
WORKDIR /app
COPY . .
RUN mvn -q -DskipTests package

# Run stage
FROM eclipse-temurin:21-jre
WORKDIR /work
COPY --from=build /app/target/quarkus-app /work/quarkus-app
EXPOSE 8080
CMD ["java","-jar","/work/quarkus-app/quarkus-run.jar"]
