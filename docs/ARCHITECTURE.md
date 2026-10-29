# TalentFlow Architecture & System Design

## 1. System Architecture

TalentFlow is designed as a **Modular Monolith** pairing a React 19 + TypeScript enterprise frontend with a Node.js + Express + Prisma + PostgreSQL production API, supported by an offline Python synthetic data & validation engine.

```mermaid
flowchart TD
    subgraph Client ["Frontend Client (React 19 + TypeScript + Vite)"]
        UI["UI Components & Pages (Tailwind v4)"]
        ClientAPI["Typed API Client (src/api/client.ts)"]
        TanStack["TanStack Query Cache"]
        MockStore["In-memory Mock Store (Fallback only)"]
    end

    subgraph API ["Backend API (Node.js + Express + TypeScript)"]
        Router["Express Router (/api/v1)"]
        AuthMiddleware["JWT Authentication & RBAC Middleware"]
        ValMiddleware["Zod Request Validation"]
        Swagger["OpenAPI / Swagger UI (/api/v1/docs)"]
        BizLogic["Stage Gates, Anti-Collision Scheduling, Offer Verification"]
        PrismaORM["Prisma Client"]
    end

    subgraph Database ["Persistence Layer (PostgreSQL 18)"]
        PG[(PostgreSQL DB: talentflow)]
        Sequences[("id_sequences Atomic Table")]
    end

    subgraph Offline ["Data Engine (Python 3)"]
        Generator["Synthetic Generator (Faker + Pandas)"]
        AnomalyInjector["Anomaly Injection Pipeline"]
        Validator["Evaluation & Ground Truth Verification"]
    end

    UI --> TanStack
    TanStack --> ClientAPI
    ClientAPI -. "Fallback if unreachable" .-> MockStore
    ClientAPI --> Router
    Router --> AuthMiddleware
    AuthMiddleware --> ValMiddleware
    ValMiddleware --> BizLogic
    BizLogic --> PrismaORM
    PrismaORM --> PG
    BizLogic --> Sequences
    Offline -. "Exports CSV / JSON / Seed" .-> Database
```

## 2. Security & Access Control Model
- **Authentication**: JWT bearer tokens signed with HMAC-SHA256 (`JWT_SECRET` min 32 chars).
- **Role-Based Access Control (RBAC)**:
  - `Admin`: Full organizational control, role assignment, settings.
  - `Recruiter`: Requisition creation, candidate sourcing, stage transitions, offer preparation.
  - `HiringManager`: Requisition submission, application reviews, scorecard assessments.
  - `Interviewer`: Panel evaluations, rubric ratings, availability management.
  - `Approver`: Separation-of-duties authorization for requisitions and offers.
- **Separation of Duties**: Requisitions and offers cannot be approved by their requester.
- **Audit Logging**: Every mutation emits an immutable `AuditEvent` capturing actor, action, entity, before-state, after-state, and timestamps.

