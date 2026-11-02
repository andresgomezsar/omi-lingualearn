import { Storage } from "@google-cloud/storage";
import { createHash } from "crypto";

let storage: Storage | null = null;
let bucketName: string | null = null;

/**
 * Generate a consistent folder identifier from Omi UID
 * Uses SHA-256 hash to create a privacy-preserving but consistent ID
 * Takes first 16 characters for a shorter, cleaner folder name
 */
export function generateFolderIdFromOmiUid(omiUid: string): string {
  const hash = createHash('sha256').update(omiUid).digest('hex');
  // Use first 16 chars of hash for shorter folder names
  return hash.substring(0, 16);
}

/**
 * Create a WAV header for PCM16 audio data
 * @param dataLength - Length of the PCM data in bytes
 * @param sampleRate - Sample rate in Hz (default 16000)
 * @param numChannels - Number of channels (default 1 for mono)
 * @param bitsPerSample - Bits per sample (default 16)
 */
export function createWavHeader(
  dataLength: number,
  sampleRate: number = 16000,
  numChannels: number = 1,
  bitsPerSample: number = 16
): Buffer {
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const fileSize = 36 + dataLength;
  
  const header = Buffer.alloc(44);
  
  // RIFF chunk
  header.write('RIFF', 0);
  header.writeUInt32LE(fileSize, 4);
  header.write('WAVE', 8);
  
  // fmt subchunk
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16); // Subchunk1Size for PCM
  header.writeUInt16LE(1, 20); // AudioFormat: PCM = 1
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  
  // data subchunk
  header.write('data', 36);
  header.writeUInt32LE(dataLength, 40);
  
  return header;
}

function getStorage(): Storage {
  if (!storage) {
    const serviceAccountJson = process.env.GCP_SERVICE_ACCOUNT_JSON;
    if (!serviceAccountJson) {
      throw new Error("GCP_SERVICE_ACCOUNT_JSON environment variable is not set");
    }

    try {
      const credentials = JSON.parse(serviceAccountJson);
      storage = new Storage({
        credentials,
        projectId: credentials.project_id,
      });
    } catch (error) {
      throw new Error("Invalid GCP service account configuration");
    }
  }
  return storage;
}

function getBucketName(): string {
  if (!bucketName) {
    const envBucket = process.env.GCP_BUCKET_NAME;
    if (!envBucket) {
      throw new Error("GCP_BUCKET_NAME environment variable is not set");
    }
    bucketName = envBucket;
  }
  return bucketName;
}

/**
 * Upload audio chunk to GCP bucket
 * Path format: {hashedOmiUid}/{sessionId}/chunks/{timestamp}_{index}.pcm
 */
export async function uploadAudioChunk(
  omiUid: string,
  sessionId: string,
  audioData: Buffer,
  timestamp: number,
  chunkIndex: number
): Promise<string> {
  const storage = getStorage();
  const bucket = storage.bucket(getBucketName());

  const folderId = generateFolderIdFromOmiUid(omiUid);
  const filePath = `${folderId}/${sessionId}/chunks/${timestamp}_${chunkIndex}.pcm`;
  const file = bucket.file(filePath);

  await file.save(audioData, {
    contentType: "audio/pcm",
    metadata: {
      folderId,
      sessionId,
      timestamp: timestamp.toString(),
      chunkIndex: chunkIndex.toString(),
    },
  });

  const gcpUri = `gs://${getBucketName()}/${filePath}`;
  /* Private payloads are not logged. */
  return gcpUri;
}

/**
 * Upload compiled WAV file to GCP bucket with timestamp-based filename
 * Path format: {hashedOmiUid}/compiled/{startTimestamp}_{endTimestamp}.wav
 */
export async function uploadCompiledWav(
  omiUid: string,
  pcmData: Buffer,
  sampleRate: number,
  startTimestamp: Date,
  endTimestamp: Date
): Promise<{ gcpUri: string; fileSize: number }> {
  const storage = getStorage();
  const bucket = storage.bucket(getBucketName());

  // Create WAV header and combine with PCM data
  const wavHeader = createWavHeader(pcmData.length, sampleRate);
  const wavData = Buffer.concat([wavHeader, pcmData]);

  // Use hashed Omi UID for folder and timestamps for filename
  const folderId = generateFolderIdFromOmiUid(omiUid);
  const startMs = startTimestamp.getTime();
  const endMs = endTimestamp.getTime();
  const filePath = `${folderId}/compiled/${startMs}_${endMs}.wav`;
  const file = bucket.file(filePath);

  await file.save(wavData, {
    contentType: "audio/wav",
    metadata: {
      folderId,
      startTimestamp: startTimestamp.toISOString(),
      endTimestamp: endTimestamp.toISOString(),
      sampleRate: sampleRate.toString(),
      durationMs: (endMs - startMs).toString(),
    },
  });

  const gcpUri = `gs://${getBucketName()}/${filePath}`;
  /* Private payloads are not logged. */
  return { gcpUri, fileSize: wavData.length };
}

/**
 * Download audio chunk from GCP bucket
 */
export function authorizedObjectPath(uri: string): string {
  const uid = process.env.OMI_UID;
  if (!uid || !process.env.GCP_BUCKET_NAME || typeof uri !== "string") throw new Error("Audio identity is not configured");
  const prefix = `gs://${process.env.GCP_BUCKET_NAME}/${generateFolderIdFromOmiUid(uid)}/`;
  if (!uri.startsWith(prefix)) throw new Error("Audio object outside configured account");
  const path = uri.slice(`gs://${process.env.GCP_BUCKET_NAME}/`.length);
  if (!/^[a-zA-Z0-9_./-]+$/.test(path) || path.split("/").some(part => !part || part === "." || part === "..")) throw new Error("Invalid object path");
  return path;
}

export async function downloadAudioChunk(gcpUri: string): Promise<Buffer> {
  const path = authorizedObjectPath(gcpUri);
  const stream = getStorage().bucket(getBucketName()).file(path).createReadStream();
  const chunks: Buffer[] = [];
  let bytes = 0;
  try {
    for await (const chunk of stream) {
      bytes += chunk.length;
      if (bytes > 6 * 1024 * 1024) throw new Error("Audio object exceeds 6 MiB");
      chunks.push(Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  } finally { stream.destroy(); }
}

/**
 * List audio chunks for a session
 */
export async function listAudioChunks(
  omiUid: string,
  sessionId: string
): Promise<string[]> {
  const storage = getStorage();
  const bucket = storage.bucket(getBucketName());

  const folderId = generateFolderIdFromOmiUid(omiUid);
  const prefix = `${folderId}/${sessionId}/chunks/`;
  const [files] = await bucket.getFiles({ prefix, maxResults: 100, autoPaginate: false });

  return files.map(file => `gs://${getBucketName()}/${file.name}`);
}

/**
 * Generate a signed URL for audio file access (valid for 1 hour)
 */
export async function getSignedUrl(gcpUri: string): Promise<string> {
  const path = authorizedObjectPath(gcpUri);
  const file = getStorage().bucket(getBucketName()).file(path);

  const [url] = await file.getSignedUrl({
    version: "v4",
    action: "read",
    expires: Date.now() + 60 * 60 * 1000, // 1 hour
  });
  
  return url;
}

/**
 * Check if GCP storage is properly configured
 */
/**
 * Get compiled audio files for a user within a time range
 * Used for finding audio files that correspond to a challenge response
 */
export async function getCompiledAudioInTimeRange(omiUid: string, startTime: Date, endTime: Date): Promise<string[]> {
  if (omiUid !== process.env.OMI_UID) throw new Error("Account mismatch");
  const { storage: metadata } = await import("./storage");
  const user = await metadata.getUserByOmiUid(omiUid);
  if (!user) return [];
  const files = await metadata.getCompiledAudioFilesInRange(user.id, startTime, endTime);
  if (files.length > 8) throw new Error("Too many audio files in range");
  for (const file of files) authorizedObjectPath(file.gcpUri);
  return files.map(file => file.gcpUri);
}

export function isConfigured(): boolean {
  try {
    return !!process.env.GCP_SERVICE_ACCOUNT_JSON && !!process.env.GCP_BUCKET_NAME;
  } catch {
    return false;
  }
}

/**
 * Test GCP connection by listing bucket contents
 */
export async function testConnection(): Promise<boolean> {
  try {
    const storage = getStorage();
    const bucket = storage.bucket(getBucketName());
    await bucket.getFiles({ maxResults: 1 });
    return true;
  } catch (error) {
    /* Private payloads are not logged. */
    return false;
  }
}
