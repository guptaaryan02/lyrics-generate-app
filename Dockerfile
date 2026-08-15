# Stage 1: Build the frontend
FROM node:20 AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# Stage 2: Setup Python Backend
FROM python:3.11-slim
WORKDIR /app

# Install backend dependencies
COPY backend/requirements.txt ./backend/
RUN pip install --no-cache-dir -r backend/requirements.txt

# Copy backend code
COPY backend/ ./backend/

# Copy built frontend from Stage 1
COPY --from=frontend-builder /app/frontend/out ./frontend/out

# Hugging Face Spaces require running as a non-root user with UID 1000
RUN useradd -m -u 1000 user

# Give the non-root user permissions to the app directory so they can write to OutputProject
RUN chown -R user:user /app

# Switch to the non-root user
USER user

# Set environment variables for the application
ENV HOST=0.0.0.0
ENV PORT=7860

# Expose the required Hugging Face port
EXPOSE 7860

# Start the FastAPI server
CMD ["uvicorn", "backend.api.main:app", "--host", "0.0.0.0", "--port", "7860"]
