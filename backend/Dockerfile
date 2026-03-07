# ================================
# Stage 1: Build
# ================================
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install all dependencies (including devDependencies for build)
RUN npm install

# Copy source code
COPY . .

# Build: prisma generate + tsc + copy generated
RUN npm run build

# ================================
# Stage 2: Production
# ================================
FROM node:22-alpine AS runner

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install production dependencies only
RUN npm install --omit=dev

# Copy built files from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/generated ./generated

# Expose port (Render sẽ inject PORT tự động)
EXPOSE 3001

# Start server
CMD ["node", "dist/server.js"]