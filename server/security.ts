import express, { type Express, type Request, type Response, type NextFunction, type RequestHandler } from "express";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { storage } from "./storage";
import type { User } from "@shared/schema";

const SESSION_MS = 12 * 60 * 60 * 1000;
const COOKIE = "lingualearn_session";
const callbacks = new Set(["/api/omi/hub", "/api/omi/setup-complete", "/api/omi/webhook/audio", "/api/omi/webhook/transcript", "/api/omi/webhook/memory"]);
export const MAX_AUDIO_BYTES = 2 * 1024 * 1024;
export function publicUser(user: User) {
  const { id, username, omiUid, nativeLanguage, targetLanguage, streak, totalXp, level, demoDataEnabled } = user;
  return { id, username, omiUid, nativeLanguage, targetLanguage, streak, totalXp, level, demoDataEnabled };
}
export function publicOrigin() { return new URL(process.env.PUBLIC_ORIGIN || "http://localhost:5000").origin; }
function equal(a: unknown, b: string) {
  return typeof a === "string" && a.length <= 512 && Buffer.byteLength(a) === Buffer.byteLength(b) && timingSafeEqual(Buffer.from(a), Buffer.from(b));
}
export async function operatorUser() {
  const uid = process.env.OMI_UID;
  if (!uid) return (await storage.getUser("demo-user"))!;
  if (!/^[a-zA-Z0-9]{20,128}$/.test(uid)) throw new Error("Invalid configured OMI_UID");
  let user = await storage.getUserByOmiUid(uid);
  if (!user) {
    const created = await storage.createUser({ username: "operator", password: randomBytes(32).toString("hex") });
    user = await storage.updateUserOmiUid(created.id, uid);
    await storage.updateUserPreferences(created.id, { demoDataEnabled: false });
    user = await storage.getUser(created.id);
  }
  return user!;
}
export function requestUserId(req: Request): string {
  const id = (req as Request & { operatorId?: string }).operatorId;
  if (!id) throw new Error("Authentication required");
  return id;
}
export function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction) {
  const status = Number(err.status || err.statusCode) || 500;
  res.status(status >= 400 && status <= 599 ? status : 500).json({ error: status === 413 ? "Request too large" : status < 500 ? "Invalid request" : "Request failed" });
}

// Installed before all parsers and routes, including in tests.
export async function installSecurity(app: Express) {
  const token = process.env.APP_ACCESS_TOKEN || "";
  if (token.length < 32 || token.length > 512) throw new Error("Set APP_ACCESS_TOKEN to a random secret of at least 32 characters");
  const origin = publicOrigin();
  if (!origin.startsWith("https://") && !["localhost", "127.0.0.1", "[::1]"].includes(new URL(origin).hostname)) throw new Error("PUBLIC_ORIGIN requires HTTPS outside localhost");
  const user = await operatorUser();
  const sessions = new Map<string, number>();
  const events = new Map<string, number>();
  let loginWindow = Date.now(), loginAttempts = 0, active = 0;
  let callbackWindow = Date.now(), callbackCount = 0;
  const cookieOptions = { httpOnly: true, sameSite: "strict" as const, secure: origin.startsWith("https:"), path: "/", maxAge: SESSION_MS };
  const cookieId = (req: Request) => req.headers.cookie?.split(";").map(s => s.trim()).find(s => s.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1) || "";
  app.disable("x-powered-by");
  app.use("/api", (req, res, next) => {
    res.set("Cache-Control", "no-store");
    res.set("X-Content-Type-Options", "nosniff");
    const path = req.path; // /api mount removed
    const webhook = req.method === "POST" && callbacks.has(`/api${path}`);
    if (webhook) {
      const secret = process.env.OMI_WEBHOOK_SECRET || "";
      if (secret.length < 32 || !process.env.OMI_UID) return res.status(503).json({ error: "Webhook ingestion is disabled" });
      if (!equal(req.headers.authorization, `Bearer ${secret}`) || req.query.uid !== process.env.OMI_UID) return res.status(401).json({ error: "Invalid callback credentials" });
      // Relay IDs identify accepted delivery attempts; see README for retry limitations.
      const id = req.get("X-Event-Id"), stamp = Number(req.get("X-Event-Timestamp"));
      if (!id || !/^[a-zA-Z0-9_-]{16,128}$/.test(id) || !Number.isFinite(stamp) || Math.abs(Date.now() - stamp) > 300_000) return res.status(400).json({ error: "Fresh event identity required" });
      for (const [key, expiry] of events) if (expiry <= Date.now()) events.delete(key);
      if (events.has(id)) return res.status(409).json({ error: "Duplicate event" });
      if (Date.now() - callbackWindow > 60_000) { callbackWindow = Date.now(); callbackCount = 0; }
      if (++callbackCount > 120 || events.size >= 1200) return res.status(429).json({ error: "Callback limit reached" });
      res.locals.eventId = id;
    } else {
      // Validate Origin even on reads when supplied; require it for cookie mutations.
      if ((req.get("Origin") && req.get("Origin") !== origin) || (!["GET", "HEAD"].includes(req.method) && req.get("Origin") !== origin)) return res.status(403).json({ error: "Origin rejected" });
      if (path === "/auth/session" && req.method === "POST") {
        if (Date.now() - loginWindow > 60_000) { loginWindow = Date.now(); loginAttempts = 0; }
        if (++loginAttempts > 10) return res.status(429).json({ error: "Try again in one minute" });
      } else {
        const id = cookieId(req);
        for (const [key, expiry] of sessions) if (expiry <= Date.now()) sessions.delete(key);
        if (!sessions.has(id)) return res.status(401).json({ error: "Sign in required" });
      }
    }
    if (active >= 4) return res.status(429).json({ error: "Server busy; retry later" });
    if (res.locals.eventId) events.set(res.locals.eventId, Date.now() + 600_000);
    active++;
    let released = false;
    const release = () => { if (!released) { active--; released = true; } };
    res.locals.releaseRequest = release;
    const releaseIfIdle = () => { if (!res.locals.routeRunning) release(); };
    res.once("finish", releaseIfIdle); res.once("close", releaseIfIdle);
    (req as Request & { operatorId: string }).operatorId = user.id;
    next();
  });
  app.use("/api", express.json({ limit: "64kb" }));
  app.use("/api", express.raw({ type: ["application/octet-stream", "audio/*"], limit: MAX_AUDIO_BYTES }));
  app.post("/api/auth/session", (req, res) => {
    if (!equal(req.body?.token, token)) return res.status(401).json({ error: "Invalid access token" });
    if (sessions.size >= 8) sessions.delete(sessions.keys().next().value!);
    sessions.delete(cookieId(req));
    const id = randomBytes(32).toString("hex");
    sessions.set(id, Date.now() + SESSION_MS);
    res.cookie(COOKIE, id, cookieOptions).json(publicUser(user));
  });
  app.get("/api/auth/session", async (_req, res) => res.json(publicUser((await storage.getUser(user.id))!)));
  app.delete("/api/auth/session", (req, res) => { sessions.delete(cookieId(req)); res.clearCookie(COOKIE, { httpOnly: true, sameSite: "strict", secure: cookieOptions.secure, path: "/" }).json({ success: true }); });
  app.use("/api", (req, res, next) => {
    if ((req.query.userId !== undefined && req.query.userId !== user.id) || (req.body?.userId !== undefined && req.body.userId !== user.id)) return res.status(403).json({ error: "Account mismatch" });
    if (req.body?.uid !== undefined && req.body.uid !== process.env.OMI_UID) return res.status(403).json({ error: "Account mismatch" });
    if (req.query.uid !== undefined && req.query.uid !== process.env.OMI_UID) return res.status(403).json({ error: "Account mismatch" });
    const session = req.query.session_id;
    if (session !== undefined && (typeof session !== "string" || !/^[a-zA-Z0-9_-]{1,128}$/.test(session))) return res.status(400).json({ error: "Invalid session ID" });
    next();
  });
}

// Keep capacity reserved until asynchronous work settles, even if its client disconnects.
export function trackHandler(handler: RequestHandler): RequestHandler {
  return (req, res, next) => {
    res.locals.routeRunning = true;
    Promise.resolve().then(() => handler(req, res, next)).catch(next).finally(() => {
      res.locals.routeRunning = false;
      res.locals.releaseRequest?.();
    });
  };
}
