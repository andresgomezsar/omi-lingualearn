import { Storage } from "@google-cloud/storage";

let storage: Storage | null = null;
let bucketName: string | null = null;

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
 * Upload compiled WAV file to GCP bucket with timestamp-based filename
 * Path format: {userId}/compiled/{startTimestamp}_{endTimestamp}.wav
 */
export async function uploadCompiledWav(
  userId: string,
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
  
  // Use timestamps for filename
  const startMs = startTimestamp.getTime();
  const endMs = endTimestamp.getTime();
  const filePath = `${userId}/compiled/${startMs}_${endMs}.wav`;
  const file = bucket.file(filePath);
  
  await file.save(wavData, {
    contentType: "audio/wav",
    metadata: {
      userId,
      startTimestamp: startTimestamp.toISOString(),
      endTimestamp: endTimestamp.toISOString(),
      sampleRate: sampleRate.toString(),
      durationMs: (endMs - startMs).toString(),
    },
  });

  const gcpUri = `gs://${getBucketName()}/${filePath}`;
  console.log(`Uploaded compiled WAV to ${gcpUri} (${wavData.length} bytes)`);
  return { gcpUri, fileSize: wavData.length };
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
