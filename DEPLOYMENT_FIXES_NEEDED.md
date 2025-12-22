# Critical Fixes Needed Before Omi App Store Deployment

## Issues Identified

### 1. User Memories Not Being Captured ❌
**File:** `server/routes.ts:278-317`
**Problem:** Memory webhook doesn't extract user facts from Omi memories

**Fix Required:**
```typescript
app.post("/api/omi/webhook/memory", async (req: Request, res: Response) => {
  const uid = req.query.uid as string;
  const memory = req.body;

  // MISSING: Get or create user from omi UID
  let user = await storage.getUserByOmiUid(uid);
  if (!user) {
    user = await storage.createUser({
      username: `omi_${uid.slice(0, 8)}`,
      password: uid,
    });
    await storage.updateUserOmiUid(user.id, uid);
  }

  const userId = user.id;

  // MISSING: Extract facts from memory.structured
  if (memory?.structured) {
    // Extract and store user facts
    const facts = extractFactsFromStructured(memory.structured);
    for (const fact of facts) {
      await storage.createUserFact({
        userId,
        omiFactId: memory.id,
        category: fact.category,
        content: fact.content,
      });
    }
  }

  // Existing transcript processing...
});
```

### 2. Hardcoded DEFAULT_USER_ID Throughout Webhooks ❌
**Files:** Multiple locations in `server/routes.ts`
**Problem:** All webhooks use `DEFAULT_USER_ID` instead of real user ID

**Locations to fix:**
- Line 208: Setup webhook
- Line 243, 253, 300: Transcript/memory processing
- Line 360, 370: Audio webhook
- Line 792, 908, 1006: Unified webhook handlers
- Line 1137: Setup complete handler

**Fix Required:**
```typescript
// Add helper function at top of routes.ts
async function getUserFromOmiUid(uid: string): Promise<User> {
  let user = await storage.getUserByOmiUid(uid);
  if (!user) {
    // Auto-create user on first interaction
    const newUser = await storage.createUser({
      username: `omi_${uid.slice(0, 8)}_${Date.now()}`,
      password: uid,
    });
    user = await storage.updateUserOmiUid(newUser.id, uid);
  }
  return user!;
}

// Use in all webhooks:
const uid = req.query.uid as string;
if (!uid) {
  return res.status(400).json({ error: "Missing uid parameter" });
}
const user = await getUserFromOmiUid(uid);
const userId = user.id;
```

### 3. Memory Structure Parsing ❌
**Problem:** No code to parse Omi's structured memory format

**Fix Required:**
Create helper function to extract facts from Omi memories:

```typescript
interface OmiStructured {
  category?: string;
  title?: string;
  overview?: string;
  emoji?: string;
  // Omi's structured format varies
}

function extractFactsFromStructured(structured: OmiStructured): Array<{category: string, content: string}> {
  const facts: Array<{category: string, content: string}> = [];

  if (structured.title) {
    facts.push({
      category: structured.category || 'general',
      content: structured.title,
    });
  }

  if (structured.overview && structured.overview.length > 20) {
    facts.push({
      category: structured.category || 'general',
      content: structured.overview,
    });
  }

  return facts;
}
```

### 4. User Target Language Not Respected ⚠️
**Problem:** Challenge generation hardcodes "Spanish" instead of using user's targetLanguage

**Locations:**
- Line 829, 838: `generateChallengePrompt(userFact, "Spanish")`
- Line 1639: Hardcoded Spanish

**Fix Required:**
```typescript
// Use user's target language
const targetLanguage = user.targetLanguage || "Spanish";
const generated = await generateChallengePrompt(userFact, targetLanguage);

const challenge = await storage.createVoiceChallenge({
  userId,
  // ...
  targetLanguage: targetLanguage,
  // ...
});
```

### 5. Session Management ⚠️
**Problem:** API endpoints reference `req.user` but webhooks don't set it

**Current state:**
- `/api/user/stats` uses `req.user?.id as string` (Line 1272)
- But Omi webhooks come from external source, not browser sessions
- Need separate authentication for webhooks vs web app

**Fix Options:**
1. Add webhook authentication via shared secret
2. Use Omi UID throughout (recommended)
3. Add middleware to populate `req.user` from Omi UID

## Implementation Priority

### Phase 1: Critical (MUST FIX before deployment)
1. ✅ Add `getUserFromOmiUid()` helper
2. ✅ Replace ALL `DEFAULT_USER_ID` with real user lookup
3. ✅ Extract and store facts from memory webhook
4. ✅ Validate `uid` parameter in all webhooks

### Phase 2: Important (Should fix)
1. Use user's `targetLanguage` preference
2. Add proper error handling for missing users
3. Add webhook authentication/validation
4. Test multi-user isolation (users can't see each other's data)

### Phase 3: Nice to have
1. Rate limiting per user
2. User deletion/GDPR compliance
3. Analytics per user
4. Better fact deduplication

## Testing Checklist

Before deployment, verify:

- [ ] Create two Omi accounts with different UIDs
- [ ] Both can authenticate independently
- [ ] Each sees only their own challenges
- [ ] Each sees only their own facts
- [ ] Memories from User A don't appear for User B
- [ ] Audio/transcripts isolated per user
- [ ] XP/streaks tracked separately
- [ ] Target language preference works per user

## Database Migration Needed?

**Current schema is fine!** All tables have `userId` field. Just need to use it properly in code.

## Estimated Effort

- **Phase 1 fixes:** 4-6 hours
- **Phase 2 fixes:** 2-3 hours
- **Testing:** 2-3 hours
- **Total:** ~10 hours

## Risk Assessment

**If deployed as-is:**
- 🔴 **HIGH RISK:** All users share same account
- 🔴 **HIGH RISK:** User privacy violated (everyone sees everyone's data)
- 🔴 **HIGH RISK:** Memories not being used for personalization
- 🟡 **MEDIUM RISK:** Language preferences not working

**After fixes:**
- 🟢 **LOW RISK:** Proper user isolation
- 🟢 **LOW RISK:** Personalized experiences
- 🟢 **LOW RISK:** Ready for production
