# Stage 1: Build the React Client
FROM node:20-slim AS builder

WORKDIR /app

# Copy package files for both client and server
COPY client/package*.json ./client/

# Install client dependencies
WORKDIR /app/client
RUN npm install

# Copy client source code
COPY client/ ./
# Build the React app
RUN npm run build

# Stage 2: Setup the Production Server
FROM node:20-slim

WORKDIR /app

# Install backend dependencies
WORKDIR /app/server
COPY server/package*.json ./
RUN npm install --production

# Link GHCR package to the GitHub repository
LABEL org.opencontainers.image.source="https://github.com/sweeneyuk/filamentmanager"

# Copy backend source code
COPY server/ ./

# Copy built React client from the builder stage
COPY --from=builder /app/client/dist /app/client/dist

# The DB is stored in /app/server/data
# Ensure the directory exists and set permissions
RUN mkdir -p /app/server/data

# Expose the API and Web port
EXPOSE 3000

# Start the Node backend
CMD ["node", "server.js"]
