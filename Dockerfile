FROM python:3.12-slim

# Environment settings for leaner, predictable runtime
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

# System deps: libmagic is needed by python-magic
RUN apt-get update \
    && apt-get install -y --no-install-recommends libmagic1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies first for better layer caching
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the application
COPY . .

# Expose the app port (main.py defaults to 5001)
ENV PORT=5001
EXPOSE 5001

# Default: run the Flask app via main.py (debug True) to avoid HTTPS redirect loops in simple Docker runs
# For production, override the CMD with gunicorn (see README notes)
CMD ["python", "main.py"]