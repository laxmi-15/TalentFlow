# TalentFlow — AI Prompt History & Usage Disclosure

*A concise, transparent record of AI pair-programming, prompt history summaries, and engineering validation across the TalentFlow project lifecycle.*

---

## 1. Transparent AI Usage Disclosure

TalentFlow was developed through collaboration between a human software engineer and AI coding assistants. Generative AI tools were utilized to accelerate boilerplate scaffolding, initial schema drafts, and test scenarios. All core architecture, business logic, security authorization, stage gates, bug remediation, and quality validation were directed, implemented, and verified by the engineer.

### Where AI Accelerated Development:
- Initial frontend UI component layouts and client-side routing scaffolding.
- Relational schema boilerplate for Prisma models and OpenAPI 3.0 specification drafting.
- Initial draft rule logic for anomaly detection and synthetic test fixtures.

### Human Engineering Responsibilities & Validation:
- **Scorecard & Pipeline Sync**: Diagnosed why submitted scorecard ratings were missing in `/pipeline`, implemented database persistence for recalculated scores, added relational joins in Express DTOs, and updated the UI badges in Kanban and Table views.
- **Persistence & API Integration**: Eliminated mock fallback in the frontend client, configuring real PostgreSQL persistence via Express REST endpoints.
- **Database & Environment Setup**: Configured PostgreSQL on port 5433, resolved local port conflicts, and deployed non-destructive migrations and seeds.
- **RBAC & Stage Gates**: Enforced strict interviewer permissions on scorecards and implemented state machine gates (`Applied` → `Hired`).
- **Anomaly Detection & Idempotency**: Expanded detector from 3 to 5 required anomaly types, resolved database column truncation issues, and verified detector idempotency.
- **Testing & Verification**: Created regression test suites; verified 28/28 integration tests passing and clean frontend production builds.

---

## 2. Chronological Prompt Summaries

*Note on methodology: All prompts below are summarized and reconstructed records from interactive engineering sessions to provide a clear, concise, and professional historical record. They are not presented as verbatim originals.*

### Milestone 1: System Architecture & Full-Stack Scope [Summarized Record]
- **Intent**: Establish full-stack recruitment operations SaaS architecture using an existing React frontend, Node.js/Express REST backend, PostgreSQL with Prisma ORM, a Python synthetic data engine, and automated Vitest testing.
- **Outcome**: Established project layout, Express entry point, initial Prisma schema models, and OpenAPI documentation structure.

### Milestone 2: Repository Audit & Technical Baseline [Summarized Record]
- **Intent**: Perform an audit of the codebase, identifying required manual setup steps, configuration needs, and verifying dependencies without third-party paid services.
- **Outcome**: Documented actual code state, validated that no external API keys were required, and prepared environment configuration.

### Milestone 3: Database Connectivity & Starter Profile Seeding [Summarized Record]
- **Intent**: Automate PostgreSQL connection on port 5433, validate Prisma migrations non-destructively, exclude `.env` from version control, and seed deterministic starter data.
- **Outcome**: Connected PostgreSQL on port 5433; Prisma schema migrated; seeded 10 starter candidates, users with 5 enterprise roles, requisitions, and rubric criteria.

### Milestone 4: Frontend-to-Backend Integration & Demo Fallback Removal [Summarized Record]
- **Intent**: Debug why the frontend displayed "Demo mode. The API is not connected" despite the backend health endpoint returning 200 OK.
- **Outcome**: Fixed API base URL routing to `http://localhost:8080/api/v1`, verified CORS, and ensured login and session tokens talk directly to PostgreSQL.

### Milestone 5: Disabling Silent Client Fallbacks [Summarized Record]
- **Intent**: Remove internal client logic that silently fell back to synthetic demo data on API errors, ensuring true database-backed responses.
- **Outcome**: Updated client configuration (`VITE_DEMO_MODE=false`), surfacing authentic backend errors and connecting all views to live endpoints.

### Milestone 6: Candidate Creation Flow Implementation [Summarized Record]
- **Intent**: Implement a complete "+ Add Candidate" button and modal on `/candidates`, validating fields, ensuring email uniqueness, and saving directly to PostgreSQL.
- **Outcome**: Added responsive candidate creation form with Zod validation, linked candidates to target requisitions, and verified persistence in the database.

### Milestone 7: Candidate Requisition Linking & Interview Scheduling [Summarized Record]
- **Intent**: Investigate why newly created candidates did not appear in the "Add Interview" candidate dropdown.
- **Outcome**: Resolved candidate eligibility filters, ensuring candidates with active applications for open requisitions populate the scheduling dropdown without bypassing stage gates.

### Milestone 8: Scorecard Role-Based Submission Permissions [Summarized Record]
- **Intent**: Resolve a 403 permission error ("I don't have permission to do this") when submitting scorecards for interviewed candidates.
- **Outcome**: Corrected interviewer profile lookup in the authorization middleware so assigned panel interviewers and administrators can submit rubric evaluations with audit logging.

### Milestone 9: Anomaly Detection Engine Completion [Summarized Record]
- **Intent**: Expand the anomaly detector from 3 to 5 required anomaly types and resolve conflict detection for concurrent interview bookings.
- **Outcome**: Implemented all 5 anomaly types (`MissingReview`, `InterviewerDoubleBooked`, `OfferExceedsBand`, `WithdrawnCandidateStillScheduled`, `IrrelevantScorecardCriterion`), resolved database string truncation limits, and verified detector idempotency.

### Milestone 10: Scorecard-to-Pipeline Reflection Fix & Verification [Summarized Record]
- **Intent**: Fix candidate card inconsistency in `/pipeline` where submitted scorecard ratings did not appear on candidate cards, and verify full-stack compliance across all 10 core functional areas.
- **Outcome**: Dynamically recalculated application match scores on scorecard submission, joined scorecard aggregates in `GET /applications`, added visual rating, recommendation, and pending review badges to Pipeline views, and added automated regression tests.

---

## 3. Verification Evidence & Outcomes

- **Backend Integration Tests**: 28 passing tests across 3 suites (`health.test.ts`, `anomalies.test.ts`, `pipeline_scorecard.test.ts`) executed against PostgreSQL.
- **Frontend Production Build**: `npm run build` (`tsc -b && vite build`) compiles with zero TypeScript errors or warnings.
- **Persistence Verification**: Real database state verified in PostgreSQL with zero synthetic mock fallbacks.
- **Security & Secrets**: Verified no secrets or credentials committed; environment templates use safe placeholders.
- **Known Limitations**: Email notifications and external calendar sync are logged to audit events rather than dispatched to external third-party services.
