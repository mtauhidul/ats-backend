# Email Monitoring System - How It Works

## Flow Diagram: Enabling Email Automation from Admin Panel

```
┌─────────────────────────────────────────────────────────────────────────┐
│ 1. ADMIN PANEL (Frontend)                                                │
│    /settings/email-monitoring                                            │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ Admin clicks "Start Monitoring"
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ 2. FRONTEND API CALL                                                     │
│    POST /api/emails/automation/enable                                    │
│                                                                           │
│    Code: startAutomation() function                                      │
│    File: email-monitoring-settings.tsx                                   │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ HTTP Request
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ 3. BACKEND ROUTE HANDLER                                                 │
│    POST /api/emails/automation/enable                                    │
│                                                                           │
│    Code:                                                                 │
│    router.post('/automation/enable', async (req, res) => {              │
│      const userId = req.user?.id;                                        │
│      await emailAutomationJob.enable(userId);                            │
│      res.json({ success: true });                                        │
│    });                                                                   │
│                                                                           │
│    File: src/routes/email.routes.ts                                      │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ Calls enable() method
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ 4. EMAIL AUTOMATION JOB                                                  │
│                                                                           │
│    Code:                                                                 │
│    async enable(userId?: string): Promise<void> {                        │
│      await SystemSettings.setEmailAutomation(true, userId);              │
│    }                                                                     │
│                                                                           │
│    File: src/jobs/emailAutomation.job.ts                                 │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ Saves to database
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ 5. DATABASE UPDATE (MongoDB)                                             │
│    Collection: systemsettings                                            │
│                                                                           │
│    Document:                                                             │
│    {                                                                     │
│      emailAutomationEnabled: true,    ← Changed from false to true      │
│      emailAutomationLastToggled: ISODate("2025-11-01T..."),             │
│      emailAutomationToggledBy: ObjectId("user_id"),                     │
│      updatedAt: ISODate("2025-11-01T...")                               │
│    }                                                                     │
│                                                                           │
│    File: SystemSettings Model                                            │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ Database now has: enabled = true
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ 6. CRON JOB CHECKS DATABASE (Every 15 minutes)                          │
│                                                                           │
│    Code:                                                                 │
│    this.cronJob = cron.schedule('*/15 * * * *', async () => {           │
│      const enabled = await this.isEnabled(); ← Reads from database      │
│      if (enabled) {                                                      │
│        await this.processEmails();     ← Runs if true                   │
│      }                                                                   │
│    });                                                                   │
│                                                                           │
│    File: src/jobs/emailAutomation.job.ts                                 │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ enabled = true, so automation runs
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ 7. EMAIL PROCESSING STARTS                                               │
│                                                                           │
│    - Fetches active email accounts                                       │
│    - Checks for unread emails                                            │
│    - Processes resumes                                                   │
│    - Creates applications                                                │
│                                                                           │
│    Logs:                                                                 │
│    🚀 EMAIL AUTOMATION CYCLE STARTED                                     │
│    📊 Found 2 active email account(s)                                    │
│    📬 Checking account: hr@company.com                                   │
│    ...                                                                   │
└─────────────────────────────────────────────────────────────────────────┘
```

## Detailed Step-by-Step Flow

### When You Click "Start Monitoring"

1. **Frontend Button Click**
   ```tsx
   <Button onClick={startAutomation}>
     Start Monitoring
   </Button>
   ```

2. **API Call to Backend**
   ```typescript
   const response = await authenticatedFetch("/email-automation/enable", {
     method: "POST",
   });
   ```

3. **Backend Route Receives Request**
   ```typescript
   router.post('/automation/enable', async (req, res) => {
     const userId = req.user?.id;  // Who clicked the button
     await emailAutomationJob.enable(userId);
     res.json({ success: true });
   });
   ```

4. **Enable Method Saves to Database**
   ```typescript
   async enable(userId?: string): Promise<void> {
     await SystemSettings.setEmailAutomation(true, userId);
   }
   ```

5. **Database is Updated**
   ```javascript
   MongoDB systemsettings collection:
   {
     emailAutomationEnabled: true,  // ← This is the key flag!
     emailAutomationLastToggled: new Date(),
     emailAutomationToggledBy: userId
   }
   ```

6. **Cron Job Reads Database Every 15 Minutes**
   ```typescript
   cron.schedule('*/15 * * * *', async () => {
     const settings = await SystemSettings.getSettings();
     if (settings.emailAutomationEnabled) {  // ← Reads the flag
       await this.processEmails();
     }
   });
   ```

## How the Backend "Knows" It's Enabled

The backend knows because:

1. **Persistent Storage**: The flag is stored in MongoDB (`emailAutomationEnabled: true`)
2. **Automatic Checking**: The cron job checks the database every 15 minutes
3. **Real-time Status**: Every time before processing, it reads the current value
4. **Survives Restarts**: When server restarts, it checks database on startup

## API Endpoints Available

### Frontend Can Call Any of These:

```
POST /api/emails/automation/start      ← Enables automation
POST /api/emails/automation/enable     ← Same as above (alias)

POST /api/emails/automation/stop       ← Disables automation  
POST /api/emails/automation/disable    ← Same as above (alias)

GET  /api/emails/automation/status     ← Check current status

POST /api/emails/automation/trigger    ← Manually run one cycle
```

All of these routes save to/read from the database!

## Example: Complete Flow

### Scenario: You enable monitoring, then restart server

1. **You enable from admin panel**
   - Frontend calls: `POST /api/emails/automation/enable`
   - Backend saves: `{ emailAutomationEnabled: true }` to MongoDB
   - Response: ✅ "Email monitoring started successfully"

2. **Cron runs every 15 minutes**
   - Checks database: `await SystemSettings.getSettings()`
   - Sees: `emailAutomationEnabled: true`
   - Runs: `await this.processEmails()`

3. **You restart the server**
   - Server starts up
   - Calls: `await emailAutomationJob.start()`
   - Checks database: `await this.isEnabled()`
   - Sees: `emailAutomationEnabled: true` (still there!)
   - Logs: "📧 Email automation status from database: ENABLED"
   - Runs initial check after 5 seconds

4. **Automation continues running**
   - Every 15 minutes, checks database
   - Still sees `emailAutomationEnabled: true`
   - Keeps processing emails

### The Key: Database is the Source of Truth

```
┌─────────────┐
│  Database   │ ← Single source of truth
│ (MongoDB)   │
│             │
│ enabled:    │
│   true      │
└──────┬──────┘
       │
       │ Both read from here
       │
       ├──────────┐
       │          │
       ▼          ▼
   ┌────────┐ ┌────────┐
   │Frontend│ │Backend │
   │Status  │ │ Cron   │
   │Display │ │  Job   │
   └────────┘ └────────┘
```

## Testing the Flow

```bash
# 1. Start backend
cd ats-backend
pnpm run dev

# You'll see:
# 📧 Email automation status from database: DISABLED

# 2. Go to frontend admin panel
# Settings → Email Monitoring → Click "Start Monitoring"

# 3. Check backend logs:
# 📧 Email automation enabled and saved to database

# 4. Wait 15 minutes (or trigger manually)
# 🚀 EMAIL AUTOMATION CYCLE STARTED

# 5. Restart server (Ctrl+C, then pnpm run dev again)
# You'll see:
# 📧 Email automation status from database: ENABLED
# 📧 Email automation will run initial check in 5 seconds...
```

The automation status persists! 🎉
