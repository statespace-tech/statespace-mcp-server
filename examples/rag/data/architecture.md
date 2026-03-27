# System Architecture

## Overview

The platform is composed of three main layers: API, Workers, and Data. Services communicate over internal HTTP and a shared job queue. All writes go through the API layer; workers only consume.

## API Layer

The API is a stateless HTTP service written in Go. It handles authentication, request validation, and dispatches work to the job queue. It connects to the primary Postgres instance for reads and writes.

- **Auth**: JWT-based, tokens expire after 24h
- **Rate limiting**: 100 req/min per IP, 1000 req/min per authenticated user
- **Timeouts**: 30s for upstream calls, 5s for DB queries

## Worker Layer

Workers are long-running processes that consume jobs from a Redis-backed queue. Each worker type handles a specific job category (email, payments, reporting). Workers are stateless and horizontally scalable.

- **Retry policy**: 3 attempts with exponential backoff (5s, 30s, 5m)
- **Dead letter queue**: jobs that exhaust retries are moved to DLQ for manual review
- **Concurrency**: up to 10 jobs per worker process

## Data Layer

- **Primary DB**: Postgres 15, single writer, two read replicas
- **Cache**: Redis 7, used for rate limiting and session data
- **Object storage**: S3-compatible, used for report exports and backups
- **Backups**: daily snapshots at 23:00 UTC, retained for 30 days

## Deployment

Services are deployed as Docker containers on Kubernetes. Each service has its own namespace. Config is injected via environment variables from Kubernetes Secrets.

- **CI/CD**: GitHub Actions → build → push to ECR → deploy via Helm
- **Rollbacks**: `helm rollback <release> <revision>`
- **Scaling**: HPA configured on CPU (target 70%) for API and worker deployments

## Known Bottlenecks

- The reporting worker holds a long DB transaction during aggregation, which can cause lock contention on the orders table during peak hours.
- The checkout endpoint has a synchronous call to the payment gateway with no circuit breaker. Gateway timeouts (>30s) cause 504s.
- Redis is a single node; a failure here takes down rate limiting and session validation simultaneously.
