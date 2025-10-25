# Email Accounts Management API

## Overview
The Email Accounts Management API has been successfully implemented with full CRUD operations and connection testing capabilities.

## Endpoints

### 1. Create Email Account
**POST** `/api/email-accounts`

**Authentication:** Required (Admin only)

**Request Body:**
```json
{
  "name": "Gmail Primary",
  "email": "applications@company.com",
  "provider": "gmail",
  "imapHost": "imap.gmail.com",
  "imapPort": 993,
  "imapUser": "applications@company.com",
  "imapPassword": "your-app-password",
  "imapTls": true,
  "smtpHost": "smtp.gmail.com",
  "smtpPort": 587,
  "smtpUser": "applications@company.com",
  "smtpPassword": "your-app-password",
  "smtpTls": true,
  "isActive": true
}
```

**Response:**
```json
{
  "status": "success",
  "message": "Email account created successfully",
  "data": {
    "_id": "65f1a2b3c4d5e6f7g8h9i0j1",
    "name": "Gmail Primary",
    "email": "applications@company.com",
    "provider": "gmail",
    "imapHost": "imap.gmail.com",
    "imapPort": 993,
    "imapUser": "applications@company.com",
    "imapPassword": "********",
    "imapTls": true,
    "isActive": true,
    "createdBy": "65f1a2b3c4d5e6f7g8h9i0j1",
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-15T10:30:00.000Z"
  }
}
```

### 2. Get All Email Accounts
**GET** `/api/email-accounts?page=1&limit=10&provider=gmail&isActive=true&search=applications`

**Authentication:** Required (Admin only)

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 10)
- `provider` (optional): Filter by provider (gmail, outlook, custom)
- `isActive` (optional): Filter by active status (true/false)
- `search` (optional): Search in name or email

**Response:**
```json
{
  "status": "success",
  "message": "Email accounts retrieved successfully",
  "data": {
    "emailAccounts": [...],
    "pagination": {
      "totalCount": 25,
      "totalPages": 3,
      "currentPage": 1,
      "pageSize": 10,
      "hasNextPage": true,
      "hasPrevPage": false
    }
  }
}
```

### 3. Get Email Account by ID
**GET** `/api/email-accounts/:id`

**Authentication:** Required (Admin only)

**Response:**
```json
{
  "status": "success",
  "message": "Email account retrieved successfully",
  "data": {
    "_id": "65f1a2b3c4d5e6f7g8h9i0j1",
    "name": "Gmail Primary",
    "email": "applications@company.com",
    "provider": "gmail",
    "imapHost": "imap.gmail.com",
    "imapPort": 993,
    "imapUser": "applications@company.com",
    "imapPassword": "********",
    "imapTls": true,
    "isActive": true,
    "createdBy": {
      "_id": "65f1a2b3c4d5e6f7g8h9i0j1",
      "firstName": "John",
      "lastName": "Doe",
      "email": "john@company.com"
    },
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-15T10:30:00.000Z"
  }
}
```

### 4. Update Email Account
**PUT** `/api/email-accounts/:id`

**Authentication:** Required (Admin only)

**Request Body:** (all fields optional)
```json
{
  "name": "Gmail Primary Updated",
  "isActive": false,
  "imapPassword": "new-password"
}
```

**Response:**
```json
{
  "status": "success",
  "message": "Email account updated successfully",
  "data": {
    // Updated email account object
  }
}
```

### 5. Delete Email Account
**DELETE** `/api/email-accounts/:id`

**Authentication:** Required (Admin only)

**Response:**
```json
{
  "status": "success",
  "message": "Email account deleted successfully",
  "data": null
}
```

### 6. Test Email Account Connection
**POST** `/api/email-accounts/:id/test`

**Authentication:** Required (Admin only)

**Description:** Tests the IMAP connection to verify credentials and connectivity.

**Response:**
```json
{
  "status": "success",
  "message": "Email account connection successful",
  "data": {
    "connected": true
  }
}
```

**Error Response:**
```json
{
  "status": "error",
  "message": "Failed to connect to email account. Please check credentials.",
  "statusCode": 400
}
```

## Security Features

1. **Password Encryption**: All passwords are automatically encrypted using AES-256-CBC before saving to the database
2. **Password Masking**: Passwords are masked as `********` in API responses
3. **Admin Only Access**: All endpoints require authentication and admin role
4. **Input Validation**: Comprehensive Zod schema validation for all requests
5. **Rate Limiting**: API rate limiting applied to prevent abuse

## Implementation Details

### Files Created:
1. `/src/types/emailAccount.types.ts` - Zod validation schemas and TypeScript types
2. `/src/controllers/emailAccount.controller.ts` - Controller with all CRUD operations
3. `/src/routes/emailAccount.routes.ts` - Express routes with middleware
4. `/src/routes/index.ts` - Main API router

### Features:
- ✅ Full CRUD operations
- ✅ Automatic password encryption/decryption
- ✅ IMAP connection testing
- ✅ Pagination support
- ✅ Advanced filtering (provider, active status, search)
- ✅ User tracking (createdBy field)
- ✅ Duplicate email prevention
- ✅ Population of related data
- ✅ Comprehensive error handling
- ✅ Logging for all operations

## Next Steps

The Email Accounts Management API is complete and ready for use. You can now:

1. **Test the API** - Use Postman/Thunder Client to test all endpoints
2. **Move to Resume Processing** - Implement resume parsing endpoints
3. **Build Application APIs** - Create application management with the three submission methods

Would you like me to continue with the Resume Processing endpoints or test the Email Accounts API first?
