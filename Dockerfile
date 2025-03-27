# Use an official OpenJDK runtime as a parent image
FROM openjdk:17-jdk-slim

# Set the working directory in the container
WORKDIR /app

# Copy only the necessary files to improve build cache
COPY pom.xml .
COPY mvnw .
COPY .mvn .mvn

# Copy the entire project
COPY src ./src
COPY safechat-frontend ./safechat-frontend

# Install Maven
RUN apt-get update && apt-get install -y maven

# Ensure Maven wrapper is executable
RUN chmod +x ./mvnw

# Build the frontend first
RUN cd safechat-frontend && npm install && npm run build

# Build the backend
RUN ./mvnw clean package -DskipTests

# Expose the port the app runs on
EXPOSE ${PORT:-8080}

# Run the jar file
ENTRYPOINT ["sh", "-c", "java -jar target/secure-messaging-0.0.1-SNAPSHOT.jar"]