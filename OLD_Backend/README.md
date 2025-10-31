> **⚠️ FRONTEND TEAM:** If getting 401 errors, see [FRONTEND_MIGRATION.md](FRONTEND_MIGRATION.md) for 30-minute fix!

# YTFCS ATS Email Server Backend

## � Documentation

- **[Security Guide](SECURITY_GUIDE.md)** - Complete security implementation guide (JWT, encryption, validation)
- **[Security Audit](SECURITY_AUDIT_REPORT.md)** - Detailed security assessment and fixes
- **[Project Structure](PROJECT_STRUCTURE.md)** - Directory layout and key files
- **[API Reference](#api-endpoints)** - API endpoints (see below)

## 🚀 Quick Start

```bash
# 1. Install dependencies
pnpm install

# 2. Configure environment
cp .env.example .env
# Add your secrets (see SECURITY_GUIDE.md)

# 3. Run tests
node test/crypto-service-test.js
node test/file-upload-security-test.js
node test/validation-test.js

# 4. Start server
node server.js
```

---

## Table of Contents

1. [Overview](#overview)
2. [Security Features](#security-features)
3. [Installation & Setup](#installation--setup)
4. [Environment Configuration](#environment-configuration)
5. [API Endpoints](#api-endpoints)
6. [Services](#services)
7. [Database Schema](#database-schema)
8. [Authentication](#authentication)
9. [Testing](#testing)
10. [Deployment](#deployment)
11. [Troubleshooting](#troubleshooting)

---

## Overview

The YTFCS ATS Email Server is a Node.js backend service that handles email operations, resume parsing, candidate scoring, and automation for an Applicant Tracking System (ATS). The system integrates with Firebase for data storage, OpenAI for AI-powered resume parsing and scoring, and various email providers for communication.

### Key Features

- **🔐 JWT Authentication**: Enterprise-grade authentication with access/refresh tokens
- **🔒 Email Encryption**: AES-256-GCM encryption for stored credentials
- **📁 Secure File Uploads**: Magic byte validation and comprehensive security checks
- **✅ Input Validation**: Zod schemas preventing NoSQL injection
- **🤖 AI-Powered Resume Parsing**: OpenAI integration for intelligent resume analysis
- **📊 Resume Scoring**: Intelligent candidate scoring against job requirements
- **📧 Email Automation**: Automated email processing and candidate communication
- **👥 Candidate Management**: Complete CRUD operations for candidate data
- **🔔 Real-time Communication**: Webhook and notification support

### Security Status

✅ **100% of Critical Issues Resolved**  
✅ **Enterprise-Grade Security Implemented**  
✅ **80+ Tests Passing**  
✅ **Production Ready**

See [SECURITY_GUIDE.md](SECURITY_GUIDE.md) for complete security documentation.

---

## 🛡️ Security Features

### Implemented Protections

- ❌ **NoSQL Injection** - Zod validation blocks $ne, $gt, $where operators
- ❌ **SQL Injection** - Input sanitization and validation
- ❌ **Path Traversal** - Filename sanitization and validation
- ❌ **XSS** - Input validation and output encoding
- ❌ **MIME Spoofing** - Magic byte validation for file uploads
- ❌ **Credential Theft** - AES-256-GCM encryption at rest
- ❌ **Unauthorized Access** - JWT token authentication
- ❌ **Command Injection** - Input validation and sanitization
- ❌ **Protocol Smuggling** - URL protocol whitelisting

### Recent Security Updates (October 2, 2025)

1. **JWT Authentication System** - Replaced weak API key with JWT tokens
2. **Email Encryption** - AES-256-GCM for stored passwords
3. **File Upload Security** - Magic byte validation, size limits, sanitization
4. **Input Validation** - Comprehensive Zod schemas for all endpoints

See [SECURITY_GUIDE.md](SECURITY_GUIDE.md) for detailed documentation.

**Key Changes:**

- Automated emails save to `applications` collection instead of `candidates`
- Source tracking changed from "email_automation" to "email_import"
- Import method remains "automated_parser" for tracking
- Resume files still stored in Firebase Storage with same structure
- New API endpoints for application management and conversion workflow

**Benefits:**

- Review all resumes before they become candidates
- Prevent low-quality applications from cluttering candidate pool
- Maintain audit trail of all applications received
- Enable batch approval/rejection workflows

### Technology Stack

- **Runtime**: Node.js (≥14.0.0)
- **Framework**: Express.js
- **Database**: Firebase Firestore
- **AI**: OpenAI GPT models
- **Email**: Nodemailer, SendGrid, Resend
- **File Processing**: Multer, PDF parsing libraries
- **Security**: Helmet, CORS, Rate limiting

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Client Applications                       │
├─────────────────────────────────────────────────────────────────┤
│                        API Gateway                               │
├─────────────────────────────────────────────────────────────────┤
│                        Express Server                            │
├─────────────┬─────────────┬─────────────┬─────────────┬─────────┤
│   Routes    │   Services  │ Middleware  │   Utils     │   API   │
├─────────────┼─────────────┼─────────────┼─────────────┼─────────┤
│ • candidates│ • firebase  │ • auth      │ • logger    │ • parse │
│ • email     │ • email     │ • error     │ • template  │ • score │
│ • import    │ • import    │ • rate      │ • processor │         │
│ • webhooks  │ • scoring   │   limiting  │             │         │
│ • notify    │ • automation│             │             │         │
└─────────────┴─────────────┴─────────────┴─────────────┴─────────┘
                             │
                             ▼
├─────────────────────────────────────────────────────────────────┤
│                    External Services                             │
├─────────────┬─────────────┬─────────────┬─────────────┬─────────┤
│   Firebase  │   OpenAI    │    Email    │    IMAP     │  File   │
│  Firestore  │     API     │  Providers  │   Servers   │ Storage │
└─────────────┴─────────────┴─────────────┴─────────────┴─────────┘
```

### Directory Structure

```
ytfcs-ats-email-server/
├── api/                    # API endpoints
│   ├── parse-resume.js     # Resume parsing endpoints
│   └── score-resume.js     # Resume scoring endpoints
├── config/                 # Configuration files
│   └── email.js           # Email configuration
├── middleware/             # Express middleware
│   ├── auth.js            # Authentication middleware
│   └── errorHandler.js    # Error handling middleware
├── routes/                 # Route definitions
│   ├── candidates.js      # Candidate management
│   ├── communications.js  # Communication endpoints
│   ├── email-automation.js # Email automation
│   ├── email-import.js    # Email import functionality
│   ├── import.js          # Data import routes
│   ├── notifications.js   # Notification system
│   └── webhooks.js        # Webhook handlers
├── services/              # Business logic services
│   ├── emailAutomationService.js
│   ├── emailService.js
│   ├── firebaseService.js
│   ├── importService.js
│   └── resumeScoringService.js
├── utils/                 # Utility functions
│   ├── logger.js          # Logging utility
│   ├── resumeProcessor.js # Resume processing
│   ├── resumeScoring.js   # Scoring algorithms
│   └── templateEngine.js  # Template rendering
├── temp/                  # Temporary files
├── templates/             # Email templates
├── uploads/               # File uploads
├── test/                  # Test files
├── docs/                  # Documentation
├── server.js              # Main server file
└── package.json           # Dependencies
```

---

## Installation & Setup

### Prerequisites

- Node.js (≥14.0.0)
- npm or pnpm
- Firebase project setup
- OpenAI API account

### Installation Steps

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd ytfcs-ats-email-server
   ```

2. **Install dependencies**

   ```bash
   npm install
   # or
   pnpm install
   ```

3. **Configure environment variables**

   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Set up Firebase**

   - Create a Firebase project
   - Enable Firestore
   - Generate service account credentials
   - Configure environment variables

5. **Start the server**

   ```bash
   # Development
   npm run dev

   # Production
   npm start
   ```

---

## Environment Configuration

### Required Environment Variables

```bash
# Application Configuration
NODE_ENV=development|production
PORT=3001
APP_URL=http://localhost:3001

# Firebase Configuration
FIREBASE_CREDENTIALS_BASE64=<base64-encoded-credentials>
FIREBASE_PROJECT_ID=<your-project-id>
FIREBASE_CLIENT_EMAIL=<service-account-email>
FIREBASE_PRIVATE_KEY=<service-account-private-key>
FIREBASE_STORAGE_BUCKET=<storage-bucket-name>

# OpenAI Configuration
OPENAI_API_KEY=<your-openai-api-key>
OPENAI_MODEL=gpt-4o

# Email Configuration
DEFAULT_FROM_EMAIL=<default-sender-email>
DEFAULT_FROM_NAME=<default-sender-name>
EMAIL_SENDER_ADDRESS=<smtp-sender-address>
EMAIL_SENDER_NAME=<smtp-sender-name>
EMAIL_ENCRYPTION_KEY=<encryption-key>

# Email Automation
AUTO_START_EMAIL_AUTOMATION=true|false

# API Configuration
API_BASE_URL=http://localhost:3001
API_KEY=<optional-api-key>
```

### Email Provider Configuration

The system supports multiple email providers:

#### SendGrid

```bash
SENDGRID_API_KEY=<your-sendgrid-api-key>
```

#### Resend

```bash
RESEND_API_KEY=<your-resend-api-key>
```

#### SMTP (Nodemailer)

```bash
SMTP_HOST=<smtp-server>
SMTP_PORT=587
SMTP_USER=<username>
SMTP_PASS=<password>
SMTP_SECURE=true|false
```

---

## API Endpoints

### Resume Processing

#### Parse Resume

**POST** `/api/resume/parse`

Parse a resume file and optionally score it against a job.

**Request:**

```javascript
Content-Type: multipart/form-data

{
  file: <resume-file>,      // Required: PDF, DOC, DOCX
  jobId: <job-id>          // Optional: For scoring
}
```

**Response (without scoring):**

```json
{
  "success": true,
  "data": {
    "name": "John Doe",
    "email": "john@example.com",
    "phone": "+1234567890",
    "skills": ["JavaScript", "Python", "React"],
    "experience": "5 years",
    "education": "Bachelor of Science in Computer Science",
    "jobTitle": "Software Engineer",
    "originalFilename": "resume.pdf",
    "parsingTimestamp": "2025-01-09T10:30:00.000Z"
  }
}
```

**Response (with scoring):**

```json
{
  "success": true,
  "candidate": {
    "name": "John Doe",
    "email": "john@example.com",
    "phone": "+1234567890",
    "skills": ["JavaScript", "Python", "React"],
    "experience": "5 years",
    "education": "Bachelor of Science in Computer Science",
    "jobTitle": "Software Engineer",
    "originalFilename": "resume.pdf",
    "parsingTimestamp": "2025-01-09T10:30:00.000Z"
  },
  "score": {
    "finalScore": 85,
    "breakdown": {
      "skillsMatch": 90,
      "experienceMatch": 80,
      "educationMatch": 85
    },
    "matchedSkills": ["JavaScript", "Python"],
    "missingSkills": ["AWS", "Docker"],
    "feedback": "Strong technical skills match, good experience level"
  },
  "resumeScoringDetails": {
    "finalScore": 85,
    "jobId": "job123",
    "jobTitle": "Senior Developer",
    "componentScores": {
      "skillScore": 90,
      "experienceScore": 80,
      "educationScore": 85,
      "jobTitleScore": 75,
      "certScore": 60
    },
    "scoredAt": "2025-01-09T10:30:00.000Z"
  }
}
```

#### Parse and Score Resume

**POST** `/api/resume/parse-and-score`

Combined endpoint that requires both parsing and scoring.

**Request:**

```javascript
Content-Type: multipart/form-data

{
  file: <resume-file>,      // Required: PDF, DOC, DOCX
  jobId: <job-id>          // Required: For scoring
}
```

**Response:** Same as parse endpoint with scoring.

#### Score Resume

**POST** `/api/resume/score`

Score an already parsed resume against a job.

**Request:**

```json
{
  "resumeData": {
    "name": "John Doe",
    "skills": ["JavaScript", "Python"],
    "experience": "5 years",
    "education": "Bachelor of Science",
    "jobTitle": "Software Engineer"
  },
  "jobData": {
    "title": "Senior Developer",
    "requiredSkills": ["JavaScript", "Python", "AWS"],
    "experience": "3+ years",
    "education": "Bachelor's degree"
  }
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "finalScore": 85,
    "componentScores": {
      "skillScore": 90,
      "experienceScore": 80,
      "educationScore": 85,
      "jobTitleScore": 75,
      "certScore": 60
    },
    "matchedSkills": ["JavaScript", "Python"],
    "missingSkills": ["AWS"],
    "feedback": "Strong technical skills match, good experience level"
  }
}
```

#### Extract Job Requirements

**POST** `/api/resume/extract-job`

Extract structured requirements from a job description.

**Request:**

```json
{
  "jobTitle": "Senior Developer",
  "jobDescription": "We are looking for a Senior Developer..."
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "title": "Senior Developer",
    "requiredSkills": ["JavaScript", "Python", "AWS"],
    "preferredSkills": ["React", "Docker"],
    "experience": "3+ years",
    "education": "Bachelor's degree",
    "certifications": ["AWS Certified"]
  }
}
```

### Candidate Management

#### Get Candidates

**GET** `/api/candidates`

Retrieve candidates with filtering and pagination.

**Query Parameters:**

- `limit` - Number of candidates to return
- `offset` - Number of candidates to skip
- `status` - Filter by status
- `source` - Filter by source

**Response:**

```json
{
  "success": true,
  "data": {
    "candidates": [...],
    "total": 150,
    "hasMore": true
  }
}
```

#### Get Candidate

**GET** `/api/candidates/:id`

Get a specific candidate by ID.

#### Create Candidate

**POST** `/api/candidates`

Create a new candidate.

#### Update Candidate

**PUT** `/api/candidates/:id`

Update an existing candidate.

#### Delete Candidate

**DELETE** `/api/candidates/:id`

Delete a candidate.

### Application Management (NEW in v1.1.0)

#### Get Applications

**GET** `/api/applications`

Retrieve applications with filtering and pagination.

**Query Parameters:**

- `limit` - Number of applications to return
- `offset` - Number of applications to skip
- `status` - Filter by status (pending_review, converted, rejected)
- `reviewStatus` - Filter by review status (unreviewed, approved, rejected)
- `source` - Filter by source

**Response:**

```json
{
  "success": true,
  "data": {
    "applications": [...],
    "total": 150,
    "hasMore": true
  }
}
```

#### Get Application

**GET** `/api/applications/:id`

Get a specific application by ID.

#### Update Application

**PUT** `/api/applications/:id`

Update application status or review information.

#### Convert Application to Candidate

**POST** `/api/applications/:id/convert`

Convert approved application to candidate.

**Request:**

```json
{
  "stageId": "stage123",
  "assignedTo": "user123"
}
```

#### Reject Application

**POST** `/api/applications/:id/reject`

Reject an application.

**Request:**

```json
{
  "reason": "Does not meet minimum requirements"
}
```

#### Get Application Statistics

**GET** `/api/applications/stats`

Get application statistics and metrics.

#### Delete Application

**DELETE** `/api/applications/:id`

Delete an application.

### Email Operations

#### Send Email

**POST** `/api/email/communications/send`

Send an email to candidates or team members.

**Request:**

```json
{
  "to": ["candidate@example.com"],
  "subject": "Interview Invitation",
  "template": "interview-invitation",
  "data": {
    "candidateName": "John Doe",
    "interviewDate": "2025-01-15"
  }
}
```

#### Import Emails

**POST** `/api/email/import`

Import emails from IMAP server.

#### Process Email Attachments

**POST** `/api/email/parse-attachment`

Process attachments from imported emails.

### Automation

#### Start Email Automation

**POST** `/api/email/automation/start`

Start the email automation service.

#### Stop Email Automation

**POST** `/api/email/automation/stop`

Stop the email automation service.

#### Get Automation Status

**GET** `/api/email/automation/status`

Get current automation status.

### Health Check

#### Health Check

**GET** `/health`

Check server health and status.

**Response:**

```json
{
  "status": "ok",
  "automation": {
    "isRunning": true,
    "activeProcesses": 2
  },
  "timestamp": "2025-01-09T10:30:00.000Z"
}
```

---

## Services

### Firebase Service (`firebaseService.js`)

Handles all Firebase Firestore operations.

**Key Functions:**

- `getCandidate(id)` - Retrieve candidate by ID
- `checkCandidateExists(email)` - Check if candidate exists
- `getCandidateByEmail(email)` - Get candidate by email
- `addCandidateFromEmail(data)` - Add candidate from email import
- `batchAddCandidates(candidates)` - Batch add candidates
- `updateMessageStatus(messageId, status)` - Update message status

### Email Service (`emailService.js`)

Manages email operations across multiple providers.

**Key Functions:**

- `sendEmail(options)` - Send email with provider fallback
- `sendBulkEmails(emails)` - Send multiple emails
- `validateEmailTemplate(template)` - Validate email template
- `renderEmailTemplate(template, data)` - Render email with data

### Resume Scoring Service (`resumeScoringService.js`)

Handles resume scoring against job requirements.

**Key Functions:**

- `scoreCandidateResume(candidateData, jobId)` - Score resume against job
- `processResumeScoring(candidateData, jobId)` - Process and save scoring
- `getJobData(jobId)` - Retrieve job data for scoring
- `saveCandidateScore(candidateId, scoreResult)` - Save score to database

### Email Automation Service (`emailAutomationService.js`)

Manages automated email processing and monitoring.

**Key Functions:**

- `start()` - Start automation processes
- `stop()` - Stop automation processes
- `getStatus()` - Get automation status
- `processIncomingEmails()` - Process IMAP emails
- `monitorEmailAccounts()` - Monitor email accounts

### Import Service (`importService.js`)

Handles bulk import operations.

**Key Functions:**

- `importCandidates(data)` - Import candidate data
- `validateImportData(data)` - Validate import format
- `processImportResults(results)` - Process import results

---

## Database Schema

### Firestore Collections

#### Applications Collection (NEW in v1.1.0)

```javascript
{
  id: "application_id",
  name: "John Doe",
  email: "john@example.com",
  phone: "+1234567890",
  skills: ["JavaScript", "Python", "React"],
  experience: "5 years",
  education: "Bachelor of Science in Computer Science",
  jobTitle: "Software Engineer",
  resumeText: "Full resume text...",
  resumeFileURL: "https://storage.googleapis.com/bucket/resumes/123_resume.pdf",
  originalFilename: "john-doe-resume.pdf",
  fileType: "application/pdf",
  fileSize: 1024000,
  // Application workflow fields
  status: "pending_review", // pending_review, converted, rejected
  reviewStatus: "unreviewed", // unreviewed, approved, rejected
  reviewedBy: "user123",
  reviewedAt: "2025-01-09T10:30:00.000Z",
  reviewNotes: "Strong technical background",
  appliedPosition: "Frontend Developer",
  jobId: "job123",
  // Conversion tracking
  convertedToCandidateId: "candidate_456",
  convertedAt: "2025-01-09T11:00:00.000Z",
  // Standard fields
  source: "email_import",
  importMethod: "automated_parser",
  createdAt: "2025-01-09T10:30:00.000Z",
  updatedAt: "2025-01-09T10:30:00.000Z",
  history: [
    {
      date: "2025-01-09T10:30:00.000Z",
      note: "Imported from email with subject: JOB-123-DEV"
    }
  ]
}
```

#### Candidates Collection

```javascript
{
  id: "candidate_id",
  name: "John Doe",
  email: "john@example.com",
  phone: "+1234567890",
  skills: ["JavaScript", "Python", "React"],
  experience: "5 years",
  education: "Bachelor of Science in Computer Science",
  jobTitle: "Software Engineer",
  resumeText: "Full resume text...",
  resumeScore: 85,
  resumeScoringDetails: {
    finalScore: 85,
    componentScores: { ... },
    jobId: "job123",
    jobTitle: "Senior Developer",
    scoredAt: "2025-01-09T10:30:00.000Z"
  },
  status: "active",
  source: "email_import",
  createdAt: "2025-01-09T10:30:00.000Z",
  updatedAt: "2025-01-09T10:30:00.000Z",
  history: [
    {
      date: "2025-01-09T10:30:00.000Z",
      note: "Candidate imported from email"
    }
  ]
}
```

#### Jobs Collection

```javascript
{
  id: "job_id",
  title: "Senior Developer",
  description: "We are looking for...",
  requiredSkills: ["JavaScript", "Python", "AWS"],
  preferredSkills: ["React", "Docker"],
  experience: "3+ years",
  education: "Bachelor's degree",
  certifications: ["AWS Certified"],
  status: "active",
  createdAt: "2025-01-09T10:30:00.000Z",
  updatedAt: "2025-01-09T10:30:00.000Z"
}
```

#### Messages Collection

```javascript
{
  id: "message_id",
  from: "sender@example.com",
  to: ["recipient@example.com"],
  subject: "Interview Invitation",
  body: "Email body...",
  template: "interview-invitation",
  status: "sent",
  sentAt: "2025-01-09T10:30:00.000Z",
  candidateId: "candidate_id",
  jobId: "job_id"
}
```

#### Email Accounts Collection

```javascript
{
  id: "account_id",
  email: "hr@company.com",
  provider: "gmail",
  settings: {
    imap: {
      host: "imap.gmail.com",
      port: 993,
      secure: true
    }
  },
  lastChecked: "2025-01-09T10:30:00.000Z",
  status: "active",
  stats: {
    totalEmails: 1250,
    processedEmails: 1200,
    candidatesFound: 45
  }
}
```

---

## Authentication

### Overview

The system supports multiple authentication methods with JWT tokens as the primary method.

**See [SECURITY_GUIDE.md](SECURITY_GUIDE.md) for complete authentication documentation.**

### Quick Start

**Option 1: JWT Authentication (Recommended)**
```bash
# Register
POST /api/auth/register
{ "email": "user@example.com", "password": "SecurePass123!", "name": "John Doe" }

# Login
POST /api/auth/login
{ "email": "user@example.com", "password": "SecurePass123!" }

# Use token
GET /api/applications
Authorization: Bearer <accessToken>
```

**Option 2: User API Key**
```bash
# Create API key
POST /api/auth/api-keys
Authorization: Bearer <accessToken>
{ "name": "My API Key", "expiresInDays": 365 }

# Use API key
GET /api/applications
x-api-key: ats_live_...
```

**Option 3: Legacy API Key (Backward Compatible)**
```bash
GET /api/applications
x-api-key: <your-legacy-key>
```

### Authentication Endpoints

- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login and get tokens
- `POST /api/auth/refresh` - Refresh access token
- `POST /api/auth/logout` - Logout (revoke tokens)
- `POST /api/auth/logout-all` - Logout from all devices
- `GET /api/auth/me` - Get current user
- `POST /api/auth/api-keys` - Create API key
- `POST /api/auth/validate` - Validate API key

### Security Features

1. **JWT Tokens**
   - Access tokens (1 hour expiration)
   - Refresh tokens (7 days expiration)
   - Automatic token rotation
   - Token revocation on logout

2. **Password Security**
   - Bcrypt hashing (12 rounds)
   - Minimum 8 characters
   - Must include uppercase, lowercase, number, special char

3. **Rate Limiting**
   - 100 requests per 15 minutes per IP
   - Additional limits on auth endpoints

4. **Input Validation**
   - Zod schemas for all inputs
   - NoSQL injection prevention
   - XSS protection

5. **Security Headers**
   - Helmet.js configuration
   - CORS with allowed origins
   - Content Security Policy

**For detailed security information, see [SECURITY_GUIDE.md](SECURITY_GUIDE.md)**

---

## Testing

### Security Tests

```bash
# Test encryption
node test/crypto-service-test.js

# Test file upload security
node test/file-upload-security-test.js

# Test input validation
node test/validation-test.js
```

**Results:** 80+ tests, all passing ✅

### Error Response Format

All API endpoints return errors in a consistent format:

```json
{
  "success": false,
  "error": "Human-readable error message",
  "details": "Technical error details"
}
```

### HTTP Status Codes

- `200` - Success
- `400` - Bad Request (validation failed)
- `401` - Unauthorized (authentication required)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `422` - Unprocessable Entity
- `500` - Internal Server Error
- `429` - Too Many Requests
- `500` - Internal Server Error

### Error Middleware

```javascript
// middleware/errorHandler.js
const errorHandler = (err, req, res, next) => {
  logger.error("Error:", err);

  const statusCode = err.statusCode || 500;
  const message = err.message || "Internal Server Error";

  res.status(statusCode).json({
    success: false,
    error: message,
    details: process.env.NODE_ENV === "development" ? err.stack : undefined,
    timestamp: new Date().toISOString(),
  });
};
```

---

## Testing

### Test Structure

```
test/
├── api-integration-test.js     # API endpoint tests
├── firebase-config-test.js     # Firebase configuration tests
├── import-fix-test.js          # Import validation tests
└── unit/                       # Unit tests
    ├── services/              # Service tests
    ├── utils/                 # Utility tests
    └── middleware/            # Middleware tests
```

### Running Tests

```bash
# Run all tests
npm test

# Run specific test
node test/api-integration-test.js

# Run with coverage
npm run test:coverage
```

### Test Examples

#### API Integration Test

```javascript
// test/api-integration-test.js
const axios = require("axios");
const FormData = require("form-data");

const testParseEndpoint = async () => {
  const formData = new FormData();
  formData.append("file", fs.createReadStream("test-resume.pdf"));
  formData.append("jobId", "test-job-123");

  const response = await axios.post(
    "http://localhost:3001/api/resume/parse",
    formData,
    { headers: formData.getHeaders() }
  );

  expect(response.data.success).toBe(true);
  expect(response.data.candidate).toBeDefined();
  expect(response.data.score).toBeDefined();
};
```

---

## Deployment

### Production Deployment

1. **Environment Setup**

   ```bash
   NODE_ENV=production
   PORT=3001
   ```

2. **Process Management**

   - Use PM2 for process management
   - Configure clustering for high availability
   - Set up health checks

3. **Monitoring**
   - Log aggregation
   - Performance monitoring
   - Error tracking

### Docker Deployment

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

EXPOSE 3001

USER node

CMD ["node", "server.js"]
```

### Docker Compose

```yaml
version: "3.8"

services:
  ats-email-server:
    build: .
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=production
      - PORT=3001
    env_file:
      - .env
    restart: unless-stopped
```

---

## Troubleshooting

### Common Issues

#### 1. Firebase Connection Error

```
Error: Cannot find module '../config/firebase'
```

**Solution:** Ensure Firebase credentials are properly configured in environment variables.

#### 2. OpenAI API Errors

```
Error: OpenAI API rate limit exceeded
```

**Solution:** Implement retry logic with exponential backoff.

#### 3. Memory Issues with Large Files

```
Error: JavaScript heap out of memory
```

**Solution:** Increase Node.js memory limit or implement streaming for large files.

#### 4. Email Parsing Errors

```
Error: Failed to extract text from PDF
```

**Solution:** Use multiple PDF parsing libraries with fallback mechanisms.

### Debugging

1. **Enable Debug Logging**

   ```bash
   DEBUG=* npm start
   ```

2. **Check Health Endpoint**

   ```bash
   curl http://localhost:3001/health
   ```

3. **Monitor Logs**
   ```bash
   tail -f logs/app.log
   ```

### Performance Optimization

1. **Caching**

   - Implement Redis caching for frequently accessed data
   - Cache parsed resume data

2. **Database Optimization**

   - Use Firestore indexes for queries
   - Implement pagination for large datasets

3. **File Processing**
   - Use streaming for large file uploads
   - Implement file cleanup schedules

---

## API Rate Limits

| Endpoint            | Limit        | Window     |
| ------------------- | ------------ | ---------- |
| `/api/resume/parse` | 50 requests  | 15 minutes |
| `/api/resume/score` | 100 requests | 15 minutes |
| `/api/candidates`   | 200 requests | 15 minutes |
| `/api/email/*`      | 100 requests | 15 minutes |
| Global              | 100 requests | 15 minutes |

---

## Documentation

### 📚 Complete Documentation Suite

This project includes comprehensive documentation to help you get started, integrate, and deploy the system:

#### **[📖 Documentation Index](docs/INDEX.md)**

Quick access to all documentation with guided reading paths for different roles.

#### **Core Documentation**

- **[📋 API Reference](docs/API_REFERENCE.md)** - Complete API documentation with examples, SDKs, and Postman collection
- **[🔧 Development Guide](docs/DEVELOPMENT.md)** - Setup, coding standards, testing, and contribution guidelines
- **[🚀 Deployment Guide](docs/DEPLOYMENT.md)** - Production deployment for Docker, Kubernetes, and traditional servers

#### **Specialized Guides**

- **[🎯 Resume Parsing API](docs/resume-parse-api.md)** - Detailed resume parsing and scoring documentation
- **[🔧 Firebase Configuration Fix](FIREBASE_FIX.md)** - Firebase setup and troubleshooting
- **[📝 Changelog](CHANGELOG.md)** - Version history and release notes

#### **Quick Navigation**

- **New Developer?** Start with [Development Guide](docs/DEVELOPMENT.md)
- **API Integration?** Check [API Reference](docs/API_REFERENCE.md)
- **Deployment?** Follow [Deployment Guide](docs/DEPLOYMENT.md)
- **Issues?** See [Troubleshooting](#troubleshooting) and [Firebase Fix](FIREBASE_FIX.md)

### 🎯 Getting Started Paths

**For Frontend Developers:**

1. [API Reference](docs/API_REFERENCE.md) → Authentication & Endpoints
2. [Resume Parsing API](docs/resume-parse-api.md) → Parsing Integration
3. Code examples and SDK usage

**For Backend Developers:**

1. [Development Guide](docs/DEVELOPMENT.md) → Environment Setup
2. [API Reference](docs/API_REFERENCE.md) → API Understanding
3. [Deployment Guide](docs/DEPLOYMENT.md) → Production Deployment

**For DevOps Engineers:**

1. [Deployment Guide](docs/DEPLOYMENT.md) → Production Setup
2. [Environment Configuration](#environment-configuration) → Config Management
3. [Security](#authentication--security) → Security Implementation

---

## Contributing

We welcome contributions to improve the YTFCS ATS Email Server! Please review our contribution guidelines:

### 📋 Before Contributing

1. **Read Documentation**: Familiarize yourself with the project structure in [Development Guide](docs/DEVELOPMENT.md)
2. **Check Issues**: Review existing issues and feature requests
3. **Follow Standards**: Adhere to code style and conventions

### 🔧 Development Process

1. **Fork Repository**: Create your own fork
2. **Create Branch**: Use descriptive branch names (`feature/resume-parsing-improvement`)
3. **Make Changes**: Implement your changes with tests
4. **Update Documentation**: Update relevant documentation
5. **Submit PR**: Create a pull request with clear description

### 📝 Contribution Types

- **Bug Fixes**: Fix existing issues
- **New Features**: Add new functionality
- **Documentation**: Improve or expand documentation
- **Testing**: Add or improve tests
- **Performance**: Optimize existing code

### 🎯 Areas for Contribution

- Resume parsing accuracy improvements
- Additional email provider integrations
- Performance optimizations
- Security enhancements
- Testing coverage
- Documentation improvements

For detailed contribution guidelines, see [Development Guide](docs/DEVELOPMENT.md) → Contributing section.

---

## License

This project is proprietary software. All rights reserved.

### 📄 Usage Rights

- Internal company use only
- No redistribution without permission
- Contact development team for licensing questions

### 📞 Contact

For licensing inquiries or questions:

- Development Team: [Contact Information]
- Project Manager: [Contact Information]

---

## Support

### 🆘 Getting Help

1. **Documentation**: Start with [Documentation Index](docs/INDEX.md)
2. **Troubleshooting**: Check [Troubleshooting](#troubleshooting) section
3. **Known Issues**: Review [Changelog](CHANGELOG.md) → Known Issues
4. **Team Support**: Contact the development team

### 🐛 Reporting Issues

1. **Search First**: Check existing documentation and issues
2. **Provide Details**: Include logs, error messages, and steps to reproduce
3. **Environment Info**: Specify OS, Node.js version, and configuration
4. **Follow Template**: Use issue templates when available

### 📈 Feature Requests

- Review [Changelog](CHANGELOG.md) → Planned Features
- Submit feature requests through proper channels
- Provide use cases and business justification

---

## Acknowledgments

- OpenAI for AI-powered resume parsing and scoring
- Firebase for database and authentication services
- Node.js and Express.js communities
- All contributors and team members

---

**Last Updated:** January 9, 2025
**Version:** 1.0.0
**Documentation Version:** 1.0.0
