# Build and production image for Google Cloud Run
FROM node:20-slim AS builder

WORKDIR /app

# Install build dependencies
COPY package*.json ./
RUN npm ci || npm install

# Copy application source files
COPY . .

# Build React client static assets (dist/) and Express server bundle (dist/server.cjs)
RUN npm run build

# Production runner stage
FROM node:20-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Install production dependencies only
COPY package*.json ./
RUN npm ci --omit=dev || npm install --omit=dev

# Copy compiled frontend and bundled server from builder stage
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/firebase-applet-config.json ./firebase-applet-config.json

# Expose port for Cloud Run ingress
EXPOSE 3000

# Start compiled Express server
CMD ["node", "dist/server.cjs"]
