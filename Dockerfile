# ─────────────────────────────────────────────
# IDme — Multi-stage Production Build
# ─────────────────────────────────────────────

# Stage 1: Dependencies
FROM python:3.11-slim AS deps

WORKDIR /app

# Install system dependencies for asyncpg, cryptography, pillow
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        gcc \
        libpq-dev \
        libjpeg62-turbo-dev \
        zlib1g-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt


# Stage 2: Application
FROM python:3.11-slim

# Security: non-root user
RUN groupadd -r idme && useradd -r -g idme -d /app -s /sbin/nologin idme

WORKDIR /app

# Install runtime dependencies only
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        libpq5 \
        libjpeg62-turbo \
        curl \
    && rm -rf /var/lib/apt/lists/*

# Copy installed Python packages from deps stage
COPY --from=deps /install /usr/local

# Copy application code
COPY --chown=idme:idme . .

# Create directories for generated assets
RUN mkdir -p /app/static/generated && chown -R idme:idme /app/static/generated

USER idme

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

EXPOSE 8000

# Run with uvicorn
CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "4", "--loop", "uvloop", "--http", "httptools"]
