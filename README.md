# TalentFlow — Enterprise Recruitment Operations SaaS

TalentFlow is an enterprise recruitment operations platform covering the complete hiring lifecycle:
**Requisition approval → job criteria → candidate profiles → applications → stage-gate evaluation → interviewer availability → conflict-free panel scheduling → rubric-based scorecards → hiring decisions → compensation-band validation → offer approvals → audit history → analytics and anomaly evaluation.**

This repository demonstrates full-stack software architecture, rigorous relational database modeling, enterprise role-based access control (RBAC), finite state machine stage gates, idempotent anomaly detection, and transparent human-AI pair programming.

---

## 📋 Table of Contents
1. [Architecture & Technology Stack](#-architecture--technology-stack)
2. [10 Core Functional Areas Audit Matrix](#-10-core-functional-areas-audit-matrix)
3. [Scorecard-to-Pipeline Reflection Fix](#-scorecard-to-pipeline-reflection-fix)
4. [Quick Start & Setup Instructions](#-quick-start--setup-instructions)
5. [Role-Based Access Control & Test Accounts](#-role-based-access-control--test-accounts)
6. [Automated Test Suite & Verification](#-automated-test-suite--verification)
7. [Key Architectural Decisions & Trade-offs](#-key-architectural-decisions--trade-offs)
8. [Known Limitations & Next Steps](#-known-limitations--next-steps)
9. [Engineering Standards & Quality Checklist](#-engineering-standards--quality-checklist)

---

## 🏗️ Architecture & Technology Stack

### System Overview
```
┌────────────────────────────────────────────────────────────────────────┐
│                        TalentFlow Web Client                           │
│  React 19 • Vite • TypeScript • Tailwind CSS • TanStack Query • Zod    │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ HTTP / REST / Bearer JWT
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        TalentFlow Backend API                          │
│  Node.js 24 • Express 4 • TypeScript • Zod Validation • OpenAPI 3.0    │
│  ├── Routes: /auth, /requisitions, /candidates, /applications, ...     │
│  ├── Middleware: authenticate, hydrateUser, requireRoles, audit        │
│  └── Services: AnomalyDetector (5 types), Audit Logger, BizId Sequence │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Prisma ORM 5.22
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                     PostgreSQL 18.4 Database                           │
│  23 Relational Tables • Foreign Keys • Cascade Rules • Unique Indices  │
│  Databases: talentflow (production/dev) & talentflow_test (automated)  │
└────────────────────────────────────────────────────────────────────────┘
```

- **Frontend**: React 19, TypeScript 5.7, Vite 8, Tailwind CSS v4, Lucide icons, React Router v7, TanStack Query v5, React Hook Form, Zod, Recharts.
- **Backend API**: Node.js 24, Express 4.21, TypeScript, Zod request body/query validation, centralized error handling middleware, Swagger / OpenAPI 3.0.3 specification.
- **Database Layer**: PostgreSQL 18.4 with Prisma ORM 5.22, 23 relational tables, versioned SQL migrations, cascade deletion rules, check constraints, and monotonic business ID sequences (`REQ-2026-XXXXXX`, `CAND-XXXXXX`, `APP-XXXXXX`, `INT-XXXXXX`, `SCORE-XXXXXX`, `OFF-XXXXXX`).
- **Data Engine**: Python 3 generator with Faker and pandas for deterministic synthetic datasets and anomaly injection.
- **Testing**: Vitest 2.1 integration test suite running 28 comprehensive test cases against real PostgreSQL databases.

---

## 📊 10 Core Functional Areas Audit Matrix

Every core requirement is implemented and verified against PostgreSQL persistence:

| # | Functional Area | Implementation Details & Status | Verification Evidence |
|---|---|---|---|
| 1 | **Auth & RBAC** | JWT authentication with 8-hour expiry; bcrypt password hashing (12 rounds); strict role-based access control (`Admin`, `Recruiter`, `HiringManager`, `Interviewer`, `Approver`); user hydration middleware. | `POST /auth/login` returns token + profile; unauthorized routes reject with 401; privilege violations reject with 403. |
| 2 | **Requisitions** | Full lifecycle: Draft → PendingApproval → Open → Closed → Rejected. Department, hiring manager assignment, compensation bands (`bandMin`, `bandMax`), headcount, and skill requirements. | `GET /requisitions`, `POST /requisitions`, `PATCH /requisitions/:id`. Verified in PostgreSQL. |
| 3 | **Candidates & Applications** | "+ Add Candidate" form with validation, email uniqueness check, automatic target requisition linking, source tracking (`Referral`, `Careers Site`, `Agency`, `JobBoard`, `Campus`). | Candidates persist in `candidates` table; automatic `applications` record creation for Open requisitions. |
| 4 | **Pipeline & Stage Gates** | Finite State Machine (FSM): `Applied` → `Screen` → `Interview` → `Final` → `Offer` → `Hired` (or `Withdrawn`). Stage gate enforcement: Scorecard required for `Final`; positive recommendation required for `Offer`; approved offer required for `Hired`. | Kanban drag/move controls; `checkGate` middleware throws `422 GATE_SCORECARD_REQUIRED` or `422 GATE_RECOMMENDATION_REQUIRED`. |
| 5 | **Scheduling & Availability** | 5-day × 3-block availability matrices per interviewer; anti-overlap collision detection (prevents double-booking same interviewer across overlapping time slots); panel assignment. | `GET /interviews`, `POST /interviews`; conflict detection surfaces in Exceptions. |
| 6 | **Scorecards & Rubric** | 5-criterion rubric (`technical`, `problem`, `communication`, `collaboration`, `values`); 1–5 integer ratings; recommendations (`StrongYes`, `Yes`, `No`, `StrongNo`); qualitative notes. Recalculates application match score. | `POST /scorecards` updates `Application.score`; dynamic reflection in Pipeline card. |
| 7 | **Offers & Approvals** | Base salary, bonus percentage, compensation band compliance check (`base <= bandMax`); separation of duties: Approvers decide pending offers and requisitions. | `GET /offers`, `POST /offers`, `GET /approvals`, `POST /approvals/:id/decide`. |
| 8 | **Anomalies & Exceptions** | Automated detector covering **all 5 required anomaly types**: `MissingReview`, `InterviewerDoubleBooked`, `OfferExceedsBand`, `WithdrawnCandidateStillScheduled`, `IrrelevantScorecardCriterion`. Idempotent status preservation. | `GET /anomalies`, `POST /anomalies/detect`; 15 Vitest tests pass in `anomalies.test.ts`. |
| 9 | **Data Quality & Audit** | Immutable `audit_events` table recording every actor action (`actorId`, `action`, `entity`, `entityId`, `metadata`, `createdAt`). Synthetic data generation metrics. | Every state mutation writes an audit event. Verified in PostgreSQL. |
| 10 | **Persistence vs Demo Mode** | Zero mock fallback when connected to backend. Real PostgreSQL database storage across all entities. | `VITE_DEMO_MODE=false`; real database records verified via Prisma Client and REST endpoints. |

---

## 🔍 Scorecard-to-Pipeline Reflection Fix

### Root Cause Analysis
During initial implementation, submitting a scorecard for a candidate (e.g. John Doe or Jordan Reed) did not update the candidate card in the Pipeline view (`/pipeline`):
1. **Missing Database Persistence**: `POST /api/v1/scorecards` inserted the scorecard and rating records into `scorecards` and `scorecard_ratings`, but never updated `Application.score` in the database.
2. **DTO Omission**: `GET /api/v1/applications` only selected top-level `Application` columns without joining the `scorecards` relation, returning static seed scores or `null`.
3. **Frontend Presentation**: `src/pages/Pipeline.tsx` rendered only `<Badge tone="indigo">Score {a.score}</Badge>`, displaying `Score null` or `Score 0` with no display of reviewer recommendation or review status.

### The Solution
1. **Backend Route Enhancement (`backend/src/routes/scorecards.ts`)**:
   - On every scorecard submission, the API fetches all scorecards for the target application, computes the overall rubric average rating, and updates `Application.score` in PostgreSQL.
2. **Applications Route Enhancement (`backend/src/routes/applications.ts`)**:
   - `appInclude` now joins `scorecards` (with ratings and recommendations) and `interviews`.
   - `toDto` calculates and returns `avgRating` (e.g. `4.4`, `3.8`), `latestRecommendation` (`StrongYes`, `Yes`, `No`, `StrongNo`), `scorecardCount`, and `hasPendingReview` (true if an interview is scheduled/completed without a scorecard).
3. **Frontend UI Rendering (`src/pages/Pipeline.tsx`)**:
   - Candidate cards in both Kanban board and Table view dynamically display:
     - Rating badge: `★ 4.4 / 5` or `Score 4.4`
     - Recommendation badge with tone: `<Badge tone="green">Strong Yes</Badge>` or `<Badge tone="red">No</Badge>`
     - Pending Review badge: `<Badge tone="amber">Pending Review</Badge>` if interviews are completed without a scorecard.
4. **Automated Regression Test (`backend/src/tests/pipeline_scorecard.test.ts`)**:
   - Integration tests verify that John Doe and Jordan Reed reflect their scorecard ratings in the pipeline, and that submitting a new scorecard dynamically recalculates and propagates the match score to `GET /api/v1/applications`.

---

## 🚀 Quick Start & Setup Instructions

### 1. Prerequisites
- **Node.js**: >= 20.6.0 (v24.17.0 recommended)
- **PostgreSQL**: Version 16+ (tested on PostgreSQL 18.4, listening on port `5433` or `5432`)
- **Package Manager**: npm (v10+)

### 2. Environment Configuration

#### Backend `.env` (`backend/.env`):
```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5433/talentflow?schema=public"
TEST_DATABASE_URL="postgresql://postgres:postgres@localhost:5433/talentflow_test?schema=public"
JWT_SECRET="talentflow-super-secure-production-ready-jwt-secret-key-32chars"
JWT_EXPIRES_IN="8h"
PORT=8080
NODE_ENV="development"
CORS_ORIGIN="http://localhost:5173"
BCRYPT_ROUNDS=12
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=500
```

#### Frontend `.env` (`.env` in repository root):
```env
VITE_API_BASE_URL=http://localhost:8080
VITE_DEMO_MODE=false
```

### 3. Database Initialization & Starter Seed
Run migrations and populate the database with the complete starter dataset:
```bash
# From the repository root:
cd backend
npm install
npx prisma migrate deploy
npm run db:seed
```

### 4. Running the Backend API
```bash
cd backend
npm run build
npm start
# Alternatively, for live TypeScript reloading:
# npm run dev
```
The server will start at `http://localhost:8080`.
- **API Health**: `http://localhost:8080/api/v1/health`
- **Interactive Swagger UI**: `http://localhost:8080/api/v1/docs`
- **OpenAPI 3.0 JSON**: `http://localhost:8080/api/v1/openapi.json`

### 5. Running the Frontend
```bash
# In the repository root:
npm install
npm run dev
```
Open `http://localhost:5173` in your browser.

---

## 👥 Role-Based Access Control & Test Accounts

All starter accounts are provisioned with password **`TalentFlow2026!`**:

| Persona / Name | Email | Role | Accessible Capabilities |
|---|---|---|---|
| **Meera Joshi** | `meera@example.test` | **Admin** | System configuration, user management, audit review, anomaly override. |
| **Chris Alder** | `chris@example.test` | **Recruiter** | Candidate management, requisition drafting, pipeline stage advancement. |
| **Dana Whitfield** | `dana@example.test` | **Hiring Manager** | Requisition creation, interview requests, candidate scorecard review. |
| **Samir Qureshi** | `samir@example.test` | **Interviewer** | Availability calendar submission, rubric scorecard evaluation. |
| **Lena Fischer** | `lena@example.test` | **Approver** | Requisition headcount approval, compensation offer authorization. |

*Switching personas in the UI*: Use the user profile avatar in the top-right header to switch between personas instantly.

---

## 🧪 Automated Test Suite & Verification

TalentFlow features 28 automated integration tests using Vitest and Supertest:

```bash
cd backend
npm test
```

### Test Results Breakdown:
```text
Test Files  3 passed (3)
     Tests  28 passed (28)

✓ src/tests/health.test.ts (9 tests)
  ✓ GET /api/v1/health returns 200 ok and db connected
  ✓ Serves OpenAPI 3.0.3 specification and Swagger UI
  ✓ JWT Authentication rejects unauthenticated / invalid requests
  ✓ Error handling validates Zod schema and 404 responses

✓ src/tests/pipeline_scorecard.test.ts (4 tests)
  ✓ GET /api/v1/applications returns scorecard aggregates and ratings
  ✓ Reflects John Doe's scorecard rating (4.4) and recommendation (StrongYes) in Pipeline
  ✓ Reflects Jordan Reed's scorecard rating (3.8) and recommendation (StrongYes) in Pipeline
  ✓ Dynamically propagates new scorecard submission to application match score and PostgreSQL

✓ src/tests/anomalies.test.ts (15 tests)
  ✓ Detects all 5 required anomaly types in the system
  ✓ Detects MissingReview (> 48h completed interview without review)
  ✓ Detects InterviewerDoubleBooked (calendar time conflict)
  ✓ Detects OfferExceedsBand (compensation exceeding bandMax)
  ✓ Detects WithdrawnCandidateStillScheduled (withdrawn candidate with upcoming interview)
  ✓ Detects IrrelevantScorecardCriterion (unapproved rubric criteria)
  ✓ Verifies detector idempotency (no duplicate entries on repeated runs)
  ✓ Verifies status preservation (Investigating / Resolved states preserved)
  ✓ Verifies REST endpoints and audit logging on anomaly status patch
```

---

## 💡 Key Architectural Decisions & Trade-offs

1. **Relational Database (PostgreSQL) with Strict Referential Integrity**:
   - *Decision*: Adopted PostgreSQL with Prisma ORM rather than a NoSQL or document store.
   - *Rationale*: Recruitment operations require ACID transactions, unique candidate email constraints, foreign-key cascades, and monotonic sequence generation.
2. **Stateless JWT with Server-Side Hydration**:
   - *Decision*: Issued stateless 8-hour JWTs while hydrating the active user and role from the database on every authenticated request.
   - *Rationale*: Eliminates Redis session overhead for local setups while ensuring immediate revocation if a user is deactivated or role-demoted.
3. **Finite State Machine (FSM) Stage Transitions**:
   - *Decision*: Hardcoded valid stage gate transitions and gate validation rules directly into `applications.ts`.
   - *Rationale*: Prevents invalid workflow jumps (e.g. `Applied` directly to `Hired`) and ensures mandatory compliance checkpoints (scorecards, approvals) cannot be bypassed.
4. **Idempotent Anomaly Detection Service**:
   - *Decision*: Implemented rule-based anomaly detection as an idempotent database scan rather than reactive triggers.
   - *Rationale*: Allows manual re-triggering via `POST /api/v1/anomalies/detect` while preserving human reviewer statuses (`Investigating`, `Resolved`) without duplicate generation.

---

## ⚠️ Known Limitations & Next Steps

1. **Email Notification Dispatch**:
   - Candidate invitation emails and interviewer notification reminders are currently logged to audit events and displayed in the UI rather than dispatched via SMTP/SendGrid.
2. **Calendar Sync (Google / Outlook)**:
   - Interview scheduling uses internal 5-day × 3-block availability matrices and timestamp collision checks. Direct integration with Google Calendar API or CalDAV can be added via webhook workers.
3. **Resume Parsing**:
   - Candidate skills and profile information are entered via structured forms or synthetic generation. Integrating an asynchronous NLP parser (e.g. via PDF text extraction) would automate CV ingestion.

---

## 📜 Engineering Standards & Quality Checklist

| Standard / Requirement | Project Status & Location |
|---|---|
| **Executable Code & Setup** | Complete, working code; setup instructions verified on clean clone; PostgreSQL migrations and seed scripts automated. |
| **Clean Code & Structure** | Meaningful structure, clear directory organization, modular architecture, zero intermediate binaries. |
| **Transparent AI Usage** | Prompt history summaries, acceleration disclosure, and human validation documented in [`docs/AI_PROMPT_HISTORY.md`](docs/AI_PROMPT_HISTORY.md). |
| **Visible Reasoning & Decisions** | Architectural decisions, trade-offs, and limitations detailed in README and [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md). |
| **Security & Zero Secrets** | Zero credentials or production secrets committed; `.env` excluded via `.gitignore`; safe local defaults. |
| **Code Ownership & Testing** | 28 automated integration tests passing; all code, database schemas, and API routes thoroughly reviewed and owned. |
