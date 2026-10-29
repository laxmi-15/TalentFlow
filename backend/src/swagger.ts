// Comprehensive OpenAPI 3.0.3 Specification for TalentFlow REST API
export const swaggerDoc = {
  openapi: '3.0.3',
  info: {
    title: 'TalentFlow Recruitment Operations API',
    version: '1.0.0',
    description:
      'Enterprise recruitment operations SaaS REST API covering the complete hiring lifecycle: requisitions, candidates, applications, stage-gate evaluation, panel scheduling, rubric scorecards, compensation-band offers, approvals, audit logging, analytics, and anomaly evaluation.',
    contact: {
      name: 'TalentFlow Engineering',
      email: 'dev@talentflow.internal',
    },
  },
  servers: [
    { url: '/api/v1', description: 'TalentFlow API v1 Server' },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Provide your JWT bearer token in the Authorization header. Format: `Bearer <token>`',
      },
    },
    schemas: {
      HealthResponse: {
        type: 'object',
        properties: {
          status: { type: 'string', example: 'ok' },
          db: { type: 'string', example: 'connected' },
          timestamp: { type: 'string', format: 'date-time' },
        },
      },
      ErrorResponse: {
        type: 'object',
        required: ['message', 'code'],
        properties: {
          message: { type: 'string', example: 'Record not found.' },
          code: { type: 'string', example: 'NOT_FOUND' },
          details: { type: 'object' },
        },
      },
      User: {
        type: 'object',
        properties: {
          id: { type: 'string', example: 'USR-000001' },
          name: { type: 'string', example: 'Meera Joshi' },
          email: { type: 'string', example: 'meera@example.test' },
          role: { type: 'string', enum: ['Admin', 'Recruiter', 'HiringManager', 'Interviewer', 'Approver'] },
          active: { type: 'boolean', example: true },
        },
      },
      Settings: {
        type: 'object',
        properties: {
          orgName: { type: 'string', example: 'Northwind Talent Co.' },
          timezone: { type: 'string', example: 'Asia/Kolkata' },
          requireOfferApproval: { type: 'boolean', example: true },
        },
      },
      Requisition: {
        type: 'object',
        properties: {
          id: { type: 'string', example: 'REQ-2026-000001' },
          title: { type: 'string', example: 'Senior Backend Engineer' },
          department: { type: 'string', example: 'Engineering' },
          location: { type: 'string', example: 'Pune' },
          hiringManager: { type: 'string', example: 'Dana Whitfield' },
          headcount: { type: 'integer', example: 2 },
          status: { type: 'string', enum: ['Draft', 'Pending approval', 'Open', 'Closed', 'Rejected'] },
          bandMin: { type: 'number', example: 130000 },
          bandMax: { type: 'number', example: 175000 },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      Candidate: {
        type: 'object',
        properties: {
          id: { type: 'string', example: 'CAND-000001' },
          name: { type: 'string', example: 'Aarav Patel' },
          email: { type: 'string', example: 'aarav.patel@example.test' },
          phone: { type: 'string', example: '+91 98200 11223' },
          location: { type: 'string', example: 'Pune' },
          source: { type: 'string', enum: ['Referral', 'CareerssSite', 'Agency', 'JobBoard', 'Campus'] },
          experienceYears: { type: 'integer', example: 7 },
          skills: { type: 'array', items: { type: 'string' }, example: ['TypeScript', 'Python', 'SQL', 'Kubernetes'] },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      Application: {
        type: 'object',
        properties: {
          id: { type: 'string', example: 'APP-CAND-000001-REQ-2026-000001' },
          candidateId: { type: 'string', example: 'CAND-000001' },
          candidateName: { type: 'string', example: 'Aarav Patel' },
          requisitionId: { type: 'string', example: 'REQ-2026-000001' },
          requisitionTitle: { type: 'string', example: 'Senior Backend Engineer' },
          stage: { type: 'string', enum: ['Applied', 'Screen', 'Interview', 'Final', 'Offer', 'Hired', 'Withdrawn'] },
          score: { type: 'number', nullable: true, example: 4.8 },
          source: { type: 'string', example: 'Referral' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      Interview: {
        type: 'object',
        properties: {
          id: { type: 'string', example: 'INT-2026-000001' },
          applicationId: { type: 'string', example: 'APP-CAND-000002-REQ-2026-000002' },
          candidateName: { type: 'string', example: 'Sofia Müller' },
          title: { type: 'string', example: 'Design Critique Panel' },
          start: { type: 'string', format: 'date-time' },
          end: { type: 'string', format: 'date-time' },
          panel: { type: 'array', items: { type: 'string' } },
          status: { type: 'string', enum: ['Scheduled', 'Completed', 'Cancelled', 'Rescheduled'] },
        },
      },
      Interviewer: {
        type: 'object',
        properties: {
          id: { type: 'string', example: 'USR-000004' },
          name: { type: 'string', example: 'Samir Qureshi' },
          team: { type: 'string', example: 'Engineering' },
          availability: {
            type: 'array',
            items: { type: 'array', items: { type: 'boolean' } },
            description: '5 weekdays × 3 blocks (morning, midday, afternoon)',
          },
        },
      },
      Panel: {
        type: 'object',
        properties: {
          id: { type: 'string', example: 'PNL-000001' },
          name: { type: 'string', example: 'Backend Engineering Loop' },
          focus: { type: 'string', example: 'System design, code quality, scalability' },
          members: { type: 'array', items: { type: 'string' } },
        },
      },
      Scorecard: {
        type: 'object',
        properties: {
          id: { type: 'string', example: 'SCORE-INT-2026-000002-USR-000004' },
          applicationId: { type: 'string' },
          candidateName: { type: 'string' },
          interviewer: { type: 'string' },
          ratings: { type: 'object', additionalProperties: { type: 'integer' } },
          recommendation: { type: 'string', enum: ['StrongYes', 'Yes', 'No', 'StrongNo'] },
          notes: { type: 'string' },
          submittedAt: { type: 'string', format: 'date-time' },
        },
      },
      Offer: {
        type: 'object',
        properties: {
          id: { type: 'string', example: 'OFF-2026-000001' },
          applicationId: { type: 'string' },
          candidateName: { type: 'string' },
          role: { type: 'string' },
          base: { type: 'number', example: 155000 },
          bonusPct: { type: 'number', example: 10 },
          bandMin: { type: 'number', example: 130000 },
          bandMax: { type: 'number', example: 175000 },
          status: { type: 'string', enum: ['Pending approval', 'Approved', 'Rejected', 'Sent', 'Accepted', 'Declined'] },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      Approval: {
        type: 'object',
        properties: {
          id: { type: 'string', example: 'APR-000001' },
          type: { type: 'string', enum: ['Requisition', 'Offer'] },
          subject: { type: 'string', example: 'REQ-2026-000005 — Security Engineer' },
          requestedBy: { type: 'string', example: 'Chris Alder' },
          approver: { type: 'string', nullable: true, example: 'Lena Fischer' },
          status: { type: 'string', enum: ['Pending', 'Approved', 'Rejected'] },
          reason: { type: 'string', nullable: true },
          createdAt: { type: 'string', format: 'date-time' },
          decidedAt: { type: 'string', format: 'date-time', nullable: true },
        },
      },
      Anomaly: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          type: { type: 'string', example: 'InterviewerDoubleBooked' },
          severity: { type: 'string', enum: ['Low', 'Medium', 'High', 'Critical'] },
          status: { type: 'string', enum: ['Open', 'Investigating', 'Resolved'] },
          subject: { type: 'string' },
          detail: { type: 'string' },
          detectedAt: { type: 'string', format: 'date-time' },
        },
      },
      AuditEvent: {
        type: 'object',
        properties: {
          id: { type: 'string', example: 'AUD-000001' },
          actor: { type: 'string', example: 'Meera Joshi' },
          action: { type: 'string', example: 'Created requisition' },
          entity: { type: 'string', example: 'Requisition' },
          entityId: { type: 'string' },
          at: { type: 'string', format: 'date-time' },
        },
      },
      Analytics: {
        type: 'object',
        properties: {
          kpis: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                label: { type: 'string' },
                value: { type: 'string' },
                delta: { type: 'string' },
                up: { type: 'boolean' },
              },
            },
          },
          trend: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                week: { type: 'string' },
                applications: { type: 'integer' },
                hires: { type: 'integer' },
              },
            },
          },
          funnel: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                stage: { type: 'string' },
                count: { type: 'integer' },
              },
            },
          },
          sources: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                value: { type: 'integer' },
              },
            },
          },
        },
      },
    },
  },
  security: [{ bearerAuth: [] }],
  tags: [
    { name: 'System', description: 'Health and readiness endpoints' },
    { name: 'Auth', description: 'Authentication and session management' },
    { name: 'Users', description: 'User administration and settings' },
    { name: 'Requisitions', description: 'Job openings and compensation bands' },
    { name: 'Candidates', description: 'Candidate profile directory' },
    { name: 'Applications', description: 'Application pipeline and stage gates' },
    { name: 'Panels', description: 'Interview panels and interviewer availability' },
    { name: 'Interviews', description: 'Conflict-free interview scheduling' },
    { name: 'Scorecards', description: 'Rubric-based scorecard evaluation' },
    { name: 'Offers', description: 'Compensation-band offers and approval routing' },
    { name: 'Approvals', description: 'Requisition and offer approval queue' },
    { name: 'Analytics', description: 'Recruitment KPIs and funnel conversion metrics' },
    { name: 'Anomalies', description: 'Hiring operational anomalies and exceptions' },
    { name: 'Audit', description: 'Immutable audit event trail' },
    { name: 'DataQuality', description: 'Synthetic generation and validation runs' },
  ],
  paths: {
    '/health': {
      get: {
        summary: 'Service Health Check',
        tags: ['System'],
        security: [],
        responses: {
          200: {
            description: 'API and database are healthy',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/HealthResponse' } } },
          },
          503: {
            description: 'Database disconnected or degraded',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/HealthResponse' } } },
          },
        },
      },
    },
    '/auth/login': {
      post: {
        summary: 'Authenticate user',
        tags: ['Auth'],
        security: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  email: { type: 'string', format: 'email', example: 'meera@example.test' },
                  password: { type: 'string', example: 'TalentFlow2026!' },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Login successful',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    token: { type: 'string' },
                    user: { $ref: '#/components/schemas/User' },
                  },
                },
              },
            },
          },
          401: { description: 'Invalid credentials', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
    },
    '/auth/me': {
      get: {
        summary: 'Get current user profile',
        tags: ['Auth'],
        responses: {
          200: { description: 'Authenticated user profile', content: { 'application/json': { schema: { $ref: '#/components/schemas/User' } } } },
          401: { description: 'Unauthorized', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
    },
    '/auth/logout': {
      post: {
        summary: 'Log out current user',
        tags: ['Auth'],
        responses: {
          200: { description: 'Logged out successfully' },
        },
      },
    },
    '/users': {
      get: {
        summary: 'List all users (Admin only)',
        tags: ['Users'],
        responses: {
          200: { description: 'List of users', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/User' } } } } },
        },
      },
    },
    '/users/{id}': {
      patch: {
        summary: 'Update user role (Admin only)',
        tags: ['Users'],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', required: ['role'], properties: { role: { type: 'string', enum: ['Admin', 'Recruiter', 'HiringManager', 'Interviewer', 'Approver'] } } } } },
        },
        responses: {
          200: { description: 'Role updated', content: { 'application/json': { schema: { $ref: '#/components/schemas/User' } } } },
        },
      },
    },
    '/settings': {
      get: {
        summary: 'Get organization settings',
        tags: ['Users'],
        responses: {
          200: { description: 'Settings object', content: { 'application/json': { schema: { $ref: '#/components/schemas/Settings' } } } },
        },
      },
      put: {
        summary: 'Update organization settings',
        tags: ['Users'],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Settings' } } },
        },
        responses: {
          200: { description: 'Settings updated', content: { 'application/json': { schema: { $ref: '#/components/schemas/Settings' } } } },
        },
      },
    },
    '/requisitions': {
      get: {
        summary: 'List job requisitions',
        tags: ['Requisitions'],
        responses: {
          200: { description: 'List of requisitions', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Requisition' } } } } },
        },
      },
      post: {
        summary: 'Create a new job requisition',
        tags: ['Requisitions'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['title', 'department', 'location', 'headcount', 'bandMin', 'bandMax'],
                properties: {
                  title: { type: 'string', example: 'Data Analyst' },
                  department: { type: 'string', example: 'Analytics' },
                  location: { type: 'string', example: 'Remote' },
                  headcount: { type: 'integer', example: 2 },
                  bandMin: { type: 'number', example: 80000 },
                  bandMax: { type: 'number', example: 115000 },
                  hiringManagerId: { type: 'string', description: 'Optional hiring manager user ID' },
                },
              },
            },
          },
        },
        responses: {
          201: { description: 'Requisition created', content: { 'application/json': { schema: { $ref: '#/components/schemas/Requisition' } } } },
        },
      },
    },
    '/candidates': {
      get: {
        summary: 'List candidates',
        tags: ['Candidates'],
        responses: {
          200: { description: 'List of candidates', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Candidate' } } } } },
        },
      },
      post: {
        summary: 'Create candidate',
        tags: ['Candidates'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'email', 'location', 'source', 'experienceYears'],
                properties: {
                  name: { type: 'string' },
                  email: { type: 'string', format: 'email' },
                  phone: { type: 'string' },
                  location: { type: 'string' },
                  source: { type: 'string', enum: ['Referral', 'CareerssSite', 'Agency', 'JobBoard', 'Campus'] },
                  experienceYears: { type: 'integer' },
                  skills: { type: 'array', items: { type: 'string' } },
                },
              },
            },
          },
        },
        responses: {
          201: { description: 'Candidate created', content: { 'application/json': { schema: { $ref: '#/components/schemas/Candidate' } } } },
        },
      },
    },
    '/applications': {
      get: {
        summary: 'List applications across pipeline',
        tags: ['Applications'],
        responses: {
          200: { description: 'List of applications', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Application' } } } } },
        },
      },
      post: {
        summary: 'Create application',
        tags: ['Applications'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['candidateId', 'requisitionId'],
                properties: {
                  candidateId: { type: 'string' },
                  requisitionId: { type: 'string' },
                  source: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          201: { description: 'Application created', content: { 'application/json': { schema: { $ref: '#/components/schemas/Application' } } } },
        },
      },
    },
    '/applications/{id}': {
      patch: {
        summary: 'Advance / move application stage',
        tags: ['Applications'],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['stage'],
                properties: {
                  stage: { type: 'string', enum: ['Applied', 'Screen', 'Interview', 'Final', 'Offer', 'Hired', 'Withdrawn'] },
                  reason: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Application updated', content: { 'application/json': { schema: { $ref: '#/components/schemas/Application' } } } },
        },
      },
    },
    '/interviews': {
      get: {
        summary: 'List interviews',
        tags: ['Interviews'],
        responses: {
          200: { description: 'List of interviews', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Interview' } } } } },
        },
      },
      post: {
        summary: 'Schedule interview with conflict checks',
        tags: ['Interviews'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['applicationId', 'start', 'durationMin', 'panelId'],
                properties: {
                  applicationId: { type: 'string' },
                  start: { type: 'string', format: 'date-time' },
                  durationMin: { type: 'integer', example: 60 },
                  panelId: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          201: { description: 'Interview scheduled', content: { 'application/json': { schema: { $ref: '#/components/schemas/Interview' } } } },
        },
      },
    },
    '/interviewers': {
      get: {
        summary: 'List interviewers and availability',
        tags: ['Panels'],
        responses: {
          200: { description: 'List of interviewers', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Interviewer' } } } } },
        },
      },
    },
    '/panels': {
      get: {
        summary: 'List interview panels',
        tags: ['Panels'],
        responses: {
          200: { description: 'List of panels', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Panel' } } } } },
        },
      },
      post: {
        summary: 'Create interview panel',
        tags: ['Panels'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'members'],
                properties: {
                  name: { type: 'string' },
                  focus: { type: 'string' },
                  members: { type: 'array', items: { type: 'string' } },
                },
              },
            },
          },
        },
        responses: {
          201: { description: 'Panel created', content: { 'application/json': { schema: { $ref: '#/components/schemas/Panel' } } } },
        },
      },
    },
    '/scorecards': {
      get: {
        summary: 'List submitted scorecards',
        tags: ['Scorecards'],
        responses: {
          200: { description: 'List of scorecards', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Scorecard' } } } } },
        },
      },
      post: {
        summary: 'Submit scorecard with rubric ratings',
        tags: ['Scorecards'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['applicationId', 'recommendation', 'ratings'],
                properties: {
                  applicationId: { type: 'string' },
                  recommendation: { type: 'string', enum: ['StrongYes', 'Yes', 'No', 'StrongNo'] },
                  ratings: { type: 'object', additionalProperties: { type: 'integer' } },
                  notes: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          201: { description: 'Scorecard submitted', content: { 'application/json': { schema: { $ref: '#/components/schemas/Scorecard' } } } },
        },
      },
    },
    '/offers': {
      get: {
        summary: 'List offers',
        tags: ['Offers'],
        responses: {
          200: { description: 'List of offers', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Offer' } } } } },
        },
      },
      post: {
        summary: 'Create compensation offer',
        tags: ['Offers'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['applicationId', 'base', 'bonusPct'],
                properties: {
                  applicationId: { type: 'string' },
                  base: { type: 'number', example: 150000 },
                  bonusPct: { type: 'number', example: 10 },
                },
              },
            },
          },
        },
        responses: {
          201: { description: 'Offer created', content: { 'application/json': { schema: { $ref: '#/components/schemas/Offer' } } } },
        },
      },
    },
    '/approvals': {
      get: {
        summary: 'List pending and decided approvals',
        tags: ['Approvals'],
        responses: {
          200: { description: 'List of approvals', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Approval' } } } } },
        },
      },
    },
    '/approvals/{id}/decision': {
      post: {
        summary: 'Approve or reject a requisition or offer',
        tags: ['Approvals'],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['decision'],
                properties: {
                  decision: { type: 'string', enum: ['Approved', 'Rejected'] },
                  reason: { type: 'string', example: 'Within approved compensation band' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Approval decided', content: { 'application/json': { schema: { $ref: '#/components/schemas/Approval' } } } },
        },
      },
    },
    '/analytics/overview': {
      get: {
        summary: 'Get recruitment KPI overview and funnel metrics',
        tags: ['Analytics'],
        parameters: [{ name: 'days', in: 'query', schema: { type: 'integer', default: 30 } }],
        responses: {
          200: { description: 'KPIs and funnel stats', content: { 'application/json': { schema: { $ref: '#/components/schemas/Analytics' } } } },
        },
      },
    },
    '/anomalies': {
      get: {
        summary: 'List operational anomalies and pipeline violations',
        tags: ['Anomalies'],
        responses: {
          200: { description: 'List of anomalies', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Anomaly' } } } } },
        },
      },
    },
    '/anomalies/{id}': {
      patch: {
        summary: 'Update anomaly status',
        tags: ['Anomalies'],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['status'],
                properties: {
                  status: { type: 'string', enum: ['Open', 'Investigating', 'Resolved'] },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Anomaly status updated', content: { 'application/json': { schema: { $ref: '#/components/schemas/Anomaly' } } } },
        },
      },
    },
    '/audit-events': {
      get: {
        summary: 'List immutable audit trail events',
        tags: ['Audit'],
        responses: {
          200: { description: 'List of audit events', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/AuditEvent' } } } } },
        },
      },
    },
    '/data-quality/reports': {
      get: {
        summary: 'List data generation and quality reports',
        tags: ['DataQuality'],
        responses: {
          200: { description: 'List of data quality reports' },
        },
      },
      post: {
        summary: 'Generate synthetic dataset or run validation',
        tags: ['DataQuality'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['rows', 'seed'],
                properties: {
                  rows: { type: 'integer', example: 5000 },
                  seed: { type: 'integer', example: 20261022 },
                },
              },
            },
          },
        },
        responses: {
          201: { description: 'Generation run started or completed' },
        },
      },
    },
  },
}

