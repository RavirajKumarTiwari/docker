# Part 9: Containerizing a Node.js Backend

### 1 Goal & Context

*   Build a simple **Express** server and package it into a **Docker image**.
*   Understand **Dockerfile** structure, **port binding**, **environment variables**, and **container lifecycle**.
*   Learn **production‑grade additions** (healthchecks, non‑root user, multi‑stage builds, .dockerignore).

***

## 2 Minimal Node/Express App (index.js)

**Initialize & install:**

```bash
npm init -y
npm install express
```

```javascript
// index.js
const express = require('express');
const app = express();

// Use PORT from environment or default 3000
const PORT = process.env.PORT || 3000;

// Basic route
app.get('/', (req, res) => {
  res.send('Hello world from a dockerized app');
});

app.listen(PORT, () => {
  console.log(`Example app listening on port ${PORT}`);
});
```

**Optional package.json script:**

```json
{
  "scripts": {
    "start": "node index.js"
  }
}
```

***

## 3 .dockerignore (avoid copying junk into images)

```text
# Do not bake these into the image
node_modules
npm-debug.log
Dockerfile
.dockerignore
.git
.gitignore
.env
```

**Why?**

*   Reduces build context size.
*   Prevents accidental exposure of secrets.
*   Ensures dependencies are installed fresh in the image (not copied from host).

***

## 4 Dockerfile (Simple, Developer-Friendly)

```dockerfile
# Use an official Node.js runtime as a parent image
FROM node:22-alpine

# Set the working directory in the container
WORKDIR /app

# Copy package.json and package-lock.json to the working directory
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application code to the working directory
COPY . .

# Expose the port the app runs on
ENV PORT=3000

# Start the application
CMD ["node", "index.js"]
```

**Key points:**

*   **COPY package*.json*\* + **RUN npm install** before **COPY . .** leverages **layer caching** effectively.
*   **RUN** runs at **image build time**; **CMD** runs at **container runtime**.
*   **EXPOSE** is documentation; port is published via `docker run -p`.

***

## 5 Build & Run

**Build:**

```bash
docker build -t express-app .
```

**Run with host port 4000 → container port 3000:**

```bash
docker run --rm -p 4000:3000 express-app
```

*   Visit: `http://localhost:4000/`

**Run with environment variable (inline):**

```bash
docker run --rm -p 4000:3000 -e PORT=3000 express-app
```

**Run with env-file (recommended for multiple values):**

```bash
# .env
PORT=3000
# ... other values

docker run --rm -p 4000:3000 --env-file .env express-app
```

**Detached mode:**

```bash
docker run -d --name api --env-file .env -p 4000:3000 express-app
```

**Logs & stop:**

```bash
docker logs -f api
docker stop api
```

***

## 6 Frequently Used Options

*   `-p HOST:CONTAINER` → **port binding** to expose service.
*   `-e KEY=VALUE` / `--env-file` → inject **environment variables** at runtime.
*   `--rm` → remove container on exit (keeps system clean).
*   `--name api` → name your container (easier operations).
*   `-d` → run **detached** in background.

***

## 7 Production-Grade Enhancements

### A Healthcheck in Dockerfile

*   Helps orchestration layers (K8s, Swarm) decide if a container is **healthy**.

```dockerfile
# Add after COPY . .
RUN apk add --no-cache curl

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD curl -f http://localhost:3000/ || exit 1
```

### B Non-Root User (security hardening)

```dockerfile
# Create a non-root user and switch to it
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser
```

> You’ll need to ensure file permissions allow this user to run the app (e.g., `chown -R appuser:appgroup /app` if needed).

### C Multi-Stage Build (for frameworks that need build step)

*   If you have TypeScript or a bundling step, build in one stage, copy only the final outputs:

```dockerfile
# ----- Build stage -----
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build   # produces dist/

# ----- Runtime stage -----
FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist

EXPOSE 3000
CMD ["node", "dist/index.js"]
```

**Benefits:**

*   Smaller final image.
*   No dev dependencies in runtime layer.
*   Faster start, fewer attack surface areas.

***

## 8 Volumes vs Bind Mounts

*   **Bind mount** (dev convenience): map current directory to container for hot reload.

```bash
docker run --rm -it -p 4000:3000 -v $(pwd):/app express-app sh
# install nodemon and run inside container for live dev
```

*   **Named volume** (data persistence): good for databases, not typical for stateless node services.

```bash
docker volume create appdata
docker run -d -p 4000:3000 -v appdata:/app/data express-app
```

***

## 9 Troubleshooting Patterns

*   **App not accessible on host:**
    *   Verify `docker run -p HOST:CONTAINER` ports.
    *   Ensure the app listens on `0.0.0.0` (not `127.0.0.1`) when inside a container.

*   **ENV not applied:**
    *   Check `docker run -e PORT=...` or `--env-file`.
    *   Ensure your app uses `process.env.PORT`.

*   **Slow rebuilds:**
    *   Confirm Dockerfile instruction order uses caching effectively (copy manifests before source).

*   **Permission errors with non-root user:**
    *   Adjust ownership (`chown`) or run `npm install` before switching user.

***

## 10 Interview Q\&A

**Q1. What’s the difference between `RUN` and `CMD` in a Dockerfile?**

*   **RUN** executes during **image build** (creates a new image layer).
*   **CMD** defines the **default command** executed **when the container starts**.

**Q2. How do you pass environment variables to a container?**

*   Inline with `-e KEY=VALUE`, or via `--env-file .env`.
*   Alternatively, bake defaults into the image using `ENV KEY=VALUE`, but prefer runtime injection for flexibility.

**Q3. Why use `.dockerignore`?**

*   To reduce build context, speed up builds, keep images small, and avoid copying secrets or transient files (e.g., `node_modules`, `.git`, `.env`).

**Q4. What are best practices for Node images in production?**

*   Pin base image versions (e.g., `node:22-alpine`).
*   Use **multi-stage builds** to exclude dev deps.
*   Run as **non-root**.
*   Add **HEALTHCHECK**.
*   Avoid `latest` tag in prod; version your images (e.g., `express-app:1.2.0`).

**Q5. How do you expose a service to the host?**

*   Use `-p HOST_PORT:CONTAINER_PORT` in `docker run`.
*   `EXPOSE` in Dockerfile is documentation only.

***

## 11 Ready-to-Use Command Set (Cheat Sheet)

```bash
# Build
docker build -t express-app .

# Run (inline env)
docker run --rm -p 4000:3000 -e PORT=3000 express-app

# Run (env-file)
docker run --rm -p 4000:3000 --env-file .env express-app

# Detached, named, view logs
docker run -d --name api -p 4000:3000 --env-file .env express-app
docker logs -f api

# Stop & cleanup
docker stop api
docker rm api
docker system prune -f           # caution: cleans stopped containers, dangling images etc.
```
[Multi-Stage Build Notes](./multi-stage_build.md)