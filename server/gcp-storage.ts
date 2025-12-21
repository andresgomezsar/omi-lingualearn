import { Storage } from "@google-cloud/storage";

let storage: Storage | null = null;
let bucketName: string | null = null;

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
      throw new Error("Failed to parse GCP_SERVICE_ACCOUNT_JSON: " + error);
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
 * Path format: {userId}/{sessionId}/chunks/{timestamp}_{index}.pcm
 */
export async function uploadAudioChunk(
  userId: string,
  sessionId: string,
  audioData: Buffer,
  timestamp: number,
  chunkIndex: number
): Promise<string> {
  const storage = getStorage();
  const bucket = storage.bucket(getBucketName());
  
  const filePath = `${userId}/${sessionId}/chunks/${timestamp}_${chunkIndex}.pcm`;
  const file = bucket.file(filePath);
  
  await file.save(audioData, {
    contentType: "audio/pcm",
    metadata: {
      userId,
      sessionId,
      timestamp: timestamp.toString(),
      chunkIndex: chunkIndex.toString(),
    },
  });

  const gcpUri = `gs://${getBucketName()}/${filePath}`;
  console.log(`Uploaded audio chunk to ${gcpUri}`);
  return gcpUri;
}

/**
 * Upload compiled audio file to GCP bucket
 * Path format: {userId}/{sessionId}/compiled.wav
 */
export async function uploadCompiledAudio(
  userId: string,
  sessionId: string,
  audioData: Buffer
): Promise<string> {
  const storage = getStorage();
  const bucket = storage.bucket(getBucketName());
  
  const filePath = `${userId}/${sessionId}/compiled.wav`;
  const file = bucket.file(filePath);
  
  await file.save(audioData, {
    contentType: "audio/wav",
    metadata: {
      userId,
      sessionId,
      compiledAt: new Date().toISOString(),
    },
  });

  const gcpUri = `gs://${getBucketName()}/${filePath}`;
  console.log(`Uploaded compiled audio to ${gcpUri}`);
  return gcpUri;
}

/**
 * Download audio chunk from GCP bucket
 */
export async function downloadAudioChunk(gcpUri: string): Promise<Buffer> {
  const storage = getStorage();
  
  // Parse gs:// URI
  const match = gcpUri.match(/^gs:\/\/([^/]+)\/(.+)$/);
  if (!match) {
    throw new Error(`Invalid GCP URI: ${gcpUri}`);
  }
  
  const [, bucketNameFromUri, filePath] = match;
  const bucket = storage.bucket(bucketNameFromUri);
  const file = bucket.file(filePath);
  
  const [contents] = await file.download();
  return contents;
}

/**
 * List audio chunks for a session
 */
export async function listAudioChunks(
  userId: string,
  sessionId: string
): Promise<string[]> {
  const storage = getStorage();
  const bucket = storage.bucket(getBucketName());
  
  const prefix = `${userId}/${sessionId}/chunks/`;
  const [files] = await bucket.getFiles({ prefix });
  
  return files.map(file => `gs://${getBucketName()}/${file.name}`);
}

/**
 * Generate a signed URL for audio file access (valid for 1 hour)
 */
export async function getSignedUrl(gcpUri: string): Promise<string> {
  const storage = getStorage();
  
  const match = gcpUri.match(/^gs:\/\/([^/]+)\/(.+)$/);
  if (!match) {
    throw new Error(`Invalid GCP URI: ${gcpUri}`);
  }
  
  const [, bucketNameFromUri, filePath] = match;
  const bucket = storage.bucket(bucketNameFromUri);
  const file = bucket.file(filePath);
  
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
    console.error("GCP connection test failed:", error);
    return false;
  }
}
