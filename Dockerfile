# Production-Ready Dockerfile for YouTube Management Bot on Render
FROM node:20-bookworm-slim

# Install system dependencies: FFmpeg, Python3, pip, curl
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    python3 \
    python3-pip \
    python3-venv \
    ca-certificates \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install yt-dlp for video downloads
RUN python3 -m pip install --no-cache-dir --break-system-packages yt-dlp || true

# Set working directory
WORKDIR /app

# Set production environment variables
ENV NODE_ENV=production \
    PORT=3000 \
    PYTHON_PATH=python3 \
    FFMPEG_PATH=ffmpeg

# Copy package definitions first for layer caching
COPY package*.json ./

# Install only production dependencies
RUN npm ci --omit=dev || npm install --omit=dev

# Copy application source code
COPY . .

# Ensure required runtime directories exist with write permissions
RUN mkdir -p /app/data /app/downloads /app/data/tts_cache /app/data/tts_chunks /app/data/tts_studio

# Expose default port (Render will override via PORT env var)
EXPOSE 3000

# Container healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:${PORT:-3000}/health || exit 1

# Start the application
CMD ["npm", "start"]
