# Layap Backend Guide

Backend documentation for **Website-Layanan-Aplikasi (Layap)**.

This document describes the backend that currently exists in the repository's `backend/` directory, including local setup, environment variables, database configuration, authentication, OTP/password reset, merchant creation, and API usage.

> **Verified against the current `main` branch on 2026-09-24.**

## 1. Backend Overview

The backend is a REST API built with:

| Component | Technology |
|---|---|
| Runtime | Node.js 20+ |
| Language | TypeScript |
| Development runner | `tsx` |
| Framework | Express 5 |
| ORM | Prisma 6 |
| Database | MySQL |
| Authentication | JWT + bcryptjs |
| Email | Nodemailer / SMTP |
| Rate limiting | `express-rate-limit` |
| Containerization | Docker / Docker Compose |
| Database GUI | phpMyAdmin |

The server starts from `src/index.ts` and listens on `PORT` (default: `4000`).

## 2. Backend Directory Structure

```text
backend/
├── prisma/
│   ├── migrations/        # Prisma migration files
│   └── schema.prisma      # Database schema
├── src/
│   ├── generated/prisma/  # Generated Prisma Client (created by prisma generate)
│   ├── lib/
│   │   ├── db.ts          # Prisma client instance
│   │   └── mailer.ts      # SMTP/Nodemailer functions
│   ├── memory/
│   │   └── otp.ts         # In-memory OTP storage and verification
│   ├── middleware/
│   │   ├── auth.ts        # JWT authentication middleware
│   │   └── rateLimiter.ts # Password-reset rate limiter
│   ├── route/
│   │   ├── auth.ts        # Register, login, OTP verification
│   │   ├── merchant.ts    # Merchant creation
│   │   └── reset.ts       # Password reset flow
│   └── index.ts            # Express application entry point
├── .env.example            # Environment variable template
├── Dockerfile
├── docker-compose.yml
├── package.json
└── tsconfig.json
```

## 3. Requirements

Install the following before starting the backend:

- Node.js (LTS; the Docker image currently uses Node.js 20)
- npm
- Docker and Docker Compose
- A Gmail/SMTP account if email features are required

## 4. Local Environment Setup

### 4.1 Install dependencies

From the `backend/` directory:

```bash
npm install
```

### 4.2 Create the environment file

```bash
cp .env.example .env
```

Update `.env` with real values. Do not commit the real `.env` file or any SMTP/JWT credentials.

### 4.3 Environment variables

| Variable | Required | Purpose |
|---|---:|---|
| `PORT` | Yes | Port used by Express; defaults to `4000` |
| `NODE_ENV` | Yes | `development` / `production`; controls development error details |
| `MYSQL_ROOT_PASSWORD` | Yes | MySQL root password used by Docker |
| `MYSQL_DATABASE` | Yes | MySQL database name |
| `MYSQL_USER` | Yes | Application database user |
| `MYSQL_PASSWORD` | Yes | Application database password |
| `DATABASE_URL` | Yes | Prisma MySQL connection string |
| `JWT_TOKEN` | Yes | JWT signing/verifying secret used by normal login/auth middleware |
| `SMTP_HOST` | Yes for email | SMTP host, normally `smtp.gmail.com` |
| `SMTP_PORT` | Yes for email | SMTP port, normally `587` |
| `SMTP_USER` | Yes for email | SMTP account address |
| `SMTP_PASS` | Yes for email | SMTP password or Gmail App Password |
| `SMTP_FROM` | Optional | Intended sender address for outgoing mail |
| `ALLOWED_ORIGINS` | Yes | Comma-separated CORS origins; the server exits during startup when missing |

Example development configuration:

```env
PORT=4000
NODE_ENV=development

MYSQL_ROOT_PASSWORD=replace_me
MYSQL_DATABASE=my_db
MYSQL_USER=my_user
MYSQL_PASSWORD=replace_me
DATABASE_URL=mysql://my_user:replace_me@localhost:3306/my_db

JWT_TOKEN=replace_with_a_long_random_secret

SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-16-character-gmail-app-password
SMTP_FROM=ITS App <your-email@gmail.com>

ALLOWED_ORIGINS=http://localhost:5173
```

## 5. Start MySQL and phpMyAdmin

From the `backend/` directory:

```bash
docker compose up -d
```

The current Compose file defines:

| Service | Container | Host port |
|---|---|---:|
| MySQL | `mysql_server` | `3306` |
| phpMyAdmin | `phpmyadmin_server` | `8080` |
| API container | `api_app` | No host port mapping currently defined |

phpMyAdmin is available at:

```text
http://localhost:8080
```

The application connects to MySQL through `DATABASE_URL`.

## 6. Prisma Setup

The Prisma schema uses MySQL:

```prisma
datasource db {
  provider = "mysql"
  url      = env("DATABASE_URL")
}
```

After the database is running, generate the Prisma Client:

```bash
npx prisma generate
```

Apply/create development migrations with:

```bash
npx prisma migrate dev
```

Useful commands:

```bash
npx prisma generate
npx prisma migrate dev
npx prisma validate
npx prisma studio
```

`prisma/schema.prisma` is the source of truth for the database model.

### Prisma data model

```text
User
 └──< MerchantMember >── Merchant

MerchantMember.role:
 ├── OWNER
 └── STAFF

Merchant.status:
 ├── PENDING
 ├── ACTIVE
 └── SUSPENDED
```

### Main models

#### User

- `id`: derived from the part before `@` in the ITS student email (NRP)
- `email`: unique
- `passwordHashed`: bcrypt hash
- `namaLengkap`
- `username`: unique
- `departemen`
- `fakultas`
- `isAdmin`
- `isVerified`
- `createdAt`
- `updatedAt`

#### Merchant

- `id`: CUID
- `namaToko`
- `deskripsi`: optional
- `status`: `PENDING`, `ACTIVE`, or `SUSPENDED`
- `createdAt`

#### MerchantMember

- `id`: CUID
- `userId`
- `merchantId`
- `role`: `OWNER` or `STAFF`
- `joinedAt`
- Unique constraint on `(userId, merchantId)`

## 7. Running the Backend

Start the backend in development mode:

```bash
npm run dev
```

The `dev` script runs:

```bash
tsx watch src/index.ts
```

By default, the API is available at:

```text
http://localhost:4000
```

Basic checks:

```bash
curl http://localhost:4000/
curl http://localhost:4000/health
```

The root endpoint returns:

```json
{
  "message": "API is running..."
}
```

The health endpoint checks the database connection and returns an `ok` response when MySQL is reachable.

## 8. API Endpoints

### Base URL

```text
http://localhost:4000
```

The backend does **not** mount its routes under `/api`. The frontend development server uses `/api` only as a proxy prefix and rewrites it away before forwarding requests to the backend.

### Endpoint summary

| Method | Endpoint | Auth | Purpose |
|---|---|---|---|
| GET | `/` | No | API status |
| GET | `/health` | No | Database health check |
| GET | `/test-email` | No | SMTP test email |
| POST | `/auth/register` | No | Register a new ITS student user |
| POST | `/auth/login` | No | Login with email/password |
| POST | `/auth/verify-otp` | No | Verify an OTP for supported purposes |
| POST | `/reset/request` | No | Request password-reset OTP |
| POST | `/reset/result` | No | Verify reset OTP and change password |
| POST | `/create/merchant` | Bearer JWT | Create a merchant and assign caller as owner |

## 9. Authentication

Normal authentication uses JWT.

The login and registration handlers sign tokens with `JWT_TOKEN` and a seven-day expiration.

Protected requests must include:

```http
Authorization: Bearer <jwt>
```

The `requireAuth` middleware validates the token using `JWT_TOKEN`. A valid token must contain a `sub` claim containing the user ID.

Typical authentication errors:

| Status | Meaning |
|---:|---|
| `401` | Missing or malformed Authorization header |
| `401` | Missing token |
| `401` | Expired token |
| `401` | Invalid token/signature |
| `500` | `JWT_TOKEN` is not configured |

## 10. Registration

### Request

```http
POST /auth/register
Content-Type: application/json
```

```json
{
  "email": "1234567890@student.its.ac.id",
  "password": "secret123",
  "fullname": "Example Student",
  "username": "example",
  "department": "Teknik Komputer",
  "fakultas": "FTEIC"
}
```

Requirements enforced by the current implementation:

- All fields are required.
- Email must end with `@student.its.ac.id`.
- The part before `@` becomes the user's database `id`.
- Password is hashed using bcrypt before storage.
- Email and username are unique.

Successful response (`201`):

```json
{
  "token": "<jwt>",
  "user": {
    "id": "1234567890",
    "email": "1234567890@student.its.ac.id",
    "fullname": "Example Student",
    "username": "example",
    "department": "Teknik Komputer",
    "fakultas": "FTEIC",
    "createdAt": "..."
  }
}
```

## 11. Login

### Request

```http
POST /auth/login
Content-Type: application/json
```

```json
{
  "email": "1234567890@student.its.ac.id",
  "password": "secret123"
}
```

Successful response (`200`):

```json
{
  "token": "<jwt>",
  "user": {
    "id": "1234567890",
    "email": "1234567890@student.its.ac.id",
    "fullname": "Example Student",
    "username": "example",
    "department": "Teknik Komputer",
    "fakultas": "FTEIC",
    "createdAt": "..."
  }
}
```

Invalid or incomplete credentials currently return `400` with an `Invalid Credentials` or validation message.

## 12. OTP and Password Reset

OTP data is stored **in memory**, not in MySQL/Redis. Each OTP record contains a SHA-256 hash, expiry timestamp, and failed-attempt counter.

Current OTP rules:

- OTP is six digits for password reset.
- Password-reset OTP lifetime is 10 minutes.
- OTP is single-use after successful verification.
- An OTP is removed after 5 incorrect attempts.
- Expired OTPs are removed during verification and periodic cleanup.

### Request password reset OTP

```http
POST /reset/request
Content-Type: application/json
```

```json
{
  "email": "1234567890@student.its.ac.id"
}
```

The endpoint intentionally returns a generic response whether the account exists:

```json
{
  "message": "If that email exist in our system, an OTP has been sent."
}
```

The request endpoint is rate-limited to **5 requests per 15 minutes per IP**.

### Complete password reset

```http
POST /reset/result
Content-Type: application/json
```

```json
{
  "email": "1234567890@student.its.ac.id",
  "otp": "123456",
  "newPassword": "newSecret123"
}
```

The new password must contain at least 8 characters.

Successful response:

```json
{
  "message": "Password succesfully changed"
}
```

Incorrect, expired, missing, or exhausted OTPs produce an error response. The client should check both the HTTP status and the `message` field returned by the backend.

## 13. OTP Verification Endpoint

General OTP verification is exposed through:

```http
POST /auth/verify-otp
Content-Type: application/json
```

Body:

```json
{
  "email": "1234567890@student.its.ac.id",
  "otp": "123456",
  "purpose": "REGISTRATION"
}
```

Supported purposes in the backend are:

```text
REGISTRATION
PASSWORD_RESET
LOGIN_2FA
```

The current route handles `REGISTRATION` and `LOGIN_2FA`; password-reset verification is handled by `/reset/result`.

## 14. Merchant Creation

Creating a merchant requires a valid JWT.

### Request

```http
POST /create/merchant
Authorization: Bearer <jwt>
Content-Type: application/json
```

```json
{
  "namaToko": "Warung Test",
  "deskripsi": "A test store"
}
```

`deskripsi` is optional.

The authenticated user is automatically inserted into `MerchantMember` with the `OWNER` role.

Successful response (`201`):

```json
{
  "message": "Merchant succesfully Created",
  "data": {
    "id": "...",
    "namaToko": "Warung Test",
    "deskripsi": "A test store",
    "status": "PENDING",
    "createdAt": "...",
    "members": [
      {
        "id": "...",
        "userId": "1234567890",
        "merchantId": "...",
        "role": "OWNER",
        "joinedAt": "...",
        "user": {
          "id": "1234567890",
          "namaLengkap": "Example Student",
          "email": "1234567890@student.its.ac.id"
        }
      }
    ]
  }
}
```

## 15. Email / SMTP

Nodemailer is used for:

- Welcome email after registration
- Password-reset OTP email
- Manual `/test-email` verification

For Gmail, use a Google **App Password** rather than the normal account password.

Test SMTP configuration with:

```text
GET /test-email
```

A successful response contains a message ID:

```json
{
  "status": "success",
  "messageId": "..."
}
```

Email failures are logged by the server. The welcome-email helper is deliberately non-blocking so a registration can still complete if email sending fails.

## 16. CORS

The server reads `ALLOWED_ORIGINS` from `.env` and splits it by commas.

Example:

```env
ALLOWED_ORIGINS=http://localhost:5173,https://example.com
```

For temporary local development, the project also supports:

```env
ALLOWED_ORIGINS=*
```

Do not use a wildcard in a production deployment unless that is an intentional security decision.

## 17. Testing and Linting

The available npm scripts are:

```bash
npm run dev
npm test
npm run lint
```

`npm test` runs Vitest in non-watch mode.

## 18. Running Frontend + Backend Together

The repository contains a root-level `dev.sh` helper.

From the repository root:

```bash
./dev.sh
```

Current development ports:

```text
Frontend: http://localhost:5173
Backend:  http://localhost:4000
```

The script can also show status or stop the development services:

```bash
./dev.sh --status
./dev.sh --stop
```

The script checks the backend health endpoint and uses port/process detection to avoid accidentally talking to an old backend process.

Logs are written to:

```text
.dev-logs/backend.log
.dev-logs/frontend.log
```

On a fresh clone, `dev.sh` also generates the Prisma Client when `src/generated/prisma/client.ts` does not exist.

## 19. Docker Notes

`Dockerfile` currently uses:

```dockerfile
FROM node:20-alpine
```

and runs:

```bash
npm run dev
```

The Dockerfile declares `EXPOSE 8000`, while the Express application defaults to port `4000`. The current `docker-compose.yml` also does not publish an `api_app` host port. Therefore, the Docker setup currently functions primarily as a database/email-enabled application container definition rather than a ready-to-access host-published API container.

For normal local development, use `npm run dev` on the host or `./dev.sh`.

## 20. Important Implementation Notes

### JWT secret naming inconsistency

There are currently two JWT environment variable names in the code:

- `JWT_TOKEN` is used by registration/login and `requireAuth`.
- `JWT_SECRET` is used by the `LOGIN_2FA` branch of `/auth/verify-otp`.

The `.env.example` only defines `JWT_TOKEN`.

Before relying on the 2FA login flow, the JWT configuration should be unified so all generated tokens use the same secret and compatible payload fields expected by `requireAuth`.

### JWT payload inconsistency

Normal login/registration tokens contain:

```json
{
  "sub": "<user-id>",
  "email": "<email>"
}
```

The `LOGIN_2FA` branch currently signs:

```json
{
  "userId": "<user-id>",
  "email": "<email>"
}
```

Since `requireAuth` reads `payload.sub`, the two token formats are not currently interchangeable.

### Registration OTP flow

The OTP module supports a `REGISTRATION` purpose and `/auth/verify-otp` contains registration-verification logic. However, the currently exposed registration route does not itself create a registration OTP. The registration flow therefore should be reviewed before documenting it as a complete email-verification workflow.

### In-memory OTP storage

Because OTP records are stored in a JavaScript `Map`, they disappear whenever the backend restarts and are not shared between multiple backend instances. This is suitable for a simple single-instance development setup, but a persistent/shared store such as Redis would be needed for a multi-instance production deployment.

### Health status code

`GET /health` returns HTTP `201` when the database is available in the current implementation. The response body is still:

```json
{
  "status": "ok",
  "db": "up"
}
```

A conventional health-check endpoint would normally use `200`; changing this is optional but should be coordinated with frontend/monitoring checks.

## 21. Development Workflow

A typical backend development workflow is:

```bash
cd backend
npm install
cp .env.example .env
# Edit .env

docker compose up -d
npx prisma generate
npx prisma migrate dev
npm run dev
```

Then verify:

```bash
curl http://localhost:4000/
curl http://localhost:4000/health
```

For changes to the Prisma schema:

```bash
# edit prisma/schema.prisma
npx prisma migrate dev --name describe_your_change
npx prisma generate
```

For backend code changes, `tsx watch` automatically restarts the development server.

## 22. API Flow Summary

```text
                    ┌──────────────────┐
                    │     Frontend     │
                    └────────┬─────────┘
                             │ HTTP/JSON
                             ▼
                    ┌──────────────────┐
                    │ Express Backend  │
                    │   src/index.ts   │
                    └────────┬─────────┘
                             │
          ┌──────────────────┼────────────────────┐
          │                  │                    │
          ▼                  ▼                    ▼
     /auth/*           /create/*             /reset/*
          │                  │                    │
          ▼                  ▼                    ▼
     JWT + bcrypt       requireAuth        OTP + bcrypt
          │                  │                    │
          └──────────────────┼────────────────────┘
                             ▼
                     ┌────────────────┐
                     │     Prisma     │
                     └───────┬────────┘
                             ▼
                      ┌──────────────┐
                      │    MySQL     │
                      └──────────────┘

                      ┌──────────────┐
                      │  Nodemailer  │
                      │     SMTP     │
                      └──────────────┘
```

## 23. Related Files

- [`backend/src/index.ts`](./src/index.ts) — Express application and route registration
- [`backend/src/route/auth.ts`](./src/route/auth.ts) — Authentication and OTP verification
- [`backend/src/route/merchant.ts`](./src/route/merchant.ts) — Merchant creation
- [`backend/src/route/reset.ts`](./src/route/reset.ts) — Password reset
- [`backend/src/middleware/auth.ts`](./src/middleware/auth.ts) — JWT authentication middleware
- [`backend/src/memory/otp.ts`](./src/memory/otp.ts) — OTP storage/verification
- [`backend/src/lib/db.ts`](./src/lib/db.ts) — Prisma client
- [`backend/src/lib/mailer.ts`](./src/lib/mailer.ts) — Nodemailer helpers
- [`backend/prisma/schema.prisma`](./prisma/schema.prisma) — Database schema
- [`backend/docker-compose.yml`](./docker-compose.yml) — MySQL/phpMyAdmin/API containers
- [`backend/.env.example`](./.env.example) — Environment template