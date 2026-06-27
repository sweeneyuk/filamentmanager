FROM node:18-alpine

WORKDIR /app

# Copy server files and install dependencies
COPY server/package*.json ./server/
RUN cd server && npm install

# Copy client files and install dependencies
COPY client/package*.json ./client/
RUN cd client && npm install

# Copy the rest of the code
COPY . .

# Build the client
RUN cd client && npm run build

# Start the server
EXPOSE 3000
EXPOSE 3001
CMD [ "node", "server/server.js" ]
