# Railway Deployment Guide - Omi LinguaLearn

## Step-by-Step Deployment Instructions

### Prerequisites Checklist

Before you start, make sure you have:

- [x] GitHub repository pushed (✅ Done - https://github.com/andresgomezsar/omi-lingualearn)
- [ ] Gemini API Key from [Google AI Studio](https://aistudio.google.com/app/apikey)
- [ ] Railway account (we'll create this)
- [ ] Optional: GCP Storage credentials (for audio storage)

---

## Part 1: Create Railway Account (2 minutes)

1. **Go to [Railway.app](https://railway.app/)**

2. **Click "Login" → "Login with GitHub"**
   - Authorize Railway to access your GitHub account
   - This allows Railway to deploy from your repos

3. **Verify your email** if prompted

✅ **Checkpoint:** You should now see the Railway dashboard

---

## Part 2: Create New Project (1 minute)

1. **Click "New Project"** (big purple button)

2. **Select "Deploy from GitHub repo"**

3. **Choose your repository:**
   - Find and click `andresgomezsar/omi-lingualearn`
   - Railway will analyze your repo

4. **Railway auto-detects everything:**
   - ✅ Recognizes it's a Node.js app
   - ✅ Finds package.json
   - ✅ Sets up build commands automatically

✅ **Checkpoint:** You should see your project deploying (will fail - that's expected! We need database)

---

## Part 3: Add PostgreSQL Database (1 minute)

1. **In your Railway project, click "+ New"** (top right)

2. **Select "Database" → "Add PostgreSQL"**

3. **Railway automatically:**
   - Creates a PostgreSQL database
   - Generates a `DATABASE_URL` environment variable
   - Links it to your service

4. **Verify the connection:**
   - Click on the PostgreSQL service
   - Go to "Variables" tab
   - You should see `DATABASE_URL` with a long postgres:// URL

✅ **Checkpoint:** You now have a database connected to your app

---

## Part 4: Configure Environment Variables (3 minutes)

1. **Click on your web service** (the one named `omi-lingualearn`, not the database)

2. **Go to "Variables" tab**

3. **Add these environment variables** (click "+ New Variable" for each):

### Required Variables:

```bash
# Already exists from database - DO NOT ADD AGAIN
# DATABASE_URL=postgresql://... (auto-created)

# Gemini AI (REQUIRED)
GEMINI_API_KEY=your_actual_gemini_api_key_here

# Session Security (REQUIRED)
SESSION_SECRET=please_generate_a_random_secret_string

# Node Environment (REQUIRED)
NODE_ENV=production
```

### Optional Variables (for audio storage):

```bash
# Google Cloud Storage (optional - only if you want audio features)
GCP_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"..."}
GCP_BUCKET_NAME=your-bucket-name
```

**How to generate SESSION_SECRET:**
- On Mac/Linux: Run `openssl rand -base64 32` in terminal
- Or use any random string (32+ characters)

4. **Click "Add" after entering each variable**

✅ **Checkpoint:** All required variables are set

---

## Part 5: Run Database Migrations (2 minutes)

Your database is empty - we need to create the tables!

### Option A: Using Railway Dashboard (Easiest)

1. **Click on your web service**

2. **Go to "Deployments" tab**

3. **Wait for current deployment to finish**

4. **Click on the three dots (...) next to latest deployment**

5. **Select "View Logs"**

6. **Look for any database errors** - if you see errors about missing tables, continue:

7. **Go to "Settings" tab**

8. **Find "Custom Start Command"** and temporarily change it to:
   ```
   npm run db:push && npm start
   ```

9. **Click "Redeploy"** (this will run migrations then start)

10. **After deployment succeeds, change start command back to:**
    ```
    npm start
    ```

### Option B: Using Railway CLI (More Control)

1. **Install Railway CLI:**
   ```bash
   npm install -g @railway/cli
   ```

2. **Login to Railway:**
   ```bash
   railway login
   ```

3. **Link to your project:**
   ```bash
   cd /Users/andy/Library/Mobile\ Documents/com~apple~CloudDocs/Developer\ \(iCloud\)/Omi-LinguaLearn
   railway link
   ```
   - Select your project from the list

4. **Run migrations:**
   ```bash
   railway run npm run db:push
   ```

✅ **Checkpoint:** Database tables are created!

---

## Part 6: Verify Deployment (2 minutes)

1. **Go to your web service in Railway**

2. **Click "Settings" tab**

3. **Find "Domains" section**

4. **Click "Generate Domain"** - Railway will give you a free subdomain like:
   ```
   https://omi-lingualearn-production.up.railway.app
   ```

5. **Copy this URL** - you'll need it for Omi App Store!

6. **Test your deployment:**
   - Click the generated URL
   - You should see your app's home page or a redirect

7. **Test API health:**
   - Visit: `https://your-app.up.railway.app/api/auth/me`
   - Should return JSON (might be unauthorized, that's fine)

8. **Test Omi manifest:**
   - Visit: `https://your-app.up.railway.app/.well-known/omi-tools.json`
   - Should return JSON with your tools

✅ **Checkpoint:** Your app is live and responding!

---

## Part 7: Configure Omi App (5 minutes)

Now that your app is deployed, configure it in Omi:

1. **Go to [Omi App Store](https://omi.me/apps)** (or wherever you submit apps)

2. **Create new app** with these settings:

   **App Details:**
   - Name: `LinguaLearn`
   - Description: `AI-powered language learning through voice coaching`
   - Category: Education / Language Learning

   **Integration Type:** App Integration

   **Webhooks URLs** (use your Railway URL):
   ```
   Setup URL: https://your-app.up.railway.app/api/omi/setup-complete
   Memory Webhook: https://your-app.up.railway.app/api/omi/hub?event=memory
   Transcript Webhook: https://your-app.up.railway.app/api/omi/hub?event=transcript
   Audio Webhook: https://your-app.up.railway.app/api/omi/hub?event=audio
   ```

   **Or use the unified endpoint for all:**
   ```
   Unified Webhook: https://your-app.up.railway.app/api/omi/hub
   ```

   **Chat Tools:**
   ```
   Tools Manifest: https://your-app.up.railway.app/.well-known/omi-tools.json
   ```

3. **Save and publish your app**

✅ **Checkpoint:** Omi app is configured!

---

## Part 8: Test with Real Omi Device (10 minutes)

1. **Install your app on Omi device**

2. **Complete setup** - this should:
   - Call `/api/omi/setup-complete`
   - Create a user in your database
   - Log in Railway: "Creating new user for Omi UID: abc123..."

3. **Have a conversation** - Omi should:
   - Send transcripts to your app
   - Extract facts from the conversation
   - Store them for personalized challenges

4. **Say "lingua learn"** - should:
   - Trigger challenge generation
   - Use one of your stored facts
   - Create a personalized speaking challenge

5. **Check Railway logs:**
   - Go to your service → "Deployments" → Click latest → "View Logs"
   - You should see:
     ```
     Creating new user for Omi UID: abc123
     Extracted 3 facts from memory mem-456
     Stored fact: [hobby] User enjoys traveling
     Generated new voice challenge 1 for user xyz: "Tell me about your..."
     ```

✅ **Checkpoint:** Everything works end-to-end!

---

## Troubleshooting

### Issue: Deployment Failed

**Check build logs:**
1. Go to "Deployments" tab
2. Click on failed deployment
3. Read error messages

**Common fixes:**
- Missing dependencies: Railway should auto-install
- Build errors: Check if code compiles locally with `npm run build`
- Port issues: Railway auto-assigns PORT, your code should use `process.env.PORT`

### Issue: Database Connection Error

**Error:** "password authentication failed" or "database does not exist"

**Fix:**
1. Make sure PostgreSQL service is running (green dot)
2. Verify `DATABASE_URL` variable exists in your web service
3. Try redeploying: "Settings" → "Redeploy"

### Issue: App Deploys but Returns 500 Error

**Check logs:**
1. "Deployments" → Latest → "View Logs"
2. Look for error messages

**Common causes:**
- Missing environment variables (especially `GEMINI_API_KEY`)
- Database tables not created (run `npm run db:push`)
- Syntax errors in code

### Issue: "Cannot find module" errors

**Fix:**
1. Make sure all dependencies are in `package.json`
2. Railway runs `npm install` automatically
3. Check "Deployments" logs for install errors

### Issue: Omi Webhooks Not Working

**Debug checklist:**
1. ✅ URL is correct (no trailing slashes)
2. ✅ App is deployed and accessible
3. ✅ Check Railway logs when Omi sends webhook
4. ✅ Verify webhook URL in Omi app settings

**Test webhooks manually:**
```bash
# Test setup webhook
curl -X POST https://your-app.up.railway.app/api/omi/setup-complete?uid=test123

# Should return: {"status":"ok"}
```

---

## Monitoring & Logs

### View Real-Time Logs

1. **Railway Dashboard** → Your Service → "Deployments"
2. **Click latest deployment** → "View Logs"
3. **Watch live logs** - updates in real-time
4. **Search logs** - Use Cmd+F to find specific events

### Key Log Messages to Watch For

**Good signs:**
```
✓ Creating new user for Omi UID: abc123
✓ Processing memory for user xyz-456
✓ Extracted 3 facts from memory
✓ Generated new voice challenge
✓ Server listening on port 3000
```

**Warning signs:**
```
✗ GEMINI_API_KEY not found
✗ GCP storage not configured (OK if you don't need audio)
✗ Database connection failed
✗ Invalid Omi UID
```

### Performance Metrics

Railway provides:
- CPU usage
- Memory usage
- Network traffic
- Response times

**Access:** Service → "Metrics" tab

---

## Cost Management

### Railway Free Tier

- **$5 free credit per month**
- **Includes:**
  - Web service hosting
  - PostgreSQL database
  - Custom domain
  - Automatic deployments

### Typical Usage for Your App

**Expected monthly cost: $3-5**
- Web service: ~$2-3/mo
- PostgreSQL: ~$1-2/mo
- Bandwidth: Usually free tier

### If You Need More

**Upgrade to Hobby Plan ($5/mo + usage):**
- More resources
- Better performance
- Priority support

---

## Updating Your App

### Automatic Deployments (Already Set Up!)

Railway automatically deploys when you push to GitHub:

1. **Make code changes locally**
2. **Commit and push:**
   ```bash
   git add .
   git commit -m "Your changes"
   git push origin main
   ```
3. **Railway auto-deploys** - Watch in "Deployments" tab
4. **New version goes live** in ~2-3 minutes

### Manual Redeploy

If you need to redeploy without code changes:

1. Go to "Deployments" tab
2. Click "..." on any deployment
3. Select "Redeploy"

---

## Environment Variables Management

### Adding New Variables

1. Service → "Variables" tab
2. Click "+ New Variable"
3. Enter name and value
4. Click "Add"
5. **Railway auto-redeploys** with new variable

### Updating Variables

1. Click on variable to edit
2. Change value
3. Save
4. Railway will redeploy

### Secrets Best Practices

- ✅ DO use Railway's variable storage (encrypted)
- ✅ DO rotate secrets periodically
- ❌ DON'T commit secrets to GitHub
- ❌ DON'T share Railway project with untrusted users

---

## Backup & Recovery

### Database Backups

**Railway automatically backs up your database!**

**Manual backup:**
1. Click PostgreSQL service
2. Go to "Data" tab
3. Click "Download Backup"

**Restore from backup:**
1. Contact Railway support
2. Or create new database and import SQL dump

### Code Backups

Your code is safe in GitHub:
- Every commit is a backup
- Can roll back any time
- Can redeploy old commits in Railway

---

## Next Steps After Deployment

1. **Monitor logs** for first 24 hours
2. **Test with multiple Omi users** (different UIDs)
3. **Verify data isolation** - users shouldn't see each other's data
4. **Submit to Omi App Store** for review
5. **Set up error tracking** (optional - Sentry, LogRocket)
6. **Configure custom domain** (optional - in Railway Settings)

---

## Support Resources

- **Railway Docs:** https://docs.railway.app/
- **Railway Discord:** https://discord.gg/railway
- **Your deployment logs:** Railway Dashboard → Deployments → View Logs

---

## Summary - Your Deployment URL

After completing this guide, you'll have:

```
Production URL: https://omi-lingualearn-production.up.railway.app
Omi Tools: https://omi-lingualearn-production.up.railway.app/.well-known/omi-tools.json
Webhook Hub: https://omi-lingualearn-production.up.railway.app/api/omi/hub
```

**Status:** ✅ Production Ready
**Multi-User:** ✅ Enabled
**Memory Extraction:** ✅ Working
**Language Personalization:** ✅ Active

---

Good luck with your deployment! 🚀
