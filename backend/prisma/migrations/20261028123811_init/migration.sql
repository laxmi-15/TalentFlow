-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('Admin', 'Recruiter', 'HiringManager', 'Interviewer', 'Approver');

-- CreateEnum
CREATE TYPE "RequisitionStatus" AS ENUM ('Draft', 'PendingApproval', 'Open', 'Closed', 'Rejected');

-- CreateEnum
CREATE TYPE "CandidateSource" AS ENUM ('Referral', 'CareerssSite', 'Agency', 'JobBoard', 'Campus');

-- CreateEnum
CREATE TYPE "ApplicationStage" AS ENUM ('Applied', 'Screen', 'Interview', 'Final', 'Offer', 'Hired', 'Withdrawn');

-- CreateEnum
CREATE TYPE "InterviewStatus" AS ENUM ('Scheduled', 'Completed', 'Cancelled', 'Rescheduled');

-- CreateEnum
CREATE TYPE "ScorecardRecommendation" AS ENUM ('StrongYes', 'Yes', 'No', 'StrongNo');

-- CreateEnum
CREATE TYPE "OfferStatus" AS ENUM ('PendingApproval', 'Approved', 'Rejected', 'Sent', 'Accepted', 'Declined');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('Pending', 'Approved', 'Rejected');

-- CreateEnum
CREATE TYPE "ApprovalSubjectType" AS ENUM ('Requisition', 'Offer');

-- CreateEnum
CREATE TYPE "AnomalySeverity" AS ENUM ('Low', 'Medium', 'High', 'Critical');

-- CreateEnum
CREATE TYPE "AnomalyStatus" AS ENUM ('Open', 'Investigating', 'Resolved');

-- CreateEnum
CREATE TYPE "GenerationProfile" AS ENUM ('starter', 'full');

-- CreateEnum
CREATE TYPE "GenerationStatus" AS ENUM ('Pending', 'Running', 'Completed', 'Failed');

-- CreateEnum
CREATE TYPE "AnomalyIssueType" AS ENUM ('MissingReview', 'InterviewerDoubleBooked', 'OfferExceedsBand', 'WithdrawnCandidateScheduled', 'IrrelevantScorecardCriteria');

-- CreateTable
CREATE TABLE "id_sequences" (
    "scope" TEXT NOT NULL,
    "next_val" INTEGER NOT NULL DEFAULT 1,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "id_sequences_pkey" PRIMARY KEY ("scope")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "businessId" VARCHAR(20) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "email" VARCHAR(300) NOT NULL,
    "role" "UserRole" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "passwordHash" VARCHAR(200) NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hiring_managers" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "department" VARCHAR(100) NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hiring_managers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "requisitions" (
    "id" UUID NOT NULL,
    "businessId" VARCHAR(20) NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "department" VARCHAR(100) NOT NULL,
    "location" VARCHAR(100) NOT NULL,
    "hiringManagerId" UUID NOT NULL,
    "headcount" INTEGER NOT NULL,
    "status" "RequisitionStatus" NOT NULL DEFAULT 'Draft',
    "bandMin" DECIMAL(12,2) NOT NULL,
    "bandMax" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "requisitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "skill_requirements" (
    "id" UUID NOT NULL,
    "requisitionId" UUID NOT NULL,
    "skill" VARCHAR(100) NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "minYears" SMALLINT,

    CONSTRAINT "skill_requirements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "candidates" (
    "id" UUID NOT NULL,
    "businessId" VARCHAR(20) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "email" VARCHAR(300) NOT NULL,
    "phone" VARCHAR(30),
    "location" VARCHAR(100) NOT NULL,
    "source" "CandidateSource" NOT NULL,
    "experienceYears" SMALLINT NOT NULL,
    "skills" TEXT[],
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "candidates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "applications" (
    "id" UUID NOT NULL,
    "businessId" VARCHAR(100) NOT NULL,
    "candidateId" UUID NOT NULL,
    "requisitionId" UUID NOT NULL,
    "stage" "ApplicationStage" NOT NULL DEFAULT 'Applied',
    "score" DECIMAL(5,2),
    "source" "CandidateSource" NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stage_events" (
    "id" UUID NOT NULL,
    "applicationId" UUID NOT NULL,
    "fromStage" "ApplicationStage",
    "toStage" "ApplicationStage" NOT NULL,
    "actorId" UUID NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stage_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interviewers" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "team" VARCHAR(100) NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "interviewers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "availability" (
    "id" UUID NOT NULL,
    "interviewerId" UUID NOT NULL,
    "dayOfWeek" SMALLINT NOT NULL,
    "block" SMALLINT NOT NULL,
    "free" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "availability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interview_panels" (
    "id" UUID NOT NULL,
    "businessId" VARCHAR(20) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "focus" VARCHAR(300),
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "interview_panels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interview_panel_members" (
    "id" UUID NOT NULL,
    "panelId" UUID NOT NULL,
    "interviewerId" UUID NOT NULL,

    CONSTRAINT "interview_panel_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interviews" (
    "id" UUID NOT NULL,
    "businessId" VARCHAR(20) NOT NULL,
    "applicationId" UUID NOT NULL,
    "panelId" UUID NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "startAt" TIMESTAMPTZ NOT NULL,
    "endAt" TIMESTAMPTZ NOT NULL,
    "status" "InterviewStatus" NOT NULL DEFAULT 'Scheduled',
    "originalStartAt" TIMESTAMPTZ,
    "cancelReason" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "interviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interview_interviewers" (
    "interviewId" UUID NOT NULL,
    "interviewerId" UUID NOT NULL,

    CONSTRAINT "interview_interviewers_pkey" PRIMARY KEY ("interviewId","interviewerId")
);

-- CreateTable
CREATE TABLE "rubric_criteria" (
    "id" UUID NOT NULL,
    "key" VARCHAR(50) NOT NULL,
    "label" VARCHAR(100) NOT NULL,
    "hint" VARCHAR(300),
    "applicableStages" TEXT[],
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rubric_criteria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scorecards" (
    "id" UUID NOT NULL,
    "businessId" VARCHAR(100) NOT NULL,
    "interviewId" UUID NOT NULL,
    "interviewerId" UUID NOT NULL,
    "applicationId" UUID NOT NULL,
    "recommendation" "ScorecardRecommendation" NOT NULL,
    "notes" TEXT,
    "submittedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scorecards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scorecard_ratings" (
    "id" UUID NOT NULL,
    "scorecardId" UUID NOT NULL,
    "criterionId" UUID NOT NULL,
    "rating" SMALLINT NOT NULL,

    CONSTRAINT "scorecard_ratings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "offers" (
    "id" UUID NOT NULL,
    "businessId" VARCHAR(20) NOT NULL,
    "applicationId" UUID NOT NULL,
    "base" DECIMAL(12,2) NOT NULL,
    "bonusPct" DECIMAL(5,2) NOT NULL,
    "bandMin" DECIMAL(12,2) NOT NULL,
    "bandMax" DECIMAL(12,2) NOT NULL,
    "status" "OfferStatus" NOT NULL DEFAULT 'PendingApproval',
    "outOfBand" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "offers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approvals" (
    "id" UUID NOT NULL,
    "businessId" VARCHAR(20) NOT NULL,
    "subjectType" "ApprovalSubjectType" NOT NULL,
    "subjectId" UUID NOT NULL,
    "subjectLabel" VARCHAR(300) NOT NULL,
    "requestedById" UUID NOT NULL,
    "approverId" UUID,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'Pending',
    "reason" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMPTZ,

    CONSTRAINT "approvals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_events" (
    "id" UUID NOT NULL,
    "businessId" VARCHAR(20) NOT NULL,
    "actorId" UUID NOT NULL,
    "action" VARCHAR(100) NOT NULL,
    "entityType" VARCHAR(50) NOT NULL,
    "entityId" UUID NOT NULL,
    "beforeState" JSONB,
    "afterState" JSONB,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "generation_runs" (
    "id" UUID NOT NULL,
    "businessId" VARCHAR(20) NOT NULL,
    "seed" BIGINT NOT NULL,
    "profile" "GenerationProfile" NOT NULL,
    "generatorVersion" VARCHAR(20) NOT NULL,
    "status" "GenerationStatus" NOT NULL DEFAULT 'Pending',
    "outputPath" VARCHAR(500),
    "checksumSha256" VARCHAR(64),
    "rowCounts" JSONB,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMPTZ,

    CONSTRAINT "generation_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "validation_results" (
    "id" UUID NOT NULL,
    "generationRunId" UUID NOT NULL,
    "checkName" VARCHAR(100) NOT NULL,
    "issueType" VARCHAR(100),
    "affectedRecordId" VARCHAR(100),
    "expectedDecision" VARCHAR(50),
    "severity" VARCHAR(20),
    "status" "AnomalyStatus" NOT NULL DEFAULT 'Open',
    "isAnomaly" BOOLEAN NOT NULL DEFAULT false,
    "detected" BOOLEAN NOT NULL DEFAULT false,
    "tp" BOOLEAN,
    "fp" BOOLEAN,
    "fn" BOOLEAN,
    "total" INTEGER,
    "passed" INTEGER,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "validation_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "orgName" VARCHAR(200) NOT NULL,
    "timezone" VARCHAR(100) NOT NULL,
    "requireOfferApproval" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_businessId_key" ON "users"("businessId");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "hiring_managers_userId_key" ON "hiring_managers"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "requisitions_businessId_key" ON "requisitions"("businessId");

-- CreateIndex
CREATE UNIQUE INDEX "skill_requirements_requisitionId_skill_key" ON "skill_requirements"("requisitionId", "skill");

-- CreateIndex
CREATE UNIQUE INDEX "candidates_businessId_key" ON "candidates"("businessId");

-- CreateIndex
CREATE UNIQUE INDEX "candidates_email_key" ON "candidates"("email");

-- CreateIndex
CREATE UNIQUE INDEX "applications_businessId_key" ON "applications"("businessId");

-- CreateIndex
CREATE INDEX "applications_stage_idx" ON "applications"("stage");

-- CreateIndex
CREATE INDEX "applications_requisitionId_idx" ON "applications"("requisitionId");

-- CreateIndex
CREATE UNIQUE INDEX "applications_candidateId_requisitionId_key" ON "applications"("candidateId", "requisitionId");

-- CreateIndex
CREATE INDEX "stage_events_applicationId_idx" ON "stage_events"("applicationId");

-- CreateIndex
CREATE UNIQUE INDEX "interviewers_userId_key" ON "interviewers"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "availability_interviewerId_dayOfWeek_block_key" ON "availability"("interviewerId", "dayOfWeek", "block");

-- CreateIndex
CREATE UNIQUE INDEX "interview_panels_businessId_key" ON "interview_panels"("businessId");

-- CreateIndex
CREATE UNIQUE INDEX "interview_panel_members_panelId_interviewerId_key" ON "interview_panel_members"("panelId", "interviewerId");

-- CreateIndex
CREATE UNIQUE INDEX "interviews_businessId_key" ON "interviews"("businessId");

-- CreateIndex
CREATE INDEX "interviews_applicationId_idx" ON "interviews"("applicationId");

-- CreateIndex
CREATE INDEX "interviews_startAt_idx" ON "interviews"("startAt");

-- CreateIndex
CREATE UNIQUE INDEX "rubric_criteria_key_key" ON "rubric_criteria"("key");

-- CreateIndex
CREATE UNIQUE INDEX "scorecards_businessId_key" ON "scorecards"("businessId");

-- CreateIndex
CREATE UNIQUE INDEX "scorecards_interviewId_interviewerId_key" ON "scorecards"("interviewId", "interviewerId");

-- CreateIndex
CREATE UNIQUE INDEX "scorecard_ratings_scorecardId_criterionId_key" ON "scorecard_ratings"("scorecardId", "criterionId");

-- CreateIndex
CREATE UNIQUE INDEX "offers_businessId_key" ON "offers"("businessId");

-- CreateIndex
CREATE UNIQUE INDEX "offers_applicationId_key" ON "offers"("applicationId");

-- CreateIndex
CREATE UNIQUE INDEX "approvals_businessId_key" ON "approvals"("businessId");

-- CreateIndex
CREATE INDEX "approvals_status_idx" ON "approvals"("status");

-- CreateIndex
CREATE UNIQUE INDEX "audit_events_businessId_key" ON "audit_events"("businessId");

-- CreateIndex
CREATE INDEX "audit_events_entityType_entityId_idx" ON "audit_events"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "audit_events_createdAt_idx" ON "audit_events"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "generation_runs_businessId_key" ON "generation_runs"("businessId");

-- CreateIndex
CREATE INDEX "validation_results_generationRunId_idx" ON "validation_results"("generationRunId");

-- AddForeignKey
ALTER TABLE "hiring_managers" ADD CONSTRAINT "hiring_managers_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requisitions" ADD CONSTRAINT "requisitions_hiringManagerId_fkey" FOREIGN KEY ("hiringManagerId") REFERENCES "hiring_managers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skill_requirements" ADD CONSTRAINT "skill_requirements_requisitionId_fkey" FOREIGN KEY ("requisitionId") REFERENCES "requisitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "candidates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_requisitionId_fkey" FOREIGN KEY ("requisitionId") REFERENCES "requisitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stage_events" ADD CONSTRAINT "stage_events_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stage_events" ADD CONSTRAINT "stage_events_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interviewers" ADD CONSTRAINT "interviewers_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "availability" ADD CONSTRAINT "availability_interviewerId_fkey" FOREIGN KEY ("interviewerId") REFERENCES "interviewers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interview_panel_members" ADD CONSTRAINT "interview_panel_members_panelId_fkey" FOREIGN KEY ("panelId") REFERENCES "interview_panels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interview_panel_members" ADD CONSTRAINT "interview_panel_members_interviewerId_fkey" FOREIGN KEY ("interviewerId") REFERENCES "interviewers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interviews" ADD CONSTRAINT "interviews_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interviews" ADD CONSTRAINT "interviews_panelId_fkey" FOREIGN KEY ("panelId") REFERENCES "interview_panels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interview_interviewers" ADD CONSTRAINT "interview_interviewers_interviewId_fkey" FOREIGN KEY ("interviewId") REFERENCES "interviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interview_interviewers" ADD CONSTRAINT "interview_interviewers_interviewerId_fkey" FOREIGN KEY ("interviewerId") REFERENCES "interviewers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scorecards" ADD CONSTRAINT "scorecards_interviewId_fkey" FOREIGN KEY ("interviewId") REFERENCES "interviews"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scorecards" ADD CONSTRAINT "scorecards_interviewerId_fkey" FOREIGN KEY ("interviewerId") REFERENCES "interviewers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scorecards" ADD CONSTRAINT "scorecards_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scorecard_ratings" ADD CONSTRAINT "scorecard_ratings_scorecardId_fkey" FOREIGN KEY ("scorecardId") REFERENCES "scorecards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scorecard_ratings" ADD CONSTRAINT "scorecard_ratings_criterionId_fkey" FOREIGN KEY ("criterionId") REFERENCES "rubric_criteria"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offers" ADD CONSTRAINT "offers_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "validation_results" ADD CONSTRAINT "validation_results_generationRunId_fkey" FOREIGN KEY ("generationRunId") REFERENCES "generation_runs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
