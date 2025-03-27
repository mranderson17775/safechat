# Use an official OpenJDK runtime as a parent image
FROM openjdk:17-jdk-slim

# Set the working directory in the container
WORKDIR /app

# Copy the entire project
COPY . .

# Ensure Maven wrapper is executable
RUN chmod +x ./mvnw

# Use Maven to package the application
RUN ./mvnw clean package -DskipTests

# Expose the port the app runs on
EXPOSE 8080

# Run the jar file
ENTRYPOINT ["java","-jar","target/secure-messaging-0.0.1-SNAPSHOT.jar"]