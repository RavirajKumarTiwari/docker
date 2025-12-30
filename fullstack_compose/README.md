# Docker Compose - Multi-Container Orchestration

**What is Docker Compose**

Docker Compose is a tool for defining and running multi-container Docker applications. Instead of managing multiple containers individually with separate `docker run` commands, Compose uses a single YAML file to configure all application services, networks, and volumes.

**Problem Docker Compose Solves**

**Without Docker Compose**:
```bash
# Must run each container separately
docker run -d --name db -e POSTGRES_PASSWORD=secret postgres
docker run -d --name api --link db -p 3000:3000 api-image
docker run -d --name web --link api -p 80:80 web-image

# Must manually manage dependencies
# Must remember all flags and configurations
# Difficult to reproduce environment
# Hard to share with team
```

**With Docker Compose**:
```bash
# Single command starts entire stack
docker compose up

# All configuration in version-controlled file
# Reproducible across environments
# Easy team collaboration
```

## Architecture Context

Typical multi-container application:
```
Docker Host (single machine)
├── Frontend Container (nginx serving React/Vue)
├── Backend Container (Node.js/Python API)
├── Database Container (Postgres/MongoDB)
└── Shared Network (custom bridge)
```

All containers run on single Docker host. Docker Compose orchestrates startup order, networking, and volume management.

### Docker Compose File Structure

Docker Compose uses YAML (YAML Ain't Markup Language). Declarative syntax defining desired state, not procedural steps.

**Basic Structure**:
```yaml
version: "3.8"

services:
  # Container definitions

volumes:
  # Persistent storage definitions

networks:
  # Network definitions
```

**Version Numbers**: Compose file format version. Current: 3.8. Backward compatible, older files work with newer Docker Compose. Version determines available features.

**Key Sections**:
- `services`: Container definitions (required)
- `volumes`: Named volumes for data persistence (optional)
- `networks`: Custom networks for isolation (optional)

**Installation and Command Syntax**

**Modern Syntax (Current)**:
```bash
docker compose up    # New standard (space between docker and compose)
docker compose down
```

**Legacy Syntax (Older)**:
```bash
docker-compose up    # Old hyphenated command
docker-compose down
```

**Why Two Syntaxes Exist**:
- Old: `docker-compose` was standalone binary installed separately
- New: `docker compose` is Docker CLI plugin, installed with Docker Desktop automatically
- Both work on many systems, modern approach preferred

**Installation Status**:
- Docker Desktop (Mac/Windows): Includes `docker compose` by default
- Linux: May need manual installation via package manager

**Verification**:
```bash
docker compose version
# Output: Docker Compose version v2.x.x
```

## Complete Docker Compose Example (Full Stack Application)

**Project Structure**:
```
fullstack-docker/
├── docker-compose.yml
├── backend/
│   ├── Dockerfile
│   ├── package.json
│   ├── index.js
│   └── .dockerignore
└── frontend/
    ├── Dockerfile
    ├── package.json
    ├── src/
    └── .dockerignore
```

## docker-compose.yml (Complete File)
```yaml
version: "3.8"

services:
  database:
    image: postgres:16-alpine
    restart: always
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: postgres
    volumes:
      - pgdata:/var/lib/postgresql/data
    networks:
      - my-custom-network

  backend:
    build: ./backend
    ports:
      - "5001:5000"
    environment:
      DB_HOST: database
      DB_USER: postgres
      DB_PASSWORD: postgres
      DB_NAME: postgres
    depends_on:
      - database
    networks:
      - my-custom-network

  frontend:
    build: ./frontend
    ports:
      - "3000:80"
    depends_on:
      - backend
    networks:
      - my-custom-network

volumes:
  pgdata:

networks:
  my-custom-network:
    driver: bridge
```

### Understanding Each Service

**Database Service (Using Pre-built Image)**

```yaml
database:
  image: postgres:16-alpine
  restart: always
  environment:
    POSTGRES_USER: postgres
    POSTGRES_PASSWORD: postgres
    POSTGRES_DB: postgres
  volumes:
    - pgdata:/var/lib/postgresql/data
  networks:
    - my-custom-network
```

**Line-by-Line Breakdown**:

**`database:`** - Service name (user-defined). Other services reference this name. Becomes hostname within Docker network.

**`image: postgres:16-alpine`** - Uses pre-built image from Docker Hub. Format: `image:tag`. Alpine variant is minimal Linux distribution, smaller image size.

**`restart: always`** - Restart policy. Options:
- `no`: Never restart (default)
- `always`: Always restart regardless of exit status
- `on-failure`: Restart only if container exits with error
- `unless-stopped`: Restart unless manually stopped

Databases should use `always` because they require restart after initialization.

**`environment:`** - Environment variables passed to container. Postgres requires:
- `POSTGRES_USER`: Database superuser name
- `POSTGRES_PASSWORD`: Superuser password (required, no default)
- `POSTGRES_DB`: Database name to create on initialization

Environment variables specific to each image. Check Docker Hub documentation for required variables.

**`volumes:`** - Mount named volume for data persistence.
```yaml
- pgdata:/var/lib/postgresql/data
```
Format: `volume_name:container_path`
- `pgdata`: Named volume (defined in top-level `volumes` section)
- `/var/lib/postgresql/data`: Default Postgres data directory

Without volume, database data lost when container stops. Volume persists data on host filesystem.

**`networks:`** - Attaches service to custom network.
```yaml
- my-custom-network
```
Array syntax (dash prefix) allows multiple networks. Services on same network can communicate using service names as hostnames.

### Backend Service (Building from Dockerfile)

```yaml
backend:
  build: ./backend
  ports:
    - "5001:5000"
  environment:
    DB_HOST: database
    DB_USER: postgres
    DB_PASSWORD: postgres
    DB_NAME: postgres
  depends_on:
    - database
  networks:
    - my-custom-network
```

**`build: ./backend`** - Build image from Dockerfile in specified directory. Compose looks for `Dockerfile` in `./backend/`.

Alternative syntax for build options:
```yaml
build:
  context: ./backend
  dockerfile: Dockerfile.dev
  args:
    NODE_ENV: production
```

**`ports:`** - Port mapping for external access.
```yaml
- "5001:5000"
```
Format: `"host_port:container_port"`
- `5001`: Port on host machine (accessible externally)
- `5000`: Port inside container (application listens here)

Quotes required to prevent YAML parsing `5001:5000` as time format.

**`environment:`** - Application configuration variables.
```yaml
DB_HOST: database
```
`database` is service name from compose file. Docker's embedded DNS resolves `database` to container's IP address. Backend connects to Postgres using `database:5432`.

**Why Service Name Works as Hostname**: Docker Compose creates custom bridge network with DNS. All services on same network can resolve other service names.

**`depends_on:`** - Defines startup order.
```yaml
depends_on:
  - database
```

Ensures `database` container starts before `backend`. Critical for applications requiring database on startup.

**Limitation**: `depends_on` only waits for container start, not application readiness. Database container may be running but Postgres not ready to accept connections. Advanced: use health checks or wait scripts.

### Frontend Service (Multi-Stage Build)

```yaml
frontend:
  build: ./frontend
  ports:
    - "3000:80"
  depends_on:
    - backend
  networks:
    - my-custom-network
```

**`ports: "3000:80"`** - Frontend served by nginx (listens on port 80 inside container), accessible on host port 3000.

**`depends_on: backend`** - Frontend requires backend API. Starts after backend container running.

**Dependency Chain**: Compose resolves dependency tree:
1. `frontend` depends on `backend`
2. `backend` depends on `database`
3. Startup order: `database` → `backend` → `frontend`

No need to specify `frontend` depends on `database`. Compose automatically determines complete dependency graph.

### Backend Dockerfile Example

```dockerfile
FROM node:22-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

EXPOSE 5000

CMD ["npm", "start"]
```

Standard Node.js containerization. Application listens on port 5000, connects to Postgres using environment variables from Compose.

**Backend Application Code (index.js snippet)**:
```javascript
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST,      // 'database' from compose
  user: process.env.DB_USER,      // 'postgres'
  password: process.env.DB_PASSWORD,  // 'postgres'
  database: process.env.DB_NAME,  // 'postgres'
  port: 5432
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
```

Environment variables injected by Docker Compose. Application connects to `database:5432` (service name resolves via DNS).

**Frontend Dockerfile Example (Multi-Stage Build)**

```dockerfile
# Build stage
FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

RUN npm run build

# Serve stage
FROM nginx:alpine

COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
```

**Multi-stage benefits**:
- Build stage: Compiles frontend (React/Vue) to static files (HTML/CSS/JS)
- Serve stage: nginx serves compiled files, no Node.js in final image
- Final image smaller, more secure (no build tools in production)

**Build output location**:
- Vite: `dist/` directory
- Create React App: `build/` directory
- Adjust `COPY --from=builder` path accordingly

**Volumes Section**

```yaml
volumes:
  pgdata:
```

**Named volume declaration**: Creates Docker-managed volume named `pgdata`. Docker stores volume data in `/var/lib/docker/volumes/` on host (Linux) or Docker Desktop VM (Mac/Windows).

**Why Named Volumes**:
- Data persists across container restarts and removals
- Managed by Docker (automatic cleanup, backup capabilities)
- Shared between containers if needed

**Alternative: Bind Mounts**:
```yaml
volumes:
  - ./data:/var/lib/postgresql/data
```
Mounts host directory `./data` directly. Less portable, useful for development when you want direct file access.

**Volume Usage in Service**:
```yaml
services:
  database:
    volumes:
      - pgdata:/var/lib/postgresql/data
```

Links named volume `pgdata` to container path `/var/lib/postgresql/data`. All database writes persist in volume.

**Networks Section**

```yaml
networks:
  my-custom-network:
    driver: bridge
```

**Custom bridge network**: Provides DNS resolution between services. Services reference each other by service name (e.g., `database`, `backend`).

**Why Custom Network**:
- Automatic DNS resolution (default bridge lacks this)
- Network isolation from other Compose projects
- Can configure subnet, gateway if needed

**Default Behavior**: If no networks defined, Compose creates default network for project. Explicit network definition allows multi-network setups.

### Advanced network configuration**:
```yaml
networks:
  my-custom-network:
    driver: bridge
    ipam:
      config:
        - subnet: 172.28.0.0/16
          gateway: 172.28.0.1
```

## Docker Compose Commands

**Start Services**:
```bash
docker compose up
```
Builds images (if needed), creates networks and volumes, starts all containers in foreground (logs visible).

**Start in Detached Mode**:
```bash
docker compose up -d
```
Runs containers in background. Frees terminal.

**Build and Start**:
```bash
docker compose up --build
```
Forces image rebuild before starting. Use when Dockerfile or source code changed.

**Stop Services**:
```bash
docker compose down
```
Stops and removes containers, networks. Preserves volumes and images.

**Stop and Remove Volumes**:
```bash
docker compose down -v
```
Removes volumes too. Deletes all data (databases wiped). Use cautiously.

**View Running Services**:
```bash
docker compose ps
```
Lists containers managed by Compose file in current directory.

**View Logs**:
```bash
docker compose logs
docker compose logs backend     # Logs from specific service
docker compose logs -f          # Follow mode (live logs)
```

**Restart Services**:
```bash
docker compose restart
docker compose restart backend  # Restart specific service
```

**Execute Command in Running Container**:
```bash
docker compose exec backend sh
docker compose exec database psql -U postgres
```

**Build Images Without Starting**:
```bash
docker compose build
```

**Pull Latest Images**:
```bash
docker compose pull
```

## Execution Flow When Running `docker compose up`

**Step-by-Step Process**:

1. **Parse docker-compose.yml**: Reads configuration, validates syntax
2. **Build Dependency Graph**: Determines startup order from `depends_on`
3. **Create Networks**: Creates `my-custom-network` bridge
4. **Create Volumes**: Creates `pgdata` volume if doesn't exist
5. **Pull/Build Images**:
   - Pulls `postgres:16-alpine` from Docker Hub
   - Builds `backend` image from `./backend/Dockerfile`
   - Builds `frontend` image from `./frontend/Dockerfile`
6. **Start Containers in Order**:
   - Starts `database` container
   - Waits for database container to start
   - Starts `backend` container
   - Waits for backend container to start
   - Starts `frontend` container
7. **Attach Networks**: Connects each container to `my-custom-network`
8. **Mount Volumes**: Mounts `pgdata` to database container
9. **Set Environment Variables**: Injects env vars into each container
10. **Expose Ports**: Maps host ports to container ports
11. **Stream Logs**: Displays logs from all containers (if not detached)

**Container Startup Sequence**:
```
database container starting...
database: PostgreSQL init process complete; ready for start up
backend container starting...
backend: Server running on port 5000
backend: Connected to database
frontend container starting...
frontend: nginx started
```

**Viewing in Docker Desktop**

After `docker compose up`, Docker Desktop shows:
- **Containers view**: Single project folder containing all services
- **Project name**: Derived from directory name (e.g., `fullstack-docker`)
- **Services**: database, backend, frontend (green dot = running)
- **Volumes**: `fullstack-docker_pgdata` (prefixed with project name)
- **Networks**: `fullstack-docker_my-custom-network`
- **Images**: Three images listed (postgres:16-alpine, fullstack-docker-backend, fullstack-docker-frontend)

Click project to see:
- Individual container logs
- Resource usage (CPU, memory)
- Inspect configurations
- Terminal access

**Persistent Volumes in Detail**

**Volume Data Location**:
Docker manages volume storage. Inspect volume:
```bash
docker volume inspect fullstack-docker_pgdata
```

Output:
```json
{
  "Name": "fullstack-docker_pgdata",
  "Mountpoint": "/var/lib/docker/volumes/fullstack-docker_pgdata/_data"
}
```

**Volume Contents**: Contains Postgres data files:
```
_data/
├── base/          # Database files
├── global/        # Cluster-wide tables
├── pg_wal/        # Write-ahead logs
├── pg_stat/       # Statistics
└── postgresql.conf
```

**Accessing Volume Data**:
```bash
# List volume contents (via temporary container)
docker run --rm -v fullstack-docker_pgdata:/data alpine ls -la /data
```

**Volume Persistence**:
- Survives `docker compose down`
- Survives container removal
- Only deleted with `docker compose down -v` or `docker volume rm`

**Data Lifecycle**:
1. First `docker compose up`: Volume created, Postgres initializes database
2. Subsequent runs: Volume reused, data persists
3. `docker compose down`: Containers removed, volume remains
4. Next `docker compose up`: Reattaches to existing volume, data intact

## Environment Variables in Depth

**Passing Environment Variables**:

### Method 1: Direct in Compose File:
```yaml
environment:
  DB_HOST: database
  DB_USER: postgres
```

### Method 2: Environment File:
```yaml
env_file:
  - ./backend/.env
```

`.env` file contents:
```
DB_HOST=database
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=postgres
```

### Method 3: Shell Variable Substitution:
```yaml
environment:
  DB_PASSWORD: ${POSTGRES_PASSWORD}
```

Reads from host environment or `.env` file in project root.

**Environment Variable Usage in Application**:
```javascript
// Backend reads environment variables
const dbHost = process.env.DB_HOST;      // 'database'
const dbUser = process.env.DB_USER;      // 'postgres'
```

## Security Best Practice:
Never commit passwords to version control. Use `.env` files (add to `.gitignore`):
```
# .gitignore
.env
```

## Service Name as Hostname

**How DNS Resolution Works**:

Services on same custom bridge network resolve each other by service name:
```yaml
services:
  database:  # Hostname: 'database'
  backend:   # Hostname: 'backend'
  frontend:  # Hostname: 'frontend'
```

**In Backend Code**:
```javascript
// Connect to database using service name
const pool = new Pool({
  host: 'database',  // Resolves to database container IP
  port: 5432
});
```

**In Frontend Code**:
```javascript
// API calls to backend
fetch('http://backend:5000/api/data')
```

**Behind the Scenes**:
1. Backend container queries Docker's embedded DNS (127.0.0.11)
2. DNS returns IP of `database` container (e.g., 172.28.0.2)
3. Backend connects to 172.28.0.2:5432

**Verification**:
```bash
# Enter backend container
docker compose exec backend sh

# Ping database by name
ping database
# PING database (172.28.0.2): 56 data bytes
```

**Port Mapping vs Internal Communication**

**External Access (Port Mapping)**:
```yaml
ports:
  - "3000:80"
```
Host machine accesses frontend via `localhost:3000`. External users access via `<host-ip>:3000`.

**Internal Communication (No Port Mapping Needed)**:
```yaml
# database service has NO ports section
# backend accesses database via internal network
```

Backend connects to `database:5432` directly. No port exposure to host. Database isolated, accessible only within Docker network.

**Architecture**:
```
External User → localhost:3000 → frontend:80 (nginx)
                                      ↓
                       Internal: frontend → backend:5000
                                               ↓
                              Internal: backend → database:5432
```

Only frontend exposed externally. Backend and database internal-only (security best practice).

**Restart Policies**

**Why `restart: always` for Database**:

Postgres initialization process:
1. Container starts
2. Postgres initializes data directory
3. Postgres starts, then exits
4. Container must restart for Postgres to run normally

Without `restart: always`, container would exit after initialization, database unavailable.

**Restart Policy Options**:
- `no`: Never restart (default, containers stop when application exits)
- `always`: Always restart, even after manual stop (requires `docker stop` to override)
- `on-failure`: Restart only if exit code non-zero (error)
- `unless-stopped`: Restart unless manually stopped with `docker stop`

**Production recommendation**: `unless-stopped` (prevents unwanted restarts after manual intervention).

**Dependency Management and Startup Order**

**`depends_on` Limitation**:
```yaml
depends_on:
  - database
```

Only waits for container start, not application readiness. Database container running doesn't mean Postgres accepting connections.

**Problem Scenario**:
1. Database container starts
2. Backend container starts immediately
3. Backend tries connecting to Postgres
4. Postgres still initializing → connection fails

**Solutions**:

**Solution 1: Application Retry Logic**:
```javascript
const connectWithRetry = async () => {
  try {
    await pool.connect();
    console.log('Connected to database');
  } catch (err) {
    console.log('Database not ready, retrying...');
    setTimeout(connectWithRetry, 5000);
  }
};
```

**Solution 2: Health Checks (Compose v3.9+)**:
```yaml
database:
  image: postgres:16-alpine
  healthcheck:
    test: ["CMD-SHELL", "pg_isready -U postgres"]
    interval: 10s
    timeout: 5s
    retries: 5

backend:
  depends_on:
    database:
      condition: service_healthy
```

Backend waits until database health check passes.

**Solution 3: Wait Scripts**:
```yaml
backend:
  command: sh -c "sleep 10 && npm start"
```
Crude but simple. Waits 10 seconds before starting.

## YAML Syntax Essentials

### Indentation (Critical):
YAML uses spaces for structure. Tabs invalid. Standard: 2 spaces per level.

```yaml
services:       # Level 0
  backend:      # Level 1 (2 spaces)
    image: node # Level 2 (4 spaces)
```

### Data Types

**String**:
```yaml
name: backend
name: "backend"  # Quotes optional unless special characters
```

**Number**:
```yaml
port: 5000
```

**Boolean**:
```yaml
restart: true
```

**Array (List)**:
```yaml
# Method 1: Dash syntax
ports:
  - "3000:80"
  - "3001:81"

# Method 2: Inline
ports: ["3000:80", "3001:81"]
```

**Object (Map)**:
```yaml
environment:
  DB_HOST: database
  DB_USER: postgres
```

**Multi-line String**:
```yaml
description: |
  This is a
  multi-line
  description
```

**Comments**:
```yaml
# This is a comment
services:  # Inline comment
```

## Common YAML Mistakes:

**Mistake 1: Inconsistent Indentation**:
```yaml
# Wrong
services:
  backend:
    image: node
   ports:  # 3 spaces instead of 4
```

**Mistake 2: Missing Colon**:
```yaml
# Wrong
environment
  DB_HOST: database

# Correct
environment:
  DB_HOST: database
```

**Mistake 3: Quoting Issues**:
```yaml
# Wrong (YAML parses as time)
ports:
  - 3000:80

# Correct
ports:
  - "3000:80"
```

## Advanced Docker Compose Patterns

**Multiple Networks (Network Segmentation)**:
```yaml
networks:
  frontend-tier:
    driver: bridge
  backend-tier:
    driver: bridge

services:
  web:
    networks:
      - frontend-tier
  
  api:
    networks:
      - frontend-tier
      - backend-tier
  
  database:
    networks:
      - backend-tier
```

Web cannot directly access database (security). API bridges both networks.

**Multiple Volumes**:
```yaml
volumes:
  pgdata:
  uploads:
  logs:

services:
  backend:
    volumes:
      - uploads:/app/uploads
      - logs:/app/logs
```

**Environment File per Service**:
```yaml
services:
  backend:
    env_file:
      - ./backend/.env
      - ./backend/.env.production
```

Later files override earlier ones.

**Build Arguments**:
```yaml
services:
  backend:
    build:
      context: ./backend
      args:
        NODE_ENV: production
        API_VERSION: v2
```

Access in Dockerfile:
```dockerfile
ARG NODE_ENV
RUN echo "Building for $NODE_ENV"
```

**Resource Limits**:
```yaml
services:
  backend:
    deploy:
      resources:
        limits:
          cpus: '0.5'
          memory: 512M
```

**Profiles (Conditional Services)**:
```yaml
services:
  database:
    # Always starts
  
  backend:
    # Always starts
  
  adminer:
    image: adminer
    profiles:
      - debug
```

Start with profile: `docker compose --profile debug up`

## Interview Critical Points

- Docker Compose orchestrates multi-container applications via single YAML file
- `services` section defines containers, `volumes` for persistence, `networks` for isolation
- Modern syntax: `docker compose` (space), legacy: `docker-compose` (hyphen)
- `image` for pre-built images, `build` for Dockerfile-based builds
- Service names become DNS-resolvable hostnames within custom networks
- `depends_on` controls startup order, not application readiness
- `restart: always` critical for databases (initialization requires restart)
- Port mapping format: `"host:container"`, quotes prevent YAML time parsing
- Environment variables: direct declaration, env_file, or shell substitution
- Named volumes persist data across container lifecycle, only removed with `-v` flag
- Custom bridge networks provide automatic DNS, default bridge does not
- `docker compose up` builds/pulls images, creates networks/volumes, starts containers in dependency order
- `docker compose down` stops and removes containers/networks, preserves volumes and images
- YAML indentation crucial, standard 2 spaces per level, tabs invalid
- Multiple services can share volumes or networks for data sharing or communication
- Database container has no port mapping (internal access only), frontend has port mapping (external access)
- Project name derived from directory name, prefixes all resources
- Health checks enable waiting for application readiness, not just container start
- Volumes stored in Docker-managed location, inspect with `docker volume inspect`

## Common Use Cases

**Development Environment**: Full stack with database, API, frontend, all networked.

**Microservices Local Testing**: Multiple services communicating via internal network, single command start.

**CI/CD Integration**: Consistent test environment, `docker compose up` in pipeline.

**Database Prototyping**: Quick database spin-up without local installation, volume persistence across restarts.

**Learning and Experimentation**: Complex architectures without infrastructure complexity.

Docker Compose is developer-centric tool for single-host multi-container orchestration. For production multi-host deployments, Kubernetes or Docker Swarm required. Compose primary use: development, testing, simple production on single machine.