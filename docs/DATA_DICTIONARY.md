# TalentFlow Data Dictionary

This document details all 23 entities, columns, data types, constraints, and business semantics in the TalentFlow PostgreSQL database.

---

### 1. `users`
System actors, credentials, and roles.

| Column | Type | Nullable | Constraints / Default | Description |
|---|---|---|---|---|
| `id` | `UUID` | No | PK, default `gen_random_uuid()` | Internal unique identifier |
| `businessId` | `VARCHAR(20)` | No | UNIQUE (`USR-000001`) | Immutable public identifier |
| `name` | `VARCHAR(200)` | No | | Full name |
| `email` | `VARCHAR(300)` | No | UNIQUE | Work email |
| `role` | `UserRole` enum | No | `Admin`, `Recruiter`, `HiringManager`, `Interviewer`, `Approver` | Access level |
| `active` | `BOOLEAN` | No | Default `true` | Account active status |
| `passwordHash`| `VARCHAR(200)` | No | bcrypt cost 12 | Hashed password |
| `createdAt` | `TIMESTAMPTZ` | No | Default `now()` | Record creation timestamp |
| `updatedAt` | `TIMESTAMPTZ` | No | Auto-update | Last modification timestamp |

---

### 2. `hiring_managers`
Department-level hiring authorities linked 1:1 to Users.

| Column | Type | Nullable | Constraints / Default | Description |
|---|---|---|---|---|
| `id` | `UUID` | No | PK | Internal identifier |
| `userId` | `UUID` | No | UNIQUE, FK `users(id)` | Linked user account |
| `department` | `VARCHAR(100)` | No | | Assigned business department |
| `createdAt` | `TIMESTAMPTZ` | No | Default `now()` | Creation timestamp |

---

### 3. `requisitions`
Job openings and approved headcount specifications.

| Column | Type | Nullable | Constraints / Default | Description |
|---|---|---|---|---|
| `id` | `UUID` | No | PK | Internal identifier |
| `businessId` | `VARCHAR(20)` | No | UNIQUE (`REQ-YYYY-000001`) | Immutable public requisition ID |
| `title` | `VARCHAR(200)` | No | | Job role title |
| `department` | `VARCHAR(100)` | No | | Sponsoring department |
| `location` | `VARCHAR(100)` | No | | Target office or Remote |
| `hiringManagerId` | `UUID` | No | FK `hiring_managers(id)` | Requisition owner |
| `headcount` | `INTEGER` | No | Check > 0 | Target hires |
| `status` | `RequisitionStatus` enum | No | `Draft`, `PendingApproval`, `Open`, `Closed`, `Rejected` | Operational state |
| `bandMin` | `DECIMAL(12, 2)` | No | | Compensation minimum |
| `bandMax` | `DECIMAL(12, 2)` | No | | Compensation maximum |
| `createdAt` | `TIMESTAMPTZ` | No | Default `now()` | Creation timestamp |
| `updatedAt` | `TIMESTAMPTZ` | No | Auto-update | Last modification timestamp |

---

### 4. `candidates`
Synthetic candidate profile directory.

| Column | Type | Nullable | Constraints / Default | Description |
|---|---|---|---|---|
| `id` | `UUID` | No | PK | Internal identifier |
| `businessId` | `VARCHAR(20)` | No | UNIQUE (`CAND-000001`) | Candidate business ID |
| `name` | `VARCHAR(200)` | No | | Full name |
| `email` | `VARCHAR(300)` | No | UNIQUE (`@example.test`) | Synthetic candidate email |
| `phone` | `VARCHAR(30)` | Yes | | Phone number |
| `location` | `VARCHAR(100)` | No | | Candidate location |
| `source` | `CandidateSource` enum | No | `Referral`, `CareerssSite`, `Agency`, `JobBoard`, `Campus` | Sourcing channel |
| `experienceYears` | `SMALLINT` | No | | Years of domain experience |
| `skills` | `TEXT[]` | No | | Tagged skills array |
| `createdAt` | `TIMESTAMPTZ` | No | Default `now()` | Creation timestamp |
| `updatedAt` | `TIMESTAMPTZ` | No | Auto-update | Modification timestamp |

---

### 5. `applications`
Candidate application lifecycle against a specific requisition.

| Column | Type | Nullable | Constraints / Default | Description |
|---|---|---|---|---|
| `id` | `UUID` | No | PK | Internal identifier |
| `businessId` | `VARCHAR(100)` | No | UNIQUE (`APP-<CAND>-<REQ>`) | Canonical composite application ID |
| `candidateId` | `UUID` | No | FK `candidates(id)` | Applicant |
| `requisitionId` | `UUID` | No | FK `requisitions(id)` | Targeted requisition |
| `stage` | `ApplicationStage` enum | No | Default `Applied` | Current stage in evaluation matrix |
| `score` | `DECIMAL(5, 2)` | Yes | | Weighted score (1.00 – 5.00) |
| `source` | `CandidateSource` enum | No | | Ingress source |
| `createdAt` | `TIMESTAMPTZ` | No | Default `now()` | Ingress timestamp |
| `updatedAt` | `TIMESTAMPTZ` | No | Auto-update | Last stage movement timestamp |

---

### 6. `stage_events`
Audit log of every stage-gate transition for an application.

| Column | Type | Nullable | Constraints / Default | Description |
|---|---|---|---|---|
| `id` | `UUID` | No | PK | Internal identifier |
| `applicationId` | `UUID` | No | FK `applications(id)` | Associated application |
| `fromStage` | `ApplicationStage` | Yes | Null for initial application | Previous stage |
| `toStage` | `ApplicationStage` | No | | Reached stage |
| `actorId` | `UUID` | No | FK `users(id)` | Transition operator |
| `reason` | `TEXT` | Yes | | Justification or decision note |
| `createdAt` | `TIMESTAMPTZ` | No | Default `now()` | Transition timestamp |

---

### 7. `interviews`
Scheduled or completed evaluation rounds.

| Column | Type | Nullable | Constraints / Default | Description |
|---|---|---|---|---|
| `id` | `UUID` | No | PK | Internal identifier |
| `businessId` | `VARCHAR(20)` | No | UNIQUE (`INT-YYYY-000001`) | Public interview reference |
| `applicationId` | `UUID` | No | FK `applications(id)` | Evaluated candidate application |
| `panelId` | `UUID` | No | FK `interview_panels(id)` | Assigned interview panel |
| `title` | `VARCHAR(200)` | No | | Loop or round title |
| `startAt` | `TIMESTAMPTZ` | No | Index | Scheduled start (UTC) |
| `endAt` | `TIMESTAMPTZ` | No | Half-open [startAt, endAt) | Scheduled end (UTC) |
| `status` | `InterviewStatus` enum | No | `Scheduled`, `Completed`, `Cancelled`, `Rescheduled` | Round state |
| `originalStartAt`| `TIMESTAMPTZ` | Yes | | Pre-reschedule timestamp |
| `cancelReason` | `TEXT` | Yes | | Cancellation explanation |
| `createdAt` | `TIMESTAMPTZ` | No | Default `now()` | Booking creation timestamp |
| `updatedAt` | `TIMESTAMPTZ` | No | Auto-update | Last status update |

---

### 8. `scorecards`
Structured rubric assessments submitted by interviewers.

| Column | Type | Nullable | Constraints / Default | Description |
|---|---|---|---|---|
| `id` | `UUID` | No | PK | Internal identifier |
| `businessId` | `VARCHAR(100)` | No | UNIQUE (`SCORE-<INT>-<USR>`) | Business reference |
| `interviewId` | `UUID` | No | FK `interviews(id)` | Round evaluated |
| `interviewerId` | `UUID` | No | FK `interviewers(id)` | Reviewer |
| `applicationId` | `UUID` | No | FK `applications(id)` | Associated application |
| `recommendation`| `ScorecardRecommendation` | No | `StrongYes`, `Yes`, `No`, `StrongNo` | Hiring recommendation |
| `notes` | `TEXT` | Yes | | Evaluator qualitative feedback |
| `submittedAt` | `TIMESTAMPTZ` | No | Default `now()` | Submission timestamp |

---

### 9. `offers`
Compensation packages generated for final candidates.

| Column | Type | Nullable | Constraints / Default | Description |
|---|---|---|---|---|
| `id` | `UUID` | No | PK | Internal identifier |
| `businessId` | `VARCHAR(20)` | No | UNIQUE (`OFF-YYYY-000001`) | Offer reference |
| `applicationId` | `UUID` | No | UNIQUE, FK `applications(id)` | One offer per application |
| `base` | `DECIMAL(12, 2)` | No | | Annual base salary |
| `bonusPct` | `DECIMAL(5, 2)` | No | | Target bonus percentage |
| `bandMin` | `DECIMAL(12, 2)` | No | | Captured requisition band min |
| `bandMax` | `DECIMAL(12, 2)` | No | | Captured requisition band max |
| `status` | `OfferStatus` enum | No | `PendingApproval`, `Approved`, `Rejected`, `Sent`, `Accepted`, `Declined` | Workflow state |
| `outOfBand` | `BOOLEAN` | No | Default `false` | True if base > bandMax or base < bandMin |
| `createdAt` | `TIMESTAMPTZ` | No | Default `now()` | Generation timestamp |
| `updatedAt` | `TIMESTAMPTZ` | No | Auto-update | Last status update |

---

### 10. `approvals`
Audit-gated approval workflow for requisitions and compensation offers.

| Column | Type | Nullable | Constraints / Default | Description |
|---|---|---|---|---|
| `id` | `UUID` | No | PK | Internal identifier |
| `businessId` | `VARCHAR(20)` | No | UNIQUE (`APR-000001`) | Approval business reference |
| `subjectType` | `ApprovalSubjectType` | No | `Requisition`, `Offer` | Subject entity type |
| `subjectId` | `UUID` | No | | Target entity primary key |
| `subjectLabel`| `VARCHAR(300)` | No | | Human readable descriptor |
| `requestedById`| `UUID` | No | FK `users(id)` | Requester |
| `approverId` | `UUID` | Yes | FK `users(id)` | Decider (separation of duties enforced) |
| `status` | `ApprovalStatus` enum | No | `Pending`, `Approved`, `Rejected` | Decision state |
| `reason` | `TEXT` | Yes | | Decision justification |
| `createdAt` | `TIMESTAMPTZ` | No | Default `now()` | Submission timestamp |
| `decidedAt` | `TIMESTAMPTZ` | Yes | | Timestamp when decision recorded |

---

### 11. `id_sequences`
Atomic sequence counter store for race-condition-free human-readable business IDs.

| Column | Type | Nullable | Constraints / Default | Description |
|---|---|---|---|---|
| `scope` | `VARCHAR(50)` | No | PK | Sequence prefix scope (`USR`, `REQ-2026`, `CAND`, etc.) |
| `next_val` | `INTEGER` | No | Default `1` | Next sequential counter value |
| `updated_at` | `TIMESTAMPTZ` | No | Auto-update | Counter bump timestamp |

