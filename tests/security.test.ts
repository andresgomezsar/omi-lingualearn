import { test } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";

process.env.APP_ACCESS_TOKEN = "test-only-operator-token-00000000000000";
process.env.OMI_UID = "testOperatorOmiUid0000000000";
process.env.OMI_WEBHOOK_SECRET = "test-only-webhook-token-000000000000000";
process.env.PUBLIC_ORIGIN = "http://localhost:5000";
delete process.env.GEMINI_API_KEY;
delete process.env.GCP_SERVICE_ACCOUNT_JSON;
const { registerRoutes, analyzeConversationWithGemini } = await import("../server/routes");
const { storage } = await import("../server/storage");
const { errorHandler, operatorUser, installSecurity, trackHandler } = await import("../server/security");
const { AudioPool } = await import("../server/audio-ingestion");
const { authorizedObjectPath, generateFolderIdFromOmiUid, getCompiledAudioInTimeRange } = await import("../server/gcp-storage");

test("production API boundary protects private state and accepts legitimate operator/relay requests", async () => {
  const app = express(), server = createServer(app);
  await registerRoutes(server, app); app.use(errorHandler);
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${(server.address() as any).port}`;
  let cookie = "";
  const request = (path: string, method = "GET", data?: unknown, headers: Record<string,string> = {}) => fetch(base + path, {
    method, headers: { Origin: process.env.PUBLIC_ORIGIN!, ...(cookie ? { Cookie: cookie } : {}), ...(data !== undefined ? { "Content-Type": "application/json" } : {}), ...headers },
    body: data === undefined ? undefined : JSON.stringify(data),
  });
  try {
    const owner = await operatorUser();
    const other = await storage.createUser({ username: "foreign", password: "fixture" });
    await storage.createUserFact({ userId: other.id, content: "foreign-private-marker", category: "test" });
    await storage.createUserFact({ userId: owner.id, content: "owner-private-marker", category: "test" });
    for (const path of ["/api/user-facts", `/api/user-facts?userId=${other.id}`, "/api/users", "/api/omi/setup-info", "/api/omi/hub/test"]) assert.equal((await request(path)).status, 401);
    assert.equal((await request("/api/user/reset", "POST", {})).status, 401);
    assert.equal((await request("/api/auth/session", "POST", { token: process.env.APP_ACCESS_TOKEN }, { Origin: "https://attacker.test" })).status, 403);
    assert.equal((await request("/api/auth/session", "POST", { token: "bad" })).status, 401);
    const login = await request("/api/auth/session", "POST", { token: process.env.APP_ACCESS_TOKEN });
    assert.equal(login.status, 200); assert.match(login.headers.get("set-cookie")!, /HttpOnly/); assert.match(login.headers.get("set-cookie")!, /SameSite=Strict/);
    cookie = login.headers.get("set-cookie")!.split(";")[0];
    const profile = await (await request("/api/user/profile")).json();
    assert.equal(profile.id, owner.id); assert.equal(profile.password, undefined);
    const facts = await (await request("/api/user-facts")).json();
    assert.ok(facts.some((f: any) => f.content === "owner-private-marker")); assert.ok(!JSON.stringify(facts).includes("foreign-private-marker"));
    assert.equal((await request(`/api/user/profile?userId=${other.id}`)).status, 403);
    assert.equal((await request("/api/learning-items", "POST", { userId: other.id, originalText: "bad" })).status, 403);
    const voice = await storage.createVoiceChallenge({ userId: other.id, prompt: "private", status: "active" });
    for (const suffix of ["", "/respond", "/regenerate"]) assert.equal((await request(`/api/voice-challenges/${voice.id}${suffix}`, suffix ? "POST" : "GET", suffix ? { transcript: "fixture" } : undefined)).status, 404);
    assert.equal((await storage.getVoiceChallenge(voice.id))?.status, "active");
    const ownVoice = await storage.createVoiceChallenge({ userId: owner.id, prompt: "practice", status: "active" });
    assert.equal((await request(`/api/voice-challenges/${ownVoice.id}/respond`, "POST", { transcript: "fixture", audioUri: "gs://unrelated/private.wav" })).status, 403);
    assert.equal((await request(`/api/voice-challenges/${ownVoice.id}/respond`, "POST", { transcript: "fixture" })).status, 500);
    assert.equal((await storage.getVoiceChallenge(ownVoice.id))?.status, "active", "AI failure must not fabricate a completion");
    const daily = await storage.createDailyChallenge({ userId: other.id, challengeText: "private" });
    assert.equal((await request(`/api/challenges/${daily.id}/complete`, "PATCH", { quality: 5 })).status, 404);
    const ownDaily = await storage.createDailyChallenge({ userId: owner.id, challengeText: "practice", xpEarned: 25 });
    assert.equal((await request(`/api/challenges/${ownDaily.id}/complete`, "PATCH", { quality: 0 })).status, 200);
    assert.equal((await storage.getDailyChallenge(ownDaily.id))?.quality, 0);
    const xp = (await storage.getUser(owner.id))?.totalXp;
    await request(`/api/challenges/${ownDaily.id}/complete`, "PATCH", { quality: 5 });
    assert.equal((await storage.getUser(owner.id))?.totalXp, xp);
    const eventHeaders = () => ({ Authorization: `Bearer ${process.env.OMI_WEBHOOK_SECRET}`, "X-Event-Id": randomUUID(), "X-Event-Timestamp": String(Date.now()) });
    const webhook = `/api/omi/webhook/memory?uid=${process.env.OMI_UID}`;
    assert.equal((await request(webhook, "POST", {})).status, 401);
    assert.equal((await request("/api/omi/hub?uid=wrong", "POST", {}, eventHeaders())).status, 401);
    const headers = eventHeaders();
    assert.equal((await request(webhook, "POST", { structured: { title: "A fixture personal memory" } }, headers)).status, 200);
    assert.equal((await request(webhook, "POST", {}, headers)).status, 409);
    assert.ok((await storage.getUserFacts(owner.id)).some(f => f.content === "A fixture personal memory"));
    for (const path of ["/api/omi/webhook/audio", "/api/omi/hub?event=audio"]) {
      const join = path.includes("?") ? "&" : "?";
      const url = base + path + join + `uid=${process.env.OMI_UID}&session_id=fixture`;
      const oversized = await fetch(url, { method: "POST", headers: { ...eventHeaders(), "Content-Type": "application/octet-stream" }, body: Buffer.alloc(2 * 1024 * 1024 + 2) });
      assert.equal(oversized.status, 413);
      const odd = await fetch(url, { method: "POST", headers: { ...eventHeaders(), "Content-Type": "application/octet-stream" }, body: Buffer.alloc(3) });
      assert.equal(odd.status, 400);
    }
    const malformed = await fetch(base + "/api/user-facts", { method: "POST", headers: { Cookie: cookie, Origin: process.env.PUBLIC_ORIGIN!, "Content-Type": "application/json" }, body: "{" });
    assert.equal(malformed.status, 400); assert.equal((await request("/api/user/profile")).status, 200);
    assert.equal((await request("/api/auth/session", "DELETE")).status, 200);
    assert.equal((await request("/api/user-facts")).status, 401);
  } finally { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); }
});

test("cloud object authorization rejects unrelated buckets, sibling prefixes and encoded/traversal paths", () => {
  process.env.GCP_BUCKET_NAME = "fixture-bucket";
  const prefix = `gs://fixture-bucket/${generateFolderIdFromOmiUid(process.env.OMI_UID!)}`;
  assert.match(authorizedObjectPath(`${prefix}/compiled/1_2.wav`), /compiled\/1_2.wav$/);
  for (const uri of ["gs://other-bucket/private.wav", `${prefix}x/compiled/1.wav`, `${prefix}/../secret`, `${prefix}/%2e%2e/secret`, `${prefix}//file`]) assert.throws(() => authorizedObjectPath(uri));
});

test("audio pool caps sessions, expires pending bytes and detaches a batch before the next request", () => {
  const pool = new AudioPool();
  for (let i = 0; i < 8; i++) pool.add(String(i), Buffer.alloc(2), 16000, 0);
  assert.throws(() => pool.add("ninth", Buffer.alloc(2), 16000, 0));
  pool.add("fresh", Buffer.alloc(2), 16000, 300001); assert.equal(pool.size, 1);
  assert.throws(() => pool.add("fresh", Buffer.alloc(2), 8000, 300002));
  pool.clear();
  const batch = pool.add("same", Buffer.alloc(1920002, 1), 16000)!;
  // Upload failure leaves previously acknowledged bytes available for the next attempt.
  const retry = pool.add("same", Buffer.alloc(0), 16000)!;
  assert.deepEqual(retry.data, batch.data);
  pool.commit("same", batch);
  const next = pool.add("same", Buffer.alloc(1920000, 2), 16000)!;
  assert.equal(batch.data.length, 1920000); assert.equal(batch.data[0], 1);
  assert.equal(next.data[0], 1); assert.equal(next.data[2], 2);
});


test("idle audio expires without another upload", async () => {
  const pool = new AudioPool(10);
  pool.add("idle", Buffer.alloc(2), 16000);
  assert.equal(pool.size, 1);
  await new Promise(resolve => setTimeout(resolve, 30));
  assert.equal(pool.size, 0);
});

test("every conversation analysis rejects more than eight files before provider calls", async () => {
  await assert.rejects(analyzeConversationWithGemini("fixture", Array(9).fill("gs://never-read/file")), /Too many audio files/);
});

test("recent audio uses registered metadata even after more than 100 older recordings", async () => {
  process.env.GCP_BUCKET_NAME = "fixture-bucket";
  const owner = await operatorUser();
  const folder = generateFolderIdFromOmiUid(process.env.OMI_UID!);
  for (let i = 0; i < 105; i++) await storage.createCompiledAudioFile({ userId: owner.id, gcpUri: `gs://fixture-bucket/${folder}/compiled/${i}_${i+1}.wav`, startTimestamp: new Date(i), endTimestamp: new Date(i+1), durationMs: 1 });
  const recent = `gs://fixture-bucket/${folder}/compiled/10000_10001.wav`;
  await storage.createCompiledAudioFile({ userId: owner.id, gcpUri: recent, startTimestamp: new Date(10000), endTimestamp: new Date(10001), durationMs: 1 });
  assert.deepEqual(await getCompiledAudioInTimeRange(process.env.OMI_UID!, new Date(10000), new Date(10002)), [recent]);
});

test("disconnected requests retain concurrency slots until asynchronous work settles", async () => {
  const app = express(), server = createServer(app);
  await installSecurity(app);
  const releases: Array<() => void> = [];
  app.get("/api/slow", trackHandler(async (_req, res) => {
    await new Promise<void>(resolve => releases.push(resolve));
    if (!res.destroyed) res.json({ ok: true });
  }));
  app.get("/api/fast", trackHandler((_req, res) => { res.json({ ok: true }); }));
  app.use(errorHandler);
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${(server.address() as any).port}`;
  try {
    const login = await fetch(base + "/api/auth/session", { method: "POST", headers: { Origin: process.env.PUBLIC_ORIGIN!, "Content-Type": "application/json" }, body: JSON.stringify({ token: process.env.APP_ACCESS_TOKEN }) });
    const headers = { Cookie: login.headers.get("set-cookie")!.split(";")[0] };
    const controllers = Array.from({ length: 4 }, () => new AbortController());
    const pending = controllers.map(c => fetch(base + "/api/slow", { headers, signal: c.signal }).catch(() => null));
    for (let i = 0; i < 100 && releases.length < 4; i++) await new Promise(resolve => setTimeout(resolve, 5));
    assert.equal(releases.length, 4);
    controllers.forEach(c => c.abort()); await Promise.all(pending);
    assert.equal((await fetch(base + "/api/fast", { headers })).status, 429);
    releases.forEach(release => release());
    await new Promise(resolve => setTimeout(resolve, 10));
    assert.equal((await fetch(base + "/api/fast", { headers })).status, 200);
  } finally { releases.forEach(release => release()); server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); }
});
