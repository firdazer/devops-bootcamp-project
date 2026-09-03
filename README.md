# DevOps Bootcamp Project

**Public Access:**
- App (node1): `https://webserver.artdevops.com` — Webserver
- Monitoring (node3): `https://monitoringserver.artdevops.com` — Grafana Dashboard

A full-stack DevOps infrastructure project deploying a Three.js 3D spaceship microservice on AWS, automated with Terraform, Ansible, Docker, and GitHub Actions.

---

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Directory Structure](#directory-structure)
- [AWS Infrastructure (Terraform)](#aws-infrastructure-terraform)
  - [Provider & State Backend](#provider--state-backend)
  - [VPC & Networking](#vpc--networking)
  - [EC2 Instances](#ec2-instances)
  - [Security Groups](#security-groups)
  - [ECR — Container Registry](#ecr--container-registry)
  - [S3 — State Bucket](#s3--state-bucket)
- [CI/CD Pipeline (GitHub Actions)](#cicd-pipeline-github-actions)
- [Configuration Management (Ansible)](#configuration-management-ansible)
  - [Ansible Configuration](#ansible-configuration)
  - [Inventory](#inventory)
  - [Playbooks](#playbooks)
- [Application](#application)
  - [Tech Stack](#tech-stack)
  - [Dockerfile](#dockerfile)
  - [3D Scene & Ship Config](#3d-scene--ship-config)
- [Monitoring Stack](#monitoring-stack)
- [Security](#security)
- [Network Topology](#network-topology)

---

## Architecture Overview

```
                    ┌─────────────────────────────────┐
                    │           GitHub                 │
                    │  Source: main branch             │
                    │  Secrets: AWS credentials        │
                    └───────────────┬─────────────────┘
                                    │ push to main (app/**)
                                    ▼
                    ┌─────────────────────────────────┐
                    │   GitHub Actions Workflow        │
                    │   docker-ecr.yml                 │
                    │   1. Checkout                    │
                    │   2. Build Docker image          │
                    │   3. Push to ECR                 │
                    └───────────────┬─────────────────┘
                                    │ push image
                                    ▼
               ┌────────────────────────────────────────────┐
               │           AWS ECR Repository                │
               │   devops-bootcamp-project/app               │
               │   Lifecycle: untagged 7d, keep last 10      │
               └───────────────┬────────────────────────────┘
                               │ pull image
                               ▼
┌──────────────────────────────────────────────────────────────────┐
│                    AWS VPC (10.0.0.0/16)                         │
│                                                                  │
│  ┌────────────────────────────┐  ┌────────────────────────────┐ │
│  │  PUBLIC SUBNET             │  │  PRIVATE SUBNET             │ │
│  │  10.0.0.0/24               │  │  10.0.1.0/24                │ │
│  │                            │  │                             │ │
│  │  ┌──────────────────────┐  │  │  ┌───────────────────────┐  │ │
│  │  │  node1: webserver    │  │  │  │  node2: controller    │  │ │
│  │  │  - App (Nginx :80)   │  │  │  │  - GitHub Actions    │  │ │
│  │  │  - Cloudflare tunnel │──┼──┼──│    self-hosted runner  │  │ │
│  │  │  - node_exporter     │  │  │  │  - Ansible & Terraform│  │ │
│  │  └──────────────────────┘  │  │  └───────────────────────┘  │ │
│  │                            │  │  ┌───────────────────────┐  │ │
│  │                            │  │  │  node3: monitoring    │  │ │
│  │                            │  │  │  - Prometheus (:9090) │  │ │
│  │                            │  │  │  - Grafana (:3000)    │  │ │
│  │                            │  │  │  - node_exporter      │  │ │
│  │                            │  │  │  - Cloudflare tunnel  │  │ │
│  │                            │  │  └───────────────────────┘  │ │
│  └────────────────────────────┘  └────────────────────────────┘ │
│                                                                  │
│  Internet Gateway ◄──────────── public subnet egress             │
│  NAT Gateway     ◄──────────── private subnet egress             │
└──────────────────────────────────────────────────────────────────┘
                               │
                               ▼
               ┌────────────────────────────────┐
               │   S3 Bucket                     │
               │   devops-bootcamp-project-      │
               │   firdazer                      │
               │   - Terraform state             │
               │   - Versioned + encrypted       │
               └────────────────────────────────┘
```

---

## Directory Structure

```
devops-bootcamp-project/
├── .github/
│   └── workflows/
│       └── docker-ecr.yml              # CI/CD pipeline
├── ansible/
│   ├── ansible.cfg                     # Ansible settings
│   ├── inventory.ini                   # Host inventory (3 nodes)
│   ├── requirements.yml                # Galaxy roles & collections
│   ├── first-playbook.yml              # Initial bootstrap
│   ├── docker-install.yml              # Deploy app to node1
│   ├── github-runner.yml               # Self-hosted runner on node2
│   ├── monitoring.yml                  # Prometheus + Grafana on node3
│   ├── cloudflare-tunnel.yml           # Tunnel for node1 (app)
│   ├── cloudflare-tunnel-monitoring.yml# Tunnel for node3 (Grafana)
│   └── grafana-dashboards/
│       └── nodes.json                  # Pre-built Grafana dashboard
├── app/
│   ├── Dockerfile                      # Multi-stage build
│   ├── package.json                    # Vite + Three.js
│   ├── index.html                      # SPA entry
│   ├── vite.config.js                  # Build config
│   ├── ship.config.json                # Ship customization
│   ├── scripts/
│   │   └── preflight.mjs              # CI/CD config validator
│   ├── src/
│   │   ├── main.js                     # App entrypoint
│   │   ├── scene.js                    # Three.js 3D scene
│   │   ├── config.js                   # Ship config reader
│   │   └── ...                         # Other modules
│   └── public/
│       ├── fighter.glb                 # 3D ship models
│       ├── interceptor.glb
│       ├── hauler.glb
│       └── scout.glb
└── terraform/
    └── aws/                            # Main Terraform config
        ├── provider.tf                 # AWS provider + S3 backend
        ├── network.tf                  # VPC, subnets, IGW, NAT
        ├── ec2.tf                      # 3 EC2 instances
        ├── ecr.tf                      # ECR repository
        ├── s3.tf                       # S3 bucket
        ├── security.tf                 # Security groups
        ├── variables.tf                # Input variables
        └── Firdazer-keypair.pem        # SSH key
```

---

## AWS Infrastructure (Terraform)

All infrastructure is defined in `terraform/aws/` using the **HashiCorp AWS provider ~> 6.0** with Terraform >= 1.15. The project region is **ap-southeast-1** (Singapore).

### Provider & State Backend

**File:** `terraform/aws/provider.tf`

```hcl
terraform {
  required_version = ">= 1.15"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
  }
  backend "s3" {
    bucket       = "devops-bootcamp-project-firdazer"
    key          = "s3bucket/terraform1.tfstate"
    region       = "ap-southeast-1"
    use_lockfile = true
  }
}
provider "aws" {
  region = "ap-southeast-1"
}
```

- **Remote state**: Stored in S3 with file-based locking (`use_lockfile = true`) to prevent concurrent `terraform apply` conflicts
- **`aws_caller_identity`** data source exposes the current AWS account ID for reference

### VPC & Networking

**File:** `terraform/aws/network.tf`

Uses the community module `terraform-aws-modules/vpc/aws ~> 6.0`:

| Component | CIDR | Purpose |
|-----------|------|---------|
| VPC `tf-vpc` | `10.0.0.0/16` | Isolated network boundary |
| Public Subnet | `10.0.0.0/24` | Hosts node1 (webserver) |
| Private Subnet | `10.0.1.0/24` | Hosts node2 (controller) + node3 (monitoring) |
| Internet Gateway | — | Gives public subnet internet access |
| NAT Gateway | — | Gives private subnet outbound-only internet |
| NAT Elastic IP | — | Static public IP for the NAT Gateway |

**Route tables:**

| Route | Destination | Target |
|-------|-------------|--------|
| Public | `0.0.0.0/0` | Internet Gateway |
| Private | `0.0.0.0/0` | NAT Gateway |

The public subnet has `map_public_ip_on_launch = true` so instances automatically receive a public IP. The NAT Gateway allows private subnet instances to pull packages (apt, Docker images) from the internet without being directly reachable from outside.

### EC2 Instances

**File:** `terraform/aws/ec2.tf`

All instances share:
- **AMI**: Ubuntu 24.04 Noble (latest, from Canonical `099720109477`)
- **Type**: `t3.micro` (2 vCPU, 1 GB RAM — burstable)
- **Root volume**: 16 GB
- **IAM profile**: `EC2-Devops` (for ECR/S3 access)
- **SSH key**: `Firdazer-keypair`

| Instance | Name | Subnet | Private IP | EIP | Security Group | Role |
|----------|------|--------|------------|-----|----------------|------|
| `node1` | `webserver` | Public | `10.0.0.5` | `13.251.138.200` | `public-sg` | App server, Docker, Cloudflare tunnel |
| `node2` | `ansible-controller` | Private | `10.0.1.135` | — | `private-sg` | CI/CD controller, self-hosted GitHub Actions runner |
| `node3` | `monitoring-server` | Private | `10.0.1.136` | — | `private-sg` | Prometheus, Grafana, node_exporter |

**node1** receives an Elastic IP (`aws_eip.node1_eip` + `aws_eip_association`) so it has a static public IP for SSH access and the Cloudflare tunnel.

### Security Groups

**File:** `terraform/aws/security.tf`

Uses `data "http" "myip"` to dynamically fetch the operator's current public IP from `https://ifconfig.me/ip`.

#### public-sg (node1)

| Direction | Protocol | Port | Source | Purpose |
|-----------|----------|------|--------|---------|
| Inbound | TCP | 22 | Operator's IP /32 | SSH access |
| Inbound | TCP | 22 | 10.0.0.0/16 | SSH from VPC (bastion) |
| Inbound | TCP | 9100 | 10.0.0.0/16 | Prometheus scraping node_exporter |
| Outbound | All | All | 0.0.0.0/0 | Full outbound |

#### private-sg (node2 + node3)

| Direction | Protocol | Port | Source | Purpose |
|-----------|----------|------|--------|---------|
| Inbound | TCP | 22 | 10.0.0.0/16 | SSH from VPC |
| Inbound | TCP | 80 | 10.0.0.0/16 | HTTP (internal) |
| Inbound | TCP | 9090 | 10.0.0.0/16 | Prometheus server |
| Inbound | TCP | 9100 | 10.0.0.0/16 | Node Exporter metrics |
| Inbound | TCP | 3000 | 10.0.0.0/16 | Grafana dashboard |
| Outbound | All | All | 0.0.0.0/0 | Full outbound |

Private SG is restricted to VPC CIDR only — no direct public access to monitoring services.

### ECR — Container Registry

**File:** `terraform/aws/ecr.tf`

| Setting | Value |
|---------|-------|
| Repository | `devops-bootcamp-project/app` |
| Tag mutability | MUTABLE |
| Scan on push | Enabled |
| Encryption | AES256 |

**Lifecycle policy:**

| Rule | Priority | Description |
|------|----------|-------------|
| 1 | High | Untagged images expire after 7 days |
| 2 | Low | Keep last 10 tagged images (prefixes: `latest`, `v`) |

### S3 — State Bucket

**File:** `terraform/aws/s3.tf`

| Setting | Value |
|---------|-------|
| Bucket | `devops-bootcamp-project-firdazer` |
| Versioning | Enabled |
| Encryption | AES256 (server-side) |

Stores the Terraform state file (`terraform.tfstate`) and serves as the project's general-purpose bucket.

---

## CI/CD Pipeline (GitHub Actions)

**File:** `.github/workflows/docker-ecr.yml`

### Trigger Conditions

| Trigger | Condition |
|---------|-----------|
| Push to `main` | Changes in `app/**` or the workflow file itself |
| Manual | `workflow_dispatch` (triggered from GitHub UI) |

### Pipeline Steps

```
Step 1: Checkout code
        └── actions/checkout@v4

Step 2: Configure AWS credentials
        └── aws-actions/configure-aws-credentials@v4
            Uses GitHub Secrets: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY
            Region: ap-southeast-1

Step 3: Login to Amazon ECR
        └── aws-actions/amazon-ecr-login@v2
            Returns ECR registry URL

Step 4: Build, tag, and push image
        └── docker build -t <registry>/devops-bootcamp-project/app:<sha> -t <registry>/devops-bootcamp-project/app:latest ./app
            Pushes both tags to ECR
            Outputs image URI to GITHUB_OUTPUT

Step 5: Print image details
        └── Displays registry URL and commit SHA tag
```

**ECR Registry:** `218485539818.dkr.ecr.ap-southeast-1.amazonaws.com`

Every push to `main` that touches `app/` builds a Docker image and pushes it to ECR with both the commit SHA and `latest` tags. The SHA tag enables rollback to any specific commit.

---

## Configuration Management (Ansible)

### Ansible Configuration

**File:** `ansible/ansible.cfg`

```ini
[defaults]
inventory = inventory.ini
host_key_checking = False
remote_user = ubuntu
private_key_file = /home/ubuntu/.ssh/Firdazer-keypair.pem
interpreter_python = /usr/bin/python3

[privilege_escalation]
become = True
become_method = sudo
become_user = root
```

All playbooks run as the `ubuntu` user with sudo privileges via key-based SSH.

### Inventory

**File:** `ansible/inventory.ini`

| Group | Host | Connection | IP | Access Method |
|-------|------|------------|-----|---------------|
| `webservers` | node1 | SSH | `13.251.138.200` | Public IP |
| `monitoring` | node3 | SSH via ProxyCommand | `10.0.1.136` | Through node1 (bastion) |
| `controller` | node2 | Local | `127.0.0.1` | Runs directly on node2 |

**Access patterns:**
- **node1**: Direct SSH to public IP `13.251.138.200`
- **node3**: SSH into node1 first, then ProxyCommand tunnels to `10.0.1.136`
- **node2**: Ansible runs locally on node2 itself (`ansible_connection=local`)

### Requirements

**File:** `ansible/requirements.yml`

| Type | Name | Version | Purpose |
|------|------|---------|---------|
| Role | `geerlingguy.docker` | 6.1.0 | Docker + Docker Compose installation |
| Role | `geerlingguy.pip` | 2.2.0 | Python pip package management |
| Collection | `community.docker` | >=3.0.0,<4.0.0 | Docker module support |
| Collection | `amazon.aws` | >=8.0.0,<9.0.0 | AWS ECR authentication |

### Playbooks

#### 1. `first-playbook.yml` — Initial Bootstrap

**Targets:** All 3 nodes

**Play 1 — node1 (webserver):**
- Installs and starts Nginx
- Deploys a welcome HTML page showing hostname and IP (smoke test)

**Play 2 — node3 (monitoring):**
- Installs `prometheus-node-exporter`
- Displays OS facts

**Play 3 — node2 (controller):**
- Removes old Docker/podman packages
- Installs Docker via `geerlingguy.docker` role
- Installs pip, Python Docker library, git
- Copies SSH private key for node1/node3 access
- Creates `docker-compose.yml` for GitHub Actions self-hosted runner
- Pulls `myoung34/github-runner` image and starts container
- Runner labels: `self-hosted,linux,x64,ansible,terraform`
- Requires `github_repo` and `runner_token` variables

#### 2. `docker-install.yml` — Deploy Application

**Target:** node1 (webservers)

**Flow:**
```
1. Remove old Docker packages
2. Install Docker via geerlingguy.docker role
3. Install python3-docker, unzip, curl
4. Download + install AWS CLI v2 (if not present)
5. Create ~/.aws/credentials with AWS keys
6. ECR login: aws ecr get-login-password | docker login
7. Stop nginx (free port 80)
8. Pull image from ECR
9. Tag locally as myapp:latest
10. Run container on port 80:80
11. Verify container is running
```

**Container details:**
- Name: `myapp`
- Image: `218485539818.dkr.ecr.ap-southeast-1.amazonaws.com/devops-bootcamp-project/app:latest`
- Port mapping: `80:80`
- Restart policy: `unless-stopped`

#### 3. `github-runner.yml` — Self-Hosted Runner

**Target:** node2 (controller)

- Deploys `myoung34/github-runner` container with host networking
- Mounts Docker socket for Docker-in-Docker builds
- Mounts SSH keys for node1/node3 deployment
- Requires `github_repo` and `runner_token` variables
- Fails if variables are not set

#### 4. `monitoring.yml` — Monitoring Stack

**Target:** node1 + node3

**Play 1 — node1:**
- Installs and enables `prometheus-node-exporter` on port 9100

**Play 2 — node3:**
```
1. Install Docker on node3
2. Create Docker bridge network "monitoring-net"
3. Deploy Prometheus:
   - Config: scrapes node1:9100 (node1-webserver) + node3:9100 (node3-monitoring)
   - Scrape interval: 15s
   - Data retention: 30 days
   - Port: 9090:9090
   - Network: monitoring-net
4. Deploy Grafana:
   - Datasource: Prometheus at http://prometheus:9090
   - Dashboard: Pre-built Node Exporter dashboard (nodes.json)
   - Credentials: admin/admin
   - Port: 3000:3000
   - Network: monitoring-net
5. Verify both containers are running and on the shared network
```

#### 5. `cloudflare-tunnel.yml` — App Tunnel

**Target:** node1

- Requires `CLOUDFLARE_TUNNEL_TOKEN` environment variable
- Runs `cloudflare/cloudflared:latest` container with token-based auth
- Command: `tunnel --no-autoupdate run --token <TOKEN>`
- Exposes the app at a custom domain via Cloudflare Zero Trust
- No inbound ports opened — outbound-only encrypted tunnel

#### 6. `cloudflare-tunnel-monitoring.yml` — Grafana Tunnel

**Target:** node3

- Requires `CLOUDFLARE_MONITORING_TUNNEL_TOKEN` environment variable
- Uses `network_mode: host` to reach Grafana on `localhost:3000`
- Maps `monitoringserver.artdevops.com → http://localhost:3000`

---

## Application

The application is a **Three.js 3D spaceship microservice** called "shipit-launchpad" where users customize and launch their ship.

### Tech Stack

| Component | Technology |
|-----------|------------|
| Build tool | Vite 6.0.7 |
| 3D engine | Three.js 0.169.0 |
| Runtime | Node.js 20 |
| Web server | Nginx (Alpine) |
| Language | JavaScript (ESM) |
| Tests | Node.js built-in test runner |

### Dockerfile

**File:** `app/Dockerfile`

Multi-stage build:

```
Stage 1 — BUILD (node:20-alpine):
  ├── npm ci
  └── npm run build (Vite production build → /dist)

Stage 2 — SERVE (nginx:alpine):
  ├── Copy /dist → /usr/share/nginx/html
  └── Expose port 80
```

The final image contains only Nginx + static files (~20MB), not the Node.js toolchain.

### 3D Scene & Ship Config

**Ship customization** is defined in `app/ship.config.json`:

```json
{
  "shipName": "Firdazer",
  "color": "#22d3ee",
  "shipModel": "scout",
  "emblem": "comet"
}
```

| Property | Options | Description |
|----------|---------|-------------|
| `shipName` | Any string | Pilot callsign displayed on HUD |
| `color` | Any hex color | Ship hue-shift color |
| `shipModel` | `fighter`, `interceptor`, `hauler`, `scout` | 3D GLB model |
| `emblem` | `comet`, others | Emblem graphic |

**3D models** (CC0 by Quaternius):
- `public/fighter.glb`
- `public/interceptor.glb`
- `public/hauler.glb`
- `public/scout.glb`

**Scene rendering** (`src/scene.js`):
- Perspective camera with hemisphere + directional lighting
- GLTF model loading with hue-shift shader
- Auto-rotation and floating animation
- WebGL fallback for unsupported browsers
- GPU resource cleanup on teardown

**Build-time metadata** (`vite.config.js`):
- `__BUILD_SHA__` — Git commit short SHA
- `__BUILD_TIME__` — ISO build timestamp

---

## Monitoring Stack

| Component | Image | Host | Port | Purpose |
|-----------|-------|------|------|---------|
| Prometheus | `prom/prometheus:latest` | node3 | 9090:9090 | Metrics collection |
| Grafana | `grafana/grafana:latest` | node3 | 3000:3000 | Metrics visualization |
| Node Exporter | System package | node1 | 9100 | Host metrics (node1) |
| Node Exporter | System package | node3 | 9100 | Host metrics (node3) |

**Prometheus configuration:**
- Scrape interval: 15s
- Targets: `10.0.0.5:9100` (node1-webserver), `10.0.1.136:9100` (node3-monitoring)
- Data retention: 30 days
- Lifecycle API enabled for hot reloads

**Grafana configuration:**
- Datasource: Prometheus at `http://prometheus:9090` (via Docker DNS on `monitoring-net`)
- Dashboard: Pre-built Node Exporter dashboard (`grafana-dashboards/nodes.json`)
- Metrics: CPU, memory, disk, network per node

**Docker network:** Both containers run on `monitoring-net` bridge network for inter-container DNS resolution.

**External access:** Grafana is exposed via Cloudflare tunnel at `monitoringserver.artdevops.com`.

---

## Security

| Layer | Mechanism | Details |
|-------|-----------|---------|
| Network isolation | Private subnet | node2 + node3 have no public IP |
| Bastion host | SSH ProxyCommand | Private nodes accessed through node1 |
| Security groups | CIDR-restricted | Private SG limited to VPC `10.0.0.0/16` only |
| Dynamic SSH lock | `data "http" "myip"` | SSH restricted to operator's current IP |
| Zero Trust tunnels | Cloudflare tunnels | No inbound ports open on any instance |
| ECR scanning | Scan on push | Automatic vulnerability scanning |
| S3 encryption | AES256 | Server-side encryption on state bucket |
| S3 versioning | Enabled | Protects against accidental state overwrites |
| IAM profiles | `EC2-Devops` | Scoped AWS permissions per instance |
| Key-based SSH | `Firdazer-keypair.pem` | No password authentication |

---

## Network Topology

```
Internet
    │
    ├──► Internet Gateway ──► Public Subnet (10.0.0.0/24)
    │                            │
    │                        node1 (10.0.0.5)
    │                        EIP: 13.251.138.200
    │                        ├─ App (port 80)
    │                        ├─ Cloudflare tunnel
    │                        └─ node_exporter (port 9100)
    │
    └──► NAT Gateway ──────► Private Subnet (10.0.1.0/24)
                                 │
                             node2 (10.0.1.135)
                             ├─ GitHub Actions runner
                             ├─ Ansible controller
                             └─ Terraform state
                                 │
                             node3 (10.0.1.136)
                             ├─ Prometheus (port 9090)
                             ├─ Grafana (port 3000)
                             ├─ node_exporter (port 9100)
                             └─ Cloudflare tunnel
```

**Traffic flows:**
- **Inbound:** Internet → IGW → node1 (SSH, Cloudflare tunnel)
- **Outbound (public):** node1 → IGW → Internet
- **Outbound (private):** node2/node3 → NAT → Internet (for apt, Docker pulls)
- **Internal:** Prometheus scrapes node1:9100 through VPC
- **Monitoring:** Grafana queries Prometheus via Docker DNS (`monitoring-net`)
- **CI/CD:** GitHub → Actions workflow → ECR → node2 (self-hosted runner) → Ansible → node1

---

## Improvement Plan

Prioritized list of improvements to harden, automate, and scale the project.

### Security

| # | Priority | Issue | Current State | Recommendation |
|---|----------|-------|---------------|----------------|
| 1 | **Critical** | SSH key committed to git | `Firdazer-keypair.pem` in repo history | Rotate key pair in AWS, purge from git history with `git filter-branch` or BFG Repo-Cleaner |
| 2 | **Critical** | AWS access keys committed to git | `Firdazer_accessKeys.pem` in repo history | Delete key in IAM, create new one, purge from git |
| 3 | **High** | Static AWS credentials on EC2 | Written to `~/.aws/credentials` by Ansible | Use the IAM instance profile (`EC2-Devops`) already attached instead of static keys |
| 4 | **High** | Grafana default credentials | `admin/admin` | Store password in Ansible Vault or AWS Secrets Manager |
| 5 | **Medium** | No S3 public access block | Bucket has no explicit block rules | Add `aws_s3_bucket_public_access_block` to prevent accidental exposure |
| 6 | **Medium** | ECR mutable tags | Image tags can be overwritten | Switch to `IMMUTABLE` tag policy, deploy by SHA digest |
| 7 | **Low** | No HTTPS origin cert | TLS terminated at Cloudflare edge only | Add Cloudflare origin certificate on Nginx for end-to-end encryption |

### Infrastructure (Terraform)

| # | Priority | Issue | Recommendation |
|---|----------|-------|----------------|
| 8 | **High** | File-based state locking | Add DynamoDB table for `terraform-locks` with `encrypt = true` |
| 9 | **Medium** | Legacy Terraform dirs | Remove `terraform/s3bucket/`, `terraform/vpc/`, `terraform/securitygroup/` after verifying no resources depend on them |
| 10 | **Medium** | Missing outputs | Add outputs for VPC ID, subnet IDs, instance IPs, EIP |
| 11 | **Low** | Hardcoded instance type | Extract `instance_type` and `root_volume_size` into `variables.tf` |

### CI/CD (GitHub Actions)

| # | Priority | Issue | Recommendation |
|---|----------|-------|----------------|
| 12 | **High** | No automated deployment | Add a `deploy` job that runs `ansible-playbook docker-install.yml` on the self-hosted runner after image push |
| 13 | **Medium** | No tests in pipeline | Add a `test` job running `npm test` and `npm run test:unit` before build |
| 14 | **Medium** | No rollback mechanism | Save current image tag before deploy, revert if health check fails |
| 15 | **Low** | Unpinned action versions | Pin to specific SHA commits instead of major version tags |

### Configuration Management (Ansible)

| # | Priority | Issue | Recommendation |
|---|----------|-------|----------------|
| 16 | **High** | Secrets in plaintext | Use Ansible Vault for tunnel tokens and sensitive variables |
| 17 | **Medium** | No application health checks | Add HTTP health check after container start (`uri` module with retries) |
| 18 | **Low** | Flat playbook structure | Refactor into roles: `common`, `docker`, `app`, `monitoring`, `cloudflare-tunnel` |
| 19 | **Low** | Container recreation on every run | Use idempotent `docker_container` with `pull: true` instead of remove + create |

### Monitoring

| # | Priority | Issue | Recommendation |
|---|----------|-------|----------------|
| 20 | **Medium** | No app-level monitoring | Add Prometheus blackbox exporter to probe app health (latency, uptime) |
| 21 | **Medium** | No log aggregation | Deploy Loki + Promtail on node3, or configure Docker JSON file logging with rotation |
| 22 | **Low** | No container metrics | Add cAdvisor to scrape per-container CPU/memory, import Grafana dashboard |
| 23 | **Low** | No alerting | Configure Grafana alerts or Prometheus Alertmanager for downtime, high CPU, low disk |

### Application & Docker

| # | Priority | Issue | Recommendation |
|---|----------|-------|----------------|
| 24 | **Medium** | No Docker Compose for app | Create `docker-compose.yml` with healthcheck for declarative, reproducible deploys |
| 25 | **Low** | No resource limits | Add CPU/memory limits to containers to prevent resource starvation |
| 26 | **Low** | AMD64 only | Add multi-architecture builds (`linux/amd64,linux/arm64`) for Graviton support |

### Documentation & Hygiene

| # | Priority | Issue | Recommendation |
|---|----------|-------|----------------|
| 27 | **High** | Empty README | This documentation covers the gap |
| 28 | **Medium** | No `.env.example` | Document all required environment variables and secrets |
| 29 | **Low** | No `.editorconfig` | Add consistent formatting rules across editors |

### Disaster Recovery

| # | Priority | Issue | Recommendation |
|---|----------|-------|----------------|
| 30 | **Medium** | No cross-region state backup | Enable S3 Cross-Region Replication for the state bucket |
| 31 | **Medium** | No app health endpoint | Add `/health` endpoint for Cloudflare origin checks and blackbox probes |
| 32 | **Low** | No instance auto-recovery | Add CloudWatch alarm with EC2 recovery action for hardware failures |

### Implementation Phases

**Phase 1 — Security & Stability (Week 1)**
- [ ] Rotate SSH keys and AWS access keys
- [ ] Switch to IAM instance profile for ECR auth
- [ ] Change Grafana credentials
- [ ] Add DynamoDB state locking
- [ ] Add S3 public access block

**Phase 2 — CI/CD & Automation (Week 2)**
- [ ] Add deployment step to GitHub Actions pipeline
- [ ] Add application tests to pipeline
- [ ] Set up Ansible Vault for secrets
- [ ] Add health checks to Ansible deployments

**Phase 3 — Monitoring & Observability (Week 3)**
- [ ] Add blackbox exporter for app probing
- [ ] Add log aggregation (Loki + Promtail)
- [ ] Add Docker container Grafana dashboard

**Phase 4 — Reliability (Week 4)**
- [ ] Add app `/health` endpoint
- [ ] Implement rollback on failed deploy
- [ ] Cross-region state replication
- [ ] Clean up legacy Terraform directories
