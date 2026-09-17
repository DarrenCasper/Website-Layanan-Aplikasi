# Layap Backend

Backend API for Layap, built with Express, Prisma, and MySQL.

## Tech Stack

- **Runtime**: Node.js + TypeScript (`tsx`)
- **Framework**: Express 5
- **ORM**: Prisma 6 (MySQL)
- **Auth**: JWT (`jsonwebtoken`) + `bcryptjs` for password hashing
- **Database**: MySQL 8, run via Docker Compose (with phpMyAdmin for a GUI)
- **CORS**: `cors`, origins controlled via `ALLOWED_ORIGINS`
- **Email**: `nodemailer` (welcome email on register, OTP email on password reset)
- **Rate limiting**: `express-rate-limit` on the OTP request endpoint

## Prerequisites

- Node.js (LTS)
- Docker + Docker Compose

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Copy the environment file

```bash
cp .env.example .env
```

Then fill in `.env` with your own values:

| Variable              | Description                                              |
|-----------------------|------------------------------------------------------------|
| `PORT`                | Port the API server listens on (default `4000`)          |
| `NODE_ENV`            | `development` or `production`                             |
| `MYSQL_ROOT_PASSWORD` | Root password for the MySQL container                     |
| `MYSQL_DATABASE`      | Database name to create                                    |
| `MYSQL_USER`          | App DB user (created automatically by the MySQL container) |
| `MYSQL_PASSWORD`      | Password for `MYSQL_USER`                                  |
| `DATABASE_URL`        | Full Prisma connection string, must match the 4 vars above (`mysql://MYSQL_USER:MYSQL_PASSWORD@localhost:3306/MYSQL_DATABASE`) |
| `JWT_TOKEN`           | Secret used to sign/verify login JWTs                      |
| `SMTP_HOST`           | SMTP server host, e.g. `smtp.gmail.com`                    |
| `SMTP_PORT`           | SMTP server port (default `587`)                           |
| `SMTP_USER`           | SMTP account username                                      |
| `SMTP_PASS`           | SMTP account password / app password                       |
| `SMTP_FROM`           | `From` header used on outgoing emails, e.g. `"ITS App <noreply@its.ac.id>"` |
| `ALLOWED_ORIGINS`     | Comma-separated list of allowed CORS origins, e.g. `http://localhost:5173,https://layap.app`. Use `*` to allow any origin (dev only). **Required** — the server throws on startup if unset. |

### 3. Start the database

From this `backend/` folder (important — Docker Compose only picks up `.env` from the directory you run it in):

```bash
docker compose up -d
```

This starts:
- **MySQL** on `localhost:3306`
- **phpMyAdmin** on [http://localhost:8080](http://localhost:8080) (login with your `MYSQL_USER` / `MYSQL_PASSWORD`, or root)

### 4. Grant Prisma Migrate permissions

The MySQL image only grants `MYSQL_USER` privileges on `MYSQL_DATABASE` by default. Prisma Migrate also needs to create/drop a temporary **shadow database** to compute migration diffs, so run this once after the container is up:

```bash
docker exec -it mysql_server mysql -uroot -p"$MYSQL_ROOT_PASSWORD" -e "GRANT ALL PRIVILEGES ON *.* TO '<MYSQL_USER>'@'%' WITH GRANT OPTION; FLUSH PRIVILEGES;"
```

Replace `<MYSQL_USER>` with the value from your `.env`.

### 5. Run migrations

```bash
npx prisma migrate dev
```

This applies the schema in `prisma/schema.prisma` and generates the Prisma Client into `src/generated/prisma`.

### 6. Start the dev server

```bash
npm run dev
```

Server runs on `http://localhost:<PORT>` (default `4000`) with hot reload via `tsx watch`.

## Useful Prisma commands

| Command                        | What it does                                              |
|---------------------------------|------------------------------------------------------------|
| `npx prisma migrate dev`       | Create/apply a migration from schema changes (dev only)   |
| `npx prisma generate`          | Regenerate the Prisma Client without running a migration  |
| `npx prisma studio`            | Open a GUI to browse/edit database rows                    |
| `npx prisma validate`          | Check `schema.prisma` for syntax/semantic errors            |

## Data Model

See [prisma/schema.prisma](prisma/schema.prisma) for the source of truth. Summary:

- **User** — `id` is the NRP (ITS student number), sliced from the ITS email, not auto-generated.
- **Merchant** — a store, with a `status` (`PENDING` / `ACTIVE` / `SUSPENDED`).
- **MerchantMember** — join table linking a `User` to a `Merchant` with a `role` (`OWNER` / `STAFF`). A user can only have one role per merchant.

## Routes

Base URL: `http://localhost:<PORT>`

### `GET /health`

Health check. Verifies the DB connection.

```json
// 200
{ "status": "ok", "db": "up" }
```

---

### `POST /auth/register`

Registers a new user. Email must be a valid ITS student email (`@student.its.ac.id`) — the part before `@` becomes the user's `id` (NRP).

**Body**
```json
{
  "email": "5024241006@student.its.ac.id",
  "password": "secret123",
  "fullname": "Darren Dexter Thio",
  "username": "DarrenCasper",
  "department": "Teknik Komputer",
  "fakultas": "FTEIC"
}
```

**Response `201`**
```json
{
  "token": "<jwt>",
  "user": {
    "id": "5024241006",
    "email": "5024241006@student.its.ac.id",
    "fullname": "Darren Dexter Thio",
    "username": "DarrenCasper",
    "department": "Teknik Komputer",
    "fakultas": "FTEIC",
    "createdAt": "2026-01-01T00:00:00.000Z"
  }
}
```

**Errors**:
- `400` if any field is missing, or if the email isn't an ITS student email.
- `409` if the email or username is already taken.

---

### `POST /auth/login`

**Body**
```json
{
  "email": "5024241006@student.its.ac.id",
  "password": "secret123"
}
```

**Response `200`**: same shape as register (`token` + `user`).

**Errors**: `400` on missing fields or invalid credentials.

---

### `POST /reset/request`

Requests a password-reset OTP. Always returns a generic success message, whether or not the email exists, to avoid leaking which emails are registered. Rate-limited to 5 requests per 15 minutes per IP.

**Body**
```json
{
  "email": "5024241006@student.its.ac.id"
}
```

**Response `200`**
```json
{ "message": "If that email exist in our system, an OTP has been sent." }
```

If the email exists, a 6-digit OTP (valid for 10 minutes) is emailed to it via `sendOtpEmail`.

**Errors**:
- `400` if `email` is missing.
- `429` if the rate limit is exceeded.

---

### `POST /reset/result`

Verifies the OTP and sets a new password.

**Body**
```json
{
  "email": "5024241006@student.its.ac.id",
  "otp": "123456",
  "newPassword": "newSecret123"
}
```

**Response `200`**
```json
{ "message": "Password succesfully changed" }
```

**Errors**:
- `400` if any field is missing.
- `200` (not an error status, but not a successful reset either) if the OTP is wrong, expired, exceeded the per-OTP attempt limit (5), or no OTP was requested — with a message specific to the reason (`Incorrect OTP code`, `The OTP has expired...`, `Too many incorrect attempts...`, `No reset found on this account`). Check the `message` field, not the HTTP status, to detect this case.
- `400` if the account no longer exists (`User Account no longer existed or was deleted`).

An OTP is single-use: it's consumed on the first successful verification and cannot be reused.

---

### `POST /create/merchant` 🔒

Creates a new merchant/store and makes the caller its `OWNER`. Requires authentication.

**Headers**
```
Authorization: Bearer <jwt>
```

**Body**
```json
{
  "namaToko": "Warung Test",
  "deskripsi": "A test store"
}
```
`deskripsi` is optional.

**Response `201`**
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
        "userId": "5024241006",
        "merchantId": "...",
        "role": "OWNER",
        "joinedAt": "...",
        "user": { "id": "5024241006", "namaLengkap": "...", "email": "..." }
      }
    ]
  }
}
```

**Errors**: `401` if `namaToko` is missing or the token is missing/invalid.

## Auth

Protected routes use the `requireAuth` middleware ([src/middleware/auth.ts](src/middleware/auth.ts)), which expects:

```
Authorization: Bearer <jwt>
```

The JWT is verified against `JWT_TOKEN` from `.env`. On success, it attaches the user's id to `req.userId` (type augmentation in [src/types/express.d.ts](src/types/express.d.ts)).

Failure responses from `requireAuth`:

| Status | When |
|---|---|
| `401 "Invalid Authorization Header"` | No `Authorization` header sent |
| `401 "Invalid Authorization Header, Expected Bearer <token>"` | Header doesn't start with `Bearer ` |
| `401 "Missing Token"` | Header is `Bearer ` with nothing after it |
| `401 "Token have expired"` | JWT has expired |
| `401 "Invalid Token"` | JWT is malformed or signature doesn't match |
| `500 "JWT_TOKEN is not provided yet in .env"` | Server misconfiguration — `.env` missing `JWT_TOKEN` |

## CORS

Cross-origin requests are controlled by `ALLOWED_ORIGINS` in `.env` (comma-separated). The server refuses to start if this variable isn't set. For local frontend development, set it to your frontend's dev server URL (or `*` to allow everything while prototyping).
