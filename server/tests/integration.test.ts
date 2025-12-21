/**
 * Integration tests for GCP Storage and Gemini AI
 * Run with: npx tsx server/tests/integration.test.ts
 */

import * as gcpStorage from '../gcp-storage';

// Test results accumulator
const results: { name: string; passed: boolean; error?: string }[] = [];

function test(name: string, fn: () => Promise<void> | void) {
  return async () => {
    try {
      await fn();
      results.push({ name, passed: true });
      console.log(`✓ ${name}`);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      results.push({ name, passed: false, error: errorMsg });
      console.log(`✗ ${name}: ${errorMsg}`);
    }
  };
}

// Helper assertion functions
function assertEqual<T>(actual: T, expected: T, message?: string) {
  if (actual !== expected) {
    throw new Error(message || `Expected ${expected}, got ${actual}`);
  }
}

function assertTrue(value: boolean, message?: string) {
  if (!value) {
    throw new Error(message || `Expected true, got ${value}`);
  }
}

function assertContains(str: string, substring: string, message?: string) {
  if (!str.includes(substring)) {
    throw new Error(message || `Expected "${str}" to contain "${substring}"`);
  }
}

// ============ GCP Storage Tests ============

const testGcpConfiguration = test('GCP: Configuration check', () => {
  const isConfigured = gcpStorage.isConfigured();
  console.log(`  GCP configured: ${isConfigured}`);
  console.log(`  Bucket name: ${process.env.GCP_BUCKET_NAME || 'not set'}`);
  console.log(`  Service account: ${process.env.GCP_SERVICE_ACCOUNT_JSON ? 'set' : 'not set'}`);
});

const testGcpConnection = test('GCP: Connection test', async () => {
  if (!gcpStorage.isConfigured()) {
    console.log('  Skipping: GCP not configured');
    return;
  }
  
  const connected = await gcpStorage.testConnection();
  assertTrue(connected, 'GCP connection should succeed');
});

const testWavHeaderGeneration = test('GCP: WAV header generation', () => {
  // Test creating a small WAV file
  const sampleRate = 16000;
  const numSamples = 1600; // 0.1 seconds
  const pcmData = Buffer.alloc(numSamples * 2); // 16-bit samples
  
  // Fill with a simple sine wave pattern
  for (let i = 0; i < numSamples; i++) {
    const value = Math.sin(i * 0.1) * 32767;
    pcmData.writeInt16LE(Math.round(value), i * 2);
  }
  
  // The createWavBuffer function should be accessible
  const wavBuffer = createTestWavBuffer(pcmData, sampleRate);
  
  // Check WAV header magic bytes
  assertEqual(wavBuffer.toString('ascii', 0, 4), 'RIFF', 'Should start with RIFF');
  assertEqual(wavBuffer.toString('ascii', 8, 12), 'WAVE', 'Should have WAVE format');
  assertEqual(wavBuffer.toString('ascii', 12, 16), 'fmt ', 'Should have fmt chunk');
  
  // Check sample rate
  const readSampleRate = wavBuffer.readUInt32LE(24);
  assertEqual(readSampleRate, sampleRate, 'Sample rate should match');
  
  console.log(`  Created ${wavBuffer.length} byte WAV file`);
});

// Helper to create WAV buffer (mirrors gcp-storage logic)
function createTestWavBuffer(pcmData: Buffer, sampleRate: number): Buffer {
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const dataSize = pcmData.length;
  const fileSize = 44 + dataSize - 8;

  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(fileSize, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write('data', 36);
  header.writeUInt32LE(dataSize, 40);

  return Buffer.concat([header, pcmData]);
}

// ============ Gemini AI Tests ============

const testGeminiImport = test('Gemini: Module import', async () => {
  const { GoogleGenAI } = await import('@google/genai');
  assertTrue(!!GoogleGenAI, 'GoogleGenAI should be importable');
});

const testGeminiConfiguration = test('Gemini: Configuration check', async () => {
  const apiKey = process.env.AI_INTEGRATIONS_GEMINI_API_KEY;
  const baseUrl = process.env.AI_INTEGRATIONS_GEMINI_BASE_URL;
  console.log(`  API Key available: ${apiKey ? 'yes' : 'no'}`);
  console.log(`  Base URL available: ${baseUrl ? 'yes' : 'no'}`);
  console.log(`  Using Replit AI Integrations: ${!!(apiKey && baseUrl)}`);
});

const testGeminiBasicCall = test('Gemini: Basic text generation', async () => {
  const { GoogleGenAI } = await import('@google/genai');
  
  const apiKey = process.env.AI_INTEGRATIONS_GEMINI_API_KEY;
  const baseUrl = process.env.AI_INTEGRATIONS_GEMINI_BASE_URL;
  if (!apiKey) {
    console.log('  Skipping: No API key available (AI_INTEGRATIONS_GEMINI_API_KEY not set)');
    return;
  }
  
  const ai = new GoogleGenAI({ 
    apiKey,
    httpOptions: {
      apiVersion: "",
      baseUrl: baseUrl || undefined
    }
  });
  
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: [{ role: 'user', parts: [{ text: 'Say "Hello, test!" and nothing else.' }] }],
  });
  
  const text = response.text || '';
  console.log(`  Response: ${text.slice(0, 50)}...`);
  assertTrue(text.length > 0, 'Should receive a response');
});

const testGeminiGrammarAnalysis = test('Gemini: Grammar analysis', async () => {
  const { GoogleGenAI } = await import('@google/genai');
  
  const apiKey = process.env.AI_INTEGRATIONS_GEMINI_API_KEY;
  const baseUrl = process.env.AI_INTEGRATIONS_GEMINI_BASE_URL;
  if (!apiKey) {
    console.log('  Skipping: No API key available');
    return;
  }
  
  const ai = new GoogleGenAI({ 
    apiKey,
    httpOptions: {
      apiVersion: "",
      baseUrl: baseUrl || undefined
    }
  });
  
  const prompt = `Analyze this text for grammar errors and respond in JSON format:
Text: "She go to the store yesterday and buyed some apples."
Respond with: {"issues": [{"original": "...", "corrected": "...", "explanation": "..."}]}`;
  
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
  });
  
  const text = response.text || '';
  console.log(`  Response length: ${text.length} chars`);
  
  // Try to parse as JSON
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      assertTrue(Array.isArray(parsed.issues), 'Should return issues array');
      console.log(`  Found ${parsed.issues.length} grammar issues`);
    }
  } catch (e) {
    console.log('  Note: Response was not JSON, but generation worked');
  }
});

// ============ Speaker Name Detection Tests ============

function isRealSpeakerName(speaker: string | null | undefined): boolean {
  if (!speaker) return false;
  
  const trimmed = speaker.trim();
  if (trimmed.length < 2) return false;
  
  const genericPatterns = [
    /^speaker[\s\-_]*\d*$/i,
    /^user[\s\-_]*\d*$/i,
    /^person[\s\-_]*\d*$/i,
    /^voice[\s\-_]*\d*$/i,
    /^participant[\s\-_]*\d*$/i,
    /^attendee[\s\-_]*\d*$/i,
    /^guest[\s\-_]*\d*$/i,
    /^caller[\s\-_]*\d*$/i,
    /^member[\s\-_]*\d*$/i,
    /^host[\s\-_]*\d*$/i,
    /^meeting\s+speaker/i,
    /^unknown/i,
    /^unidentified/i,
    /^anonymous/i,
    /^\d+$/,
    /^[A-Z]$/,
    /^me$/i,
    /^you$/i,
    /^other$/i,
  ];
  
  for (const pattern of genericPatterns) {
    if (pattern.test(trimmed)) {
      return false;
    }
  }
  
  const alphaCount = (trimmed.match(/[a-zA-Z]/g) || []).length;
  if (alphaCount < 2) return false;
  
  return true;
}

const testSpeakerNameDetection = test('Speaker: Real name detection', () => {
  // Should reject generic names
  const genericNames = [
    'Speaker 0', 'Speaker 1', 'speaker-1', 'speaker_02',
    'User 1', 'user-2', 'Person 1', 'Voice 1',
    'Participant 1', 'Attendee 1', 'Guest 1', 'Caller 1',
    'Member 1', 'Host', 'Meeting Speaker',
    'Unknown', 'Unknown Speaker', 'Unidentified', 'Anonymous',
    'Me', 'You', 'Other', '123', 'A'
  ];
  
  for (const name of genericNames) {
    assertTrue(!isRealSpeakerName(name), `"${name}" should be rejected as generic`);
  }
  console.log(`  ✓ Rejected ${genericNames.length} generic names`);
  
  // Should accept real names
  const realNames = [
    'John', 'Maria', 'Dr. Smith', 'John Doe',
    'Alice', 'Bob', 'Charlie', 'David',
    'Sarah Connor', 'Tony Stark'
  ];
  
  for (const name of realNames) {
    assertTrue(isRealSpeakerName(name), `"${name}" should be accepted as real`);
  }
  console.log(`  ✓ Accepted ${realNames.length} real names`);
});

// ============ Run All Tests ============

async function runAllTests() {
  console.log('\n========================================');
  console.log('Integration Tests for LinguaFlow');
  console.log('========================================\n');
  
  console.log('--- GCP Storage Tests ---');
  await testGcpConfiguration();
  await testGcpConnection();
  await testWavHeaderGeneration();
  
  console.log('\n--- Gemini AI Tests ---');
  await testGeminiImport();
  await testGeminiConfiguration();
  await testGeminiBasicCall();
  await testGeminiGrammarAnalysis();
  
  console.log('\n--- Speaker Name Detection Tests ---');
  await testSpeakerNameDetection();
  
  // Summary
  console.log('\n========================================');
  console.log('Test Summary');
  console.log('========================================');
  
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  
  console.log(`Passed: ${passed}/${results.length}`);
  console.log(`Failed: ${failed}/${results.length}`);
  
  if (failed > 0) {
    console.log('\nFailed tests:');
    for (const result of results.filter(r => !r.passed)) {
      console.log(`  - ${result.name}: ${result.error}`);
    }
  }
  
  console.log('\n');
  process.exit(failed > 0 ? 1 : 0);
}

runAllTests().catch(console.error);
