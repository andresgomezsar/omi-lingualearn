/**
 * End-to-end test for Omi integration
 * Simulates: audio chunks -> transcript -> memory with real name -> Gemini analysis
 * Run with: npx tsx server/tests/test-omi-e2e.ts
 */

const BASE_URL = 'http://localhost:5000';

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testOmiHub() {
  console.log('\n========================================');
  console.log('Omi Integration End-to-End Test');
  console.log('========================================\n');

  const userId = 'test-user-' + Date.now();
  const sessionId = 'test-session-' + Date.now();

  // Test 1: Send audio chunks (simulate ~5 seconds of audio)
  console.log('1. Sending audio chunks...');
  const sampleRate = 16000;
  const chunkDuration = 1; // 1 second per chunk
  const bytesPerChunk = sampleRate * 2 * chunkDuration; // 16-bit mono
  
  for (let i = 0; i < 5; i++) {
    // Generate fake PCM audio data (silence with some noise)
    const audioData = Buffer.alloc(bytesPerChunk);
    for (let j = 0; j < bytesPerChunk; j += 2) {
      audioData.writeInt16LE(Math.floor(Math.random() * 100) - 50, j);
    }
    
    const response = await fetch(
      `${BASE_URL}/api/omi/hub?uid=${userId}&session_id=${sessionId}&sample_rate=${sampleRate}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/octet-stream' },
        body: audioData,
      }
    );
    
    const result = await response.json();
    console.log(`   Chunk ${i + 1}/5: ${response.status} - ${JSON.stringify(result)}`);
    await sleep(100);
  }

  // Test 2: Send transcript with generic speaker name (should NOT trigger analysis)
  console.log('\n2. Sending transcript with generic speaker...');
  const genericTranscript = {
    segments: [
      { text: 'Hello, how are you today?', speaker: 'Speaker 1', is_user: true, start: 0, end: 2000 },
      { text: 'I am fine, thank you.', speaker: 'Speaker 2', is_user: false, start: 2000, end: 4000 },
    ]
  };
  
  let response = await fetch(
    `${BASE_URL}/api/omi/hub?uid=${userId}&session_id=${sessionId}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(genericTranscript),
    }
  );
  console.log(`   Response: ${response.status} - ${await response.text()}`);

  // Test 3: Send memory with generic speaker (should skip analysis)
  console.log('\n3. Sending memory with generic speaker (should skip analysis)...');
  const genericMemory = {
    id: 'memory-generic-' + Date.now(),
    transcript_segments: [
      { text: 'She go to store yesterday.', speaker: 'Speaker 0', is_user: true, start: 0, end: 3000 },
    ]
  };
  
  response = await fetch(
    `${BASE_URL}/api/omi/hub?uid=${userId}&session_id=${sessionId}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(genericMemory),
    }
  );
  console.log(`   Response: ${response.status} - ${await response.text()}`);

  // Test 4: Send memory with REAL speaker name (should trigger Gemini analysis)
  console.log('\n4. Sending memory with real speaker name (should trigger analysis)...');
  const realMemory = {
    id: 'memory-real-' + Date.now(),
    transcript_segments: [
      { text: 'I goed to the store yesterday and buyed some milk.', speaker: 'John Smith', is_user: true, start: 0, end: 4000 },
      { text: 'That sounds great! Did you find everything?', speaker: 'Maria', is_user: false, start: 4000, end: 7000 },
    ]
  };
  
  response = await fetch(
    `${BASE_URL}/api/omi/hub?uid=${userId}&session_id=${sessionId}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(realMemory),
    }
  );
  console.log(`   Response: ${response.status} - ${await response.text()}`);

  // Test 5: Check learning items were created
  console.log('\n5. Checking learning items...');
  await sleep(2000); // Wait for Gemini analysis
  
  response = await fetch(`${BASE_URL}/api/learning-items`);
  const items = await response.json();
  console.log(`   Found ${items.length} learning items`);
  
  if (items.length > 0) {
    console.log('\n   Recent learning items:');
    for (const item of items.slice(-3)) {
      console.log(`   - "${item.originalText}" -> "${item.correctedText}"`);
      console.log(`     (${item.category}: ${item.explanation?.slice(0, 50)}...)`);
    }
  }

  // Test 6: Check GCP status
  console.log('\n6. Checking GCP status...');
  response = await fetch(`${BASE_URL}/api/gcp/status`);
  const gcpStatus = await response.json();
  console.log(`   GCP configured: ${gcpStatus.configured}, connected: ${gcpStatus.connected}`);

  console.log('\n========================================');
  console.log('End-to-End Test Complete!');
  console.log('========================================\n');
}

testOmiHub().catch(console.error);
