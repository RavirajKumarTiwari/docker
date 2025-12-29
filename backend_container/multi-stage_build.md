**Multi-Stage Builds in Docker (Node.js/Express Focus)**

**Purpose**
Reduce final image size by separating build environment from production runtime. Eliminates build tools, development dependencies, and unnecessary files from production image.

**Problem Statement**

**Single-Stage Dockerfile Issues**
```dockerfile
FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install  # Installs devDependencies + dependencies
COPY . .
EXPOSE 3000
CMD ["node", "server.js"]
```

Problems:
- Includes devDependencies (testing frameworks, TypeScript compiler, linters)
- npm cache remains in image layers
- Source files like .git, README, tests included
- Typical size: 200-300MB

**Solution: Multi-Stage Build**
```dockerfile
# Stage 1: Build
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .

# Stage 2: Production
FROM node:22-alpine
WORKDIR /app
COPY --from=builder /app /app
EXPOSE 3000
CMD ["node", "server.js"]
```

Typical size: 150-200MB (basic optimization)

**Core Multi-Stage Syntax**

**Stage Declaration**
```dockerfile
FROM node:22-alpine AS builder
```
- `AS builder` names the stage
- Reference later using `--from=builder`
- Naming convention: builder, deps, development, production

**Cross-Stage Copy**
```dockerfile
COPY --from=builder /source/path /destination/path
```
- `--from=builder` specifies source stage name
- Copies files from previous stage, not host filesystem
- Only mechanism to transfer artifacts between stages

**Basic Express.js Multi-Stage Example**

**Project Structure**
```
project/
├── server.js
├── package.json
└── Dockerfile
```

**server.js**
```javascript
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('Hello from Express');
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
```

**package.json**
```json
{
  "name": "express-app",
  "version": "1.0.0",
  "dependencies": {
    "express": "^4.18.0"
  },
  "devDependencies": {
    "nodemon": "^3.0.0",
    "jest": "^29.0.0"
  }
}
```

**Multi-Stage Dockerfile**
```dockerfile
# Stage 1: Build stage
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .

# Stage 2: Production stage
FROM node:22-alpine
WORKDIR /app
COPY --from=builder /app /app
ENV PORT=3000
EXPOSE 3000
CMD ["node", "server.js"]
```

**Build and Run**
```bash
docker build -t express:multistage .
docker run -p 3000:3000 express:multistage
```

**Optimized Multi-Stage Build**

**Better Production Dockerfile**
```dockerfile
# Build stage
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .

# Production stage
FROM node:22-alpine
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/server.js ./
COPY --from=builder /app/package.json ./
ENV PORT=3000
EXPOSE 3000
CMD ["node", "server.js"]
```

**Key improvements**:
- `npm ci --only=production` excludes devDependencies (nodemon, jest)
- Selective copy: only node_modules, server.js, package.json
- Excludes: tests, documentation, git files, development configs

**Size comparison**:
- With devDependencies: 180MB
- Production only: 150MB
- Savings: 30MB (16% reduction)

**Advanced Pattern: Separate Dependency Installation**

**Three-Stage Build**
```dockerfile
# Stage 1: Install all dependencies
FROM node:22-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

# Stage 2: Install production dependencies only
FROM node:22-alpine AS production-deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

# Stage 3: Production runtime
FROM node:22-alpine
WORKDIR /app
COPY --from=production-deps /app/node_modules ./node_modules
COPY server.js ./
ENV PORT=3000
EXPOSE 3000
CMD ["node", "server.js"]
```

**Why separate stages**:
- Stage 1 (deps): full dependencies for testing/building
- Stage 2 (production-deps): clean production install
- Stage 3: runtime with minimal footprint
- If running tests in CI, use --target=deps to stop at first stage

**TypeScript Express Application**

**Project Structure**
```
project/
├── src/
│   └── server.ts
├── package.json
├── tsconfig.json
└── Dockerfile
```

**Multi-Stage with TypeScript Compilation**
```dockerfile
# Stage 1: Build TypeScript
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# Stage 2: Production dependencies
FROM node:22-alpine AS production-deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

# Stage 3: Production runtime
FROM node:22-alpine
WORKDIR /app
COPY --from=production-deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY package.json ./
ENV PORT=3000
EXPOSE 3000
CMD ["node", "dist/server.js"]
```

**What gets excluded from final image**:
- TypeScript compiler (devDependency)
- Source .ts files (only compiled .js in dist/)
- tsconfig.json
- Type definition packages (@types/*)

**Size impact**: 220MB with TypeScript source → 160MB production

**Real-World Express API Multi-Stage**

**Complex Application Structure**
```
project/
├── src/
│   ├── routes/
│   ├── controllers/
│   ├── models/
│   └── server.js
├── tests/
├── .env.example
├── package.json
└── Dockerfile
```

**Production-Ready Dockerfile**
```dockerfile
# Build stage
FROM node:22-alpine AS builder
WORKDIR /app

# Copy dependency files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production && \
    npm cache clean --force

# Copy application source
COPY src ./src

# Production stage
FROM node:22-alpine

# Add non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

WORKDIR /app

# Copy dependencies and source from builder
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/src ./src
COPY --chown=nodejs:nodejs package.json ./

# Switch to non-root user
USER nodejs

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["node", "src/server.js"]
```

**Additional optimizations**:
- Non-root user for security
- `npm cache clean --force` removes npm cache from layer
- `--chown` sets correct permissions during copy
- `NODE_ENV=production` disables debug features

**Build Cache Optimization**

**Inefficient ordering**:
```dockerfile
FROM node:22-alpine AS builder
WORKDIR /app
COPY . .  # Copies everything, cache invalidated on any file change
RUN npm install
```

**Optimized ordering**:
```dockerfile
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./  # Only package files
RUN npm install  # Cached unless package.json changes
COPY . .  # Source files, frequently changing
```

**Layer caching logic**:
1. package.json unchanged → npm install cached → fast rebuild
2. package.json changed → npm install reruns → dependencies updated
3. Source code changed → only COPY . . reruns → dependencies still cached

**Targeted Build with --target**

```bash
# Build only first stage (for testing)
docker build --target builder -t express:test .

# Build complete multi-stage (production)
docker build -t express:production .
```

Use case: CI pipeline runs tests in builder stage, production deployment uses final stage.

**Common Node.js Multi-Stage Mistakes**

**Mistake 1: Not excluding devDependencies**
```dockerfile
# Wrong: includes testing frameworks, build tools
RUN npm install

# Correct: production dependencies only
RUN npm ci --only=production
```

**Mistake 2: Missing .dockerignore**
Without .dockerignore, `COPY . .` includes:
- node_modules/ (should be installed in container)
- .git/ (version control, unnecessary)
- tests/ (not needed in production)
- .env (secrets, should never be in image)

**.dockerignore contents**:
```
node_modules
.git
.gitignore
.env
.env.*
tests
*.test.js
coverage
.vscode
```

**Mistake 3: Copying entire builder stage**
```dockerfile
# Inefficient: copies everything including npm cache
COPY --from=builder /app /app

# Efficient: selective copy
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/src ./src
```

**Mistake 4: Running npm install in production stage**
```dockerfile
# Wrong: defeats multi-stage purpose
FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install  # Reinstalls everything

# Correct: copy from builder
COPY --from=builder /app/node_modules ./node_modules
```

**Multi-Stage Size Comparison (Real Express App)**

**Single-stage with all dependencies**:
- Base image: 140MB
- Dependencies (including dev): 60MB
- Application code: 5MB
- npm cache: 15MB
- Total: 220MB

**Multi-stage optimized**:
- Base image: 140MB
- Production dependencies only: 35MB
- Application code: 5MB
- Total: 180MB
- Reduction: 18%

**Multi-stage with distroless base**:
```dockerfile
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .

FROM gcr.io/distroless/nodejs22-debian12
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/src ./src
CMD ["src/server.js"]
```
- Total: 120MB
- Reduction: 45%

**Interview Critical Points**

- Multi-stage separates build environment from production runtime
- Each FROM starts new stage, previous stages discarded after copying needed files
- `--from=stagename` copies between stages, critical syntax
- `npm ci --only=production` excludes devDependencies (testing, build tools)
- Order matters: package.json before source code for cache optimization
- .dockerignore prevents copying unnecessary files (node_modules, .git, tests)
- Typical Node.js reduction: 15-25% for basic apps, 40-50% with compiled languages or distroless
- Production stage copies only node_modules and application code, excludes npm cache
- Multi-stage mandatory for TypeScript (compile in builder, copy dist/ to production)
- Stage naming (AS builder) improves readability, required for cross-stage copying

**When Multi-Stage Essential for Node.js**
- TypeScript or Babel compilation required
- Application has devDependencies (testing, linting, build tools)
- Using build steps (webpack, bundling)
- Security requirement: minimal production image surface

**When Single-Stage Acceptable**
- Simple scripts with zero devDependencies
- Development/debugging containers
- Proof of concept where size irrelevant

Multi-stage is production standard for Node.js applications, not optional.