import { GoogleGenAI } from "@google/genai";
import type { UserFact, VoiceChallenge } from "@shared/schema";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  console.warn("GEMINI_API_KEY not found - challenge generation will not work");
}

const genAI = GEMINI_API_KEY ? new GoogleGenAI({ apiKey: GEMINI_API_KEY }) : null;

const LANGUAGE_GOALS = [
  "past tense conjugation",
  "present perfect tense",
  "subjunctive mood",
  "conditional sentences",
  "vocabulary expansion",
  "idiomatic expressions",
  "descriptive adjectives",
  "preposition usage",
  "reflexive verbs",
  "comparatives and superlatives",
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

  const systemPrompt = `You are a language learning coach. Generate a personalized speaking challenge based on a user's memory or fact about themselves.

The challenge should:
1. Reference the user's personal fact to make it engaging
2. Include a specific language learning goal: ${languageGoal}
3. Be a reflective/journal-style prompt that encourages speaking for 30-60 seconds
4. Be friendly and encouraging

Respond with JSON only:
{
  "prompt": "Your challenge prompt here",
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
        maxOutputTokens: 500,
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
  audioUri?: string
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

  const systemPrompt = `You are a language learning coach analyzing a student's spoken response to a practice challenge.

Challenge prompt: "${challenge.prompt}"
Language goal: ${challenge.languageGoal || "general fluency"}
Target language: ${challenge.targetLanguage || "Spanish"}

Analyze the transcript for:
1. Grammar accuracy (0-100)
2. Vocabulary usage (0-100)
3. Overall performance (0-100)
4. Specific corrections with explanations
5. Positive feedback
6. Suggestions for improvement

Be encouraging but honest. Focus on the language goal.

Respond with JSON only:
{
  "grammarScore": 85,
  "vocabularyScore": 80,
  "pronunciationScore": 75,
  "overallScore": 80,
  "corrections": [
    {"original": "wrong phrase", "corrected": "correct phrase", "explanation": "why", "category": "grammar"}
  ],
  "positives": ["Good use of past tense!", "Nice vocabulary!"],
  "suggestions": ["Practice more with...", "Try using..."],
  "summary": "Brief overall feedback"
}`;

  try {
    const response = await genAI.models.generateContent({
      model: "gemini-2.0-flash",
      contents: `Student's response transcript:
"${transcript}"

Analyze this response for the language learning challenge.`,
      config: {
        systemInstruction: systemPrompt,
        temperature: 0.3,
        maxOutputTokens: 1000,
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
