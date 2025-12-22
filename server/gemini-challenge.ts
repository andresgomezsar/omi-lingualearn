import { GoogleGenAI } from "@google/genai";
import type { UserFact, VoiceChallenge } from "@shared/schema";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  console.warn("GEMINI_API_KEY not found - challenge generation will not work");
}

const genAI = GEMINI_API_KEY ? new GoogleGenAI({ apiKey: GEMINI_API_KEY }) : null;

const LANGUAGE_GOALS = [
  "natural idiomatic expressions",
  "colloquial phrases and slang",
  "cultural context and appropriateness",
  "conversational flow and naturalness",
  "past tense conjugation with idiomatic verbs",
  "subjunctive mood in everyday speech",
  "conditional sentences in natural contexts",
  "vocabulary expansion (synonyms and variations)",
  "prepositions in idiomatic phrases",
  "reflexive verbs in common expressions",
];

interface GeneratedPrompt {
  prompt: string;
  languageGoal: string;
  difficulty: "beginner" | "intermediate" | "advanced";
}

interface ChallengeFeedback {
  grammarScore: number;
  vocabularyScore: number;
  pronunciationScore: number;
  overallScore: number;
  corrections: {
    original: string;
    corrected: string;
    explanation: string;
    category: string;
  }[];
  positives: string[];
  suggestions: string[];
  summary: string;
}

export async function generateChallengePrompt(
  userFact: UserFact,
  targetLanguage: string = "Spanish"
): Promise<GeneratedPrompt> {
  if (!genAI) {
    return {
      prompt: `Describe your experience: "${userFact.content}". Try to use descriptive language and express your feelings about it.`,
      languageGoal: "descriptive adjectives",
      difficulty: "intermediate",
    };
  }

  const languageGoal = LANGUAGE_GOALS[Math.floor(Math.random() * LANGUAGE_GOALS.length)];

  const systemPrompt = `You are a native ${targetLanguage}-speaking language coach. Generate a personalized speaking challenge based on a user's memory or fact about themselves.

The challenge should:
1. Reference the user's personal fact to make it engaging and relatable
2. Focus on: ${languageGoal}
3. Encourage NATURAL, IDIOMATIC speech - not just grammatically correct but how natives actually speak
4. Be a conversational prompt that encourages 30-60 seconds of natural speaking
5. Include specific idiomatic phrases or expressions the user should try to use
6. Be warm, encouraging, and culturally authentic

IMPORTANT: The goal is to sound like a native speaker, not a textbook. Prioritize naturalness over formal correctness.

Respond with JSON only:
{
  "prompt": "Your challenge prompt here (in ${targetLanguage})",
  "languageGoal": "${languageGoal}",
  "difficulty": "intermediate"
}`;

  try {
    const response = await genAI.models.generateContent({
      model: "gemini-2.0-flash",
      contents: `User fact: "${userFact.content}"
Target language: ${targetLanguage}
Language goal: ${languageGoal}

Generate a personalized speaking challenge.`,
      config: {
        systemInstruction: systemPrompt,
        temperature: 0.8,
        maxOutputTokens: 2000,  // Allow more detailed, creative challenge prompts
      },
    });

    const text = response.text?.trim() || "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        prompt: parsed.prompt || `Tell me about: ${userFact.content}`,
        languageGoal: parsed.languageGoal || languageGoal,
        difficulty: parsed.difficulty || "intermediate",
      };
    }
  } catch (error) {
    console.error("Error generating challenge prompt:", error);
  }

  return {
    prompt: `Tell me about "${userFact.content}". Try to use ${languageGoal} in your response. Speak naturally and express your thoughts!`,
    languageGoal,
    difficulty: "intermediate",
  };
}

export async function analyzeChallengeResponse(
  challenge: VoiceChallenge,
  transcript: string,
  audioUris?: string | string[]
): Promise<ChallengeFeedback> {
  if (!genAI) {
    return {
      grammarScore: 75,
      vocabularyScore: 70,
      pronunciationScore: 80,
      overallScore: 75,
      corrections: [],
      positives: ["Good effort!"],
      suggestions: ["Keep practicing!"],
      summary: "Analysis unavailable - Gemini not configured.",
    };
  }

  const systemPrompt = `You are a native ${challenge.targetLanguage || "Spanish"}-speaking language coach analyzing a learner's spoken response.

Challenge prompt: "${challenge.prompt}"
Language goal: ${challenge.languageGoal || "natural idiomatic expressions"}
Target language: ${challenge.targetLanguage || "Spanish"}

EVALUATION CRITERIA:
1. Grammar (0-100): Structural correctness
2. Vocabulary (0-100): Word choice and range
3. Pronunciation (0-100): Clarity, intonation, rhythm (estimate from transcript patterns)
4. **IDIOMATIC NATURALNESS (0-100)**: Does it sound like a native speaker? This is MOST IMPORTANT.

FOCUS ON:
- Does the response use natural, idiomatic expressions or sound "textbook"?
- Are phrases culturally appropriate and contextually natural?
- Does it flow conversationally or sound translated?
- Are there better idiomatic alternatives to what they said?

PROVIDE:
- Specific corrections that make speech more natural and idiomatic
- Idiomatic alternatives to any "textbook" phrases
- Cultural notes on natural usage
- Encouraging positive feedback on what sounds natural
- Concrete suggestions with example idiomatic phrases

Be warm and encouraging but prioritize naturalness over formal correctness.

Respond with JSON only:
{
  "grammarScore": 85,
  "vocabularyScore": 80,
  "pronunciationScore": 75,
  "overallScore": 80,
  "corrections": [
    {
      "original": "textbook phrase",
      "corrected": "natural idiomatic version",
      "explanation": "natives would say it this way because...",
      "category": "idiomatic"
    }
  ],
  "positives": ["You used 'X' naturally!", "Great idiomatic expression: 'Y'"],
  "suggestions": ["Instead of 'X', try the more natural 'Y'", "Natives often say 'Z' in this context"],
  "summary": "Brief feedback focusing on naturalness"
}`;

  try {
    // Prepare content parts - start with transcript
    const contentParts: any[] = [
      {
        text: `Student's response transcript:
"${transcript}"

Analyze this response for the language learning challenge.`
      }
    ];

    // If audio URIs provided, download and include audio data for pronunciation analysis
    if (audioUris) {
      const uriArray = Array.isArray(audioUris) ? audioUris : [audioUris];

      console.log(`Analyzing ${uriArray.length} audio file(s) for pronunciation...`);

      // Import GCP storage functions
      const { downloadAudioChunk } = await import("./gcp-storage");

      // Download each audio file and add to content
      for (const uri of uriArray) {
        try {
          console.log(`Downloading audio: ${uri}`);
          const audioData = await downloadAudioChunk(uri);

          // Add audio to Gemini multimodal input
          contentParts.push({
            inlineData: {
              mimeType: "audio/wav",
              data: audioData.toString('base64')
            }
          });
        } catch (audioError) {
          console.error(`Failed to download audio ${uri}:`, audioError);
        }
      }

      // Add note about audio analysis
      if (contentParts.length > 1) {
        contentParts.push({
          text: "\n\nAudio file(s) provided above. Use them to evaluate ACTUAL pronunciation, intonation, rhythm, and fluency. Give precise pronunciation feedback based on the audio."
        });
      }
    }

    const response = await genAI.models.generateContent({
      model: "gemini-2.0-flash-exp",  // Use experimental model for audio support
      contents: contentParts,
      config: {
        systemInstruction: systemPrompt,
        temperature: 0.3,
        maxOutputTokens: 16000,  // Increased for detailed audio analysis with pronunciation feedback
      },
    });

    const text = response.text?.trim() || "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        grammarScore: parsed.grammarScore ?? 70,
        vocabularyScore: parsed.vocabularyScore ?? 70,
        pronunciationScore: parsed.pronunciationScore ?? 75,
        overallScore: parsed.overallScore ?? 72,
        corrections: parsed.corrections || [],
        positives: parsed.positives || ["Good effort!"],
        suggestions: parsed.suggestions || ["Keep practicing!"],
        summary: parsed.summary || "Analysis complete.",
      };
    }
  } catch (error) {
    console.error("Error analyzing challenge response:", error);
  }

  return {
    grammarScore: 70,
    vocabularyScore: 70,
    pronunciationScore: 75,
    overallScore: 72,
    corrections: [],
    positives: ["Thank you for completing this challenge!"],
    suggestions: ["Keep practicing regularly for best results."],
    summary: "Your response has been recorded. Keep up the good work!",
  };
}

export function isGeminiConfigured(): boolean {
  return !!genAI;
}
