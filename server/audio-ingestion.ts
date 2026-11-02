import type { Request, Response } from "express";
import { requestUserId, MAX_AUDIO_BYTES } from "./security";
import { storage } from "./storage";
import * as gcp from "./gcp-storage";

interface Pending { data: Buffer; sampleRate: number; start: Date; touched: number }
export class AudioPool {
  private entries = new Map<string, Pending>();
  private timers = new Map<string, ReturnType<typeof setTimeout>>();
  constructor(private ttlMs = 300_000) {}
  private remove(key: string) {
    this.entries.delete(key);
    clearTimeout(this.timers.get(key)); this.timers.delete(key);
  }
  private retain(key: string, pending: Pending) {
    this.remove(key);
    this.entries.set(key, pending);
    const timer = setTimeout(() => this.remove(key), this.ttlMs);
    timer.unref(); this.timers.set(key, timer);
  }
  add(key: string, data: Buffer, sampleRate: number, now = Date.now()) {
    for (const [id, pending] of this.entries) if (now - pending.touched >= this.ttlMs) this.remove(id);
    const previous = this.entries.get(key);
    if (!previous && this.entries.size >= 8) throw new Error("Too many pending sessions");
    if (previous && previous.sampleRate !== sampleRate) throw new Error("Sample rate changed within session");
    const total = [...this.entries.values()].reduce((n, p) => n + p.data.length, 0);
    const threshold = sampleRate * 2 * 60;
    if (total + data.length > 16 * 1024 * 1024 || (previous?.data.length || 0) + data.length > threshold + MAX_AUDIO_BYTES) throw new Error("Pending audio limit reached");
    const combined = Buffer.concat([previous?.data || Buffer.alloc(0), data]);
    const start = previous?.start || new Date(now);
    this.retain(key, { data: combined, sampleRate, start, touched: now });
    if (combined.length < threshold) return null;
    // Retain the batch until upload succeeds; per-session ingestion is serialized below.
    return { data: Buffer.from(combined.subarray(0, threshold)), start, end: new Date(start.getTime() + 60_000) };
  }
  commit(key: string, batch: { data: Buffer; start: Date; end: Date }) {
    const pending = this.entries.get(key);
    if (!pending || pending.start.getTime() !== batch.start.getTime()) return;
    const tail = Buffer.from(pending.data.subarray(batch.data.length));
    this.remove(key);
    if (tail.length) this.retain(key, { ...pending, data: tail, start: batch.end });
  }
  clear() { for (const key of this.entries.keys()) this.remove(key); }
  get size() { return this.entries.size; }
}
export const audioPool = new AudioPool();
const busy = new Set<string>();
export async function ingestAudio(req: Request, res: Response) {
  const userId = requestUserId(req);
  const uid = process.env.OMI_UID!;
  const sessionId = String(req.query.session_id || "default");
  const sampleRate = Number(req.query.sample_rate || 16000);
  const data = req.body;
  if (![8000, 16000, 24000, 48000].includes(sampleRate) || !Buffer.isBuffer(data) || !data.length || data.length % 2 || data.length > MAX_AUDIO_BYTES) return res.status(400).json({ error: "Expected bounded PCM16 mono audio and a supported sample rate" });
  if (!gcp.isConfigured()) return res.status(503).json({ error: "Audio storage is not configured" });
  const key = `${userId}:${sessionId}`;
  if (busy.size >= 4 || busy.has(key)) return res.status(429).json({ error: "Session upload in progress" });
  busy.add(key);
  try {
    if (req.path === "/api/omi/webhook/audio") {
      const existing = (await storage.getAudioChunks(sessionId)).filter(c => c.userId === userId);
      if (existing.length >= 8) return res.status(413).json({ error: "Session chunk limit reached" });
      const durationMs = Math.round(data.length / 2 / sampleRate * 1000);
      const gcpUri = await gcp.uploadAudioChunk(uid, sessionId, data, Date.now(), existing.length);
      const startMs = existing.at(-1)?.endMs || 0;
      await storage.createAudioChunk({ userId, sessionId, gcpUri, chunkIndex: existing.length, startMs, endMs: startMs + durationMs, sampleRate, durationMs });
    } else {
      let batch;
      try { batch = audioPool.add(key, data, sampleRate); }
      catch { return res.status(429).json({ error: "Audio buffer limit or sample rate conflict" }); }
      if (batch) {
        const { gcpUri, fileSize } = await gcp.uploadCompiledWav(uid, batch.data, sampleRate, batch.start, batch.end);
        await storage.createCompiledAudioFile({ userId, gcpUri, startTimestamp: batch.start, endTimestamp: batch.end, durationMs: 60_000, sampleRate, fileSize });
        audioPool.commit(key, batch);
      }
    }
    return res.json({ status: "ok" });
  } finally { busy.delete(key); }
}
