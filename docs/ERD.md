# TalentFlow Database Entity-Relationship Diagram (ERD)

The following diagram represents the complete PostgreSQL relational schema implemented via Prisma ORM for TalentFlow.

```mermaid
erDiagram
    User ||--o| HiringManager : "is"
    User ||--o| Interviewer : "is"
    User ||--o{ Approval : "requests"
    User ||--o{ Approval : "decides"
    User ||--o{ AuditEvent : "performs"
    User ||--o{ StageEvent : "triggers"

    HiringManager ||--o{ Requisition : "manages"
    Requisition ||--o{ SkillRequirement : "requires"
    Requisition ||--o{ Application : "receives"

    Candidate ||--o{ Application : "submits"

    Application ||--o{ StageEvent : "tracks"
    Application ||--o{ Interview : "schedules"
    Application ||--o| Offer : "receives"
    Application ||--o{ Scorecard : "evaluated_by"

    Interviewer ||--o{ Availability : "maintains"
    Interviewer ||--o{ InterviewPanelMember : "belongs_to"
    Interviewer ||--o{ InterviewInterviewer : "attends"
    Interviewer ||--o{ Scorecard : "submits"

    InterviewPanel ||--o{ InterviewPanelMember : "comprises"
    InterviewPanel ||--o{ Interview : "conducts"

    Interview ||--o{ InterviewInterviewer : "assigns"
    Interview ||--o{ Scorecard : "produces"

    Scorecard ||--o{ ScorecardRating : "contains"
    RubricCriterion ||--o{ ScorecardRating : "rated_in"

    GenerationRun ||--o{ ValidationResult : "validates"
```

## Immutable Business ID Schemes
- **User**: `USR-000001`
- **Requisition**: `REQ-YYYY-000001`
- **Candidate**: `CAND-000001`
- **Application**: `APP-CAND-000001-REQ-YYYY-000001`
- **Interview Panel**: `PNL-000001`
- **Interview**: `INT-YYYY-000001`
- **Scorecard**: `SCORE-INT-YYYY-000001-USR-000004`
- **Offer**: `OFF-YYYY-000001`
- **Approval**: `APR-000001`
- **Audit Event**: `AUD-000001`
- **Generation Run**: `GEN-000001`

