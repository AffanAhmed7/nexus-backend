# Nexus Backend Server 🖥️

Nexus is a premium, enterprise-grade task management platform built for modern product development teams. This repository contains the **Express & Node.js backend server**, which powers the Nexus RESTful API, authentication system, PostgreSQL database storage via Prisma ORM, and real-time WebSockets synchronization via Socket.io.

[![Node.js](https://img.shields.io/badge/Node.js-18.0+-339933?style=flat-square&logo=node.js)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-4.18-000000?style=flat-square&logo=express)](https://expressjs.com/)
[![Prisma](https://img.shields.io/badge/Prisma-ORM-2D3748?style=flat-square&logo=prisma)](https://www.prisma.io/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15+-4169E1?style=flat-square&logo=postgresql)](https://www.postgresql.org/)
[![Socket.io](https://img.shields.io/badge/Socket.io-WebSocket-010101?style=flat-square&logo=socket.io)](https://socket.io/)

---

## ✨ Key Features

- **🔐 Robust Authentication**: Secure JWT-based authentication featuring short-lived access tokens and secure, HTTP-only refresh tokens.
- **🛡️ Access Controls**: Role-based access controls (RBAC) ensuring appropriate permissions for Workspace Admins, Project Managers, and team members.
- **🔄 Database Audit Log**: Mutation tracking audit logs mapping every database transaction to the originating user, operation type, and target entity.
- **🔌 Real-time Updates**: Dual-channel websocket streaming (Socket.io) to push task adjustments, comments, and project updates instantly to connected clients.
- **🔎 Global Searching**: Fast full-text indexes across projects, workspaces, and tasks using backend query constructs.
- **🗑️ Soft Delete Pattern**: Transparent deletion recovery protection ensuring tasks can be archived and restored rather than permanently hard deleted.

---

## 🛠️ Tech Stack & Dependencies

- **Platform**: Node.js, Express, TypeScript
- **Database ORM**: Prisma ORM with PostgreSQL driver
- **Security**: bcryptjs (Password hashing), Helmet (Secure headers), CORS (Cross-origin protection)
- **Websockets**: Socket.io
- **Authentication**: JsonWebToken (JWT)

---

## 📁 Directory Structure

```text
backend/
├── prisma/
│   ├── schema.prisma   # PostgreSQL database models, indexes, and relations
│   └── migrations/     # Generated SQL migration history logs
├── src/
│   ├── config/         # Firebase service configurations, database clients
│   ├── controllers/    # Request handlers parsing body content and business logic
│   ├── middleware/     # JWT authentication, error handling, rate limiting
│   ├── routes/         # Express endpoint mappings mapped to controllers
│   ├── services/       # Database transactions, notification dispatches
│   ├── types/          # Express Request extensions and type overrides
│   ├── utils/          # Token utilities, formatters, and helper scripts
│   └── index.ts        # Server entrypoint initializing Express and WebSockets
```

---

## 🚀 Getting Started

### 1. Prerequisites
Ensure you have **Node.js** (v18+), **PostgreSQL** (v15+) running locally or remotely, and **npm** installed.

### 2. Environment Configuration
Create a `.env` file in the root of the `backend` directory:
```env
PORT=5000
DATABASE_URL="postgresql://username:password@localhost:5432/nexus?schema=public"
JWT_ACCESS_SECRET="your_jwt_access_token_secret_here"
JWT_REFRESH_SECRET="your_jwt_refresh_token_secret_here"
CORS_ORIGIN="http://localhost:3000"
```

### 3. Installation
Install the project dependencies:
```bash
npm install
```

### 4. Database Setup & Migrations
Synchronize your local PostgreSQL schema with the Prisma models:
```bash
npx prisma migrate dev --name init
```
Generate the type-safe Prisma client:
```bash
npx prisma generate
```

### 5. Running Locally
Start the server in development mode (with auto-reload):
```bash
npm run dev
```
The API server will run at [http://localhost:5000](http://localhost:5000).

### 6. Production Compilation
To compile TypeScript and start the production server:
```bash
npm run build
npm start
```
