# Email Monitoring System - Database-Persisted Status

## Problem

The email monitoring system was automatically starting after every server restart, even if it had been manually turned off by the admin. The enabled/disabled status was stored in memory (`isEnabled = true`) and was lost on restart.

## Solution

Implemented a database-persisted system settings model that stores the email automation status. The system now checks the database on startup and respects the last saved state.

## Changes Made

### 1. New Model: SystemSettings

**File:** `src/models/SystemSettings.ts`

- Created a singleton model to store global system configuration
- Stores `emailAutomationEnabled` boolean flag
- Tracks who toggled the setting and when
- Prevents deletion and ensures only one settings document exists

**Key Methods:**

- `SystemSettings.getSettings()` - Get or create the settings document
- `SystemSettings.setEmailAutomation(enabled, userId)` - Update automation status

### 2. Updated Email Automation Job

**File:** `src/jobs/emailAutomation.job.ts`

- Removed hardcoded `isEnabled = true` flag
- Added async `isEnabled()` method that reads from database
- Updated `enable()` and `disable()` methods to save to database
- Updated `start()` method to check database status on startup
- Added logging to show current status on server start

**Behavior:**

- On server startup, checks database for automation status
- Only runs automated email checking if database flag is `true`
- Logs clear messages about current status

### 3. Updated Email Routes

**File:** `src/routes/email.routes.ts`

- Made `/automation/start` and `/automation/stop` endpoints async
- Now saves status to database when toggled
- Passes user ID to track who made the change
- Returns clearer success messages

### 4. Updated Server Startup

**File:** `src/server.ts`

- Made `emailAutomationJob.start()` call async with await
- Ensures database status is checked before proceeding

### 5. Migration Script

**File:** `src/scripts/init-system-settings.ts`

- Creates initial system settings document
- Sets `emailAutomationEnabled` to `false` by default for safety
- Can be run manually: `npx ts-node src/scripts/init-system-settings.ts`

## Setup Instructions

### For New Installations

The system settings will be automatically created on first use with `emailAutomationEnabled: false`.

### For Existing Installations

Run the migration script once:

```bash
cd ats-backend
npx ts-node src/scripts/init-system-settings.ts
```

This will create the system settings document with email automation **disabled** by default.

## Usage

### Enable Email Monitoring

1. Go to Settings → Email Monitoring in the admin panel
2. Click "Start Monitoring"
3. Status is saved to database

### Disable Email Monitoring

1. Go to Settings → Email Monitoring in the admin panel
2. Click "Stop Monitoring"
3. Status is saved to database

### Status Persistence

- ✅ Status survives server restarts
- ✅ Status is shared across all server instances
- ✅ Changes are tracked with timestamps and user IDs
- ✅ Default state is DISABLED for safety

## API Endpoints

### Get Automation Status

```
GET /api/emails/automation/status
```

Returns current status from database.

### Enable Automation

```
POST /api/emails/automation/start
```

Enables automation and saves to database.

### Disable Automation

```
POST /api/emails/automation/stop
```

Disables automation and saves to database.

### Manual Trigger (Testing)

```
POST /api/emails/automation/trigger
```

Manually runs one cycle regardless of enabled status.

## Default Behavior

**Before (Old):**

- Server starts → Email automation **ALWAYS ENABLED**
- Admin disables → Saved in memory only
- Server restarts → Back to **ENABLED** (memory lost)

**After (New):**

- Server starts → Check database → Respect saved status
- Admin enables → Saved to database
- Server restarts → Check database → **STATUS PRESERVED**
- Fresh install → **DISABLED by default** (safer)

## Database Collection

**Collection:** `systemsettings`

**Document Structure:**

```json
{
  "_id": "...",
  "emailAutomationEnabled": false,
  "emailAutomationLastToggled": "2025-11-01T...",
  "emailAutomationToggledBy": "user_id_here",
  "createdAt": "2025-11-01T...",
  "updatedAt": "2025-11-01T..."
}
```

## Benefits

1. **Predictable Behavior**: Status persists across restarts
2. **Audit Trail**: Know who changed the setting and when
3. **Safer Default**: Disabled by default on fresh installs
4. **Cluster-Safe**: Works correctly with multiple server instances
5. **Admin Control**: Full control from the UI without code changes

## Testing

1. Enable monitoring from admin panel
2. Restart the server
3. Check logs - should show "Email automation status from database: ENABLED"
4. Disable monitoring from admin panel
5. Restart the server
6. Check logs - should show "Email automation status from database: DISABLED"

## Logs

On server startup, you'll see:

```
📧 Email automation cron job started (interval: */15 * * * *)
📧 Email automation status from database: DISABLED
📧 Email automation is disabled. Use the admin panel to enable it.
```

Or if enabled:

```
📧 Email automation cron job started (interval: */15 * * * *)
📧 Email automation status from database: ENABLED
📧 Email automation will run initial check in 5 seconds...
```
