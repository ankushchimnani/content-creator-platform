import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { env } from '../lib/env';

export type CriteriaScores = {
  relevance: number;
  continuity: number;
  documentation: number;
};

export type AssignmentContext = {
  topic: string;
  prerequisiteTopics: string[];
  guidelines?: string | undefined;
};

export type ValidationOutput = {
  provider: 'openai' | 'gemini' | 'stub';
  scores: CriteriaScores;
  feedback: {
    relevance: string;
    continuity: string;
    documentation: string;
  };
};

function clamp(n: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, n));
}

function buildPrompt(content: string, brief?: string, assignmentContext?: AssignmentContext) {
  let prompt = `You are a content validation engine. Analyze the given markdown content and return strict JSON with numeric scores 0-100 for criteria: relevance, continuity, documentation, and short feedback strings.`;

  if (assignmentContext) {
    prompt += `\n\n=== ASSIGNMENT CONTEXT ===`;
    prompt += `\nRequired Topic: ${assignmentContext.topic}`;
    
    if (assignmentContext.prerequisiteTopics.length > 0) {
      prompt += `\nPrerequisite Topics (should be referenced/built upon): ${assignmentContext.prerequisiteTopics.join(', ')}`;
    }
    
    if (assignmentContext.guidelines) {
      prompt += `\nSpecific Guidelines: ${assignmentContext.guidelines}`;
    }
    
    prompt += `\n\n=== VALIDATION CRITERIA ===`;
    prompt += `\n• RELEVANCE (0-100): How well does the content address the required topic "${assignmentContext.topic}"? Does it stay on topic and cover the subject comprehensively?`;
    prompt += `\n• CONTINUITY (0-100): How well does the content build upon the prerequisite topics${assignmentContext.prerequisiteTopics.length > 0 ? ` (${assignmentContext.prerequisiteTopics.join(', ')})` : ''}? Is there logical flow and proper progression from known concepts?`;
    prompt += `\n• DOCUMENTATION (0-100): How well does the content follow the specific guidelines${assignmentContext.guidelines ? ' provided' : ' and general best practices'}? Is it well-structured, clear, and properly formatted?`;
  } else {
    prompt += `\n\n=== VALIDATION CRITERIA ===`;
    prompt += `\n• RELEVANCE (0-100): How relevant and focused is the content?`;
    prompt += `\n• CONTINUITY (0-100): How well does the content flow and maintain logical progression?`;
    prompt += `\n• DOCUMENTATION (0-100): How well is the content structured and documented?`;
  }

  prompt += `\n\nBrief (optional): ${brief ?? 'N/A'}`;
  prompt += `\n\nContent to validate:\n${content}`;
  prompt += `\n\nReturn JSON only with keys: relevance, continuity, documentation, feedback: {relevance, continuity, documentation}.`;
  
  return prompt;
}

export async function runOpenAIValidation(content: string, brief?: string, assignmentContext?: AssignmentContext): Promise<ValidationOutput> {
  if (!env.openaiApiKey) throw new Error('OPENAI_API_KEY missing');
  const client = new OpenAI({ apiKey: env.openaiApiKey });
  const prompt = buildPrompt(content, brief, assignmentContext);
  const res = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0,
    response_format: { type: 'json_object' as any },
  });
  const text = res.choices[0]?.message?.content ?? '{}';
  const parsed = JSON.parse(text as string);
  return {
    provider: 'openai',
    scores: {
      relevance: clamp(Number(parsed.relevance) || 0),
      continuity: clamp(Number(parsed.continuity) || 0),
      documentation: clamp(Number(parsed.documentation) || 0),
    },
    feedback: {
      relevance: String(parsed.feedback?.relevance ?? ''),
      continuity: String(parsed.feedback?.continuity ?? ''),
      documentation: String(parsed.feedback?.documentation ?? ''),
    },
  };
}

export async function runGeminiValidation(content: string, brief?: string, assignmentContext?: AssignmentContext): Promise<ValidationOutput> {
  if (!env.geminiApiKey) throw new Error('GEMINI_API_KEY missing');
  const genAI = new GoogleGenerativeAI(env.geminiApiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
  const prompt = buildPrompt(content, brief, assignmentContext);
  const res = await model.generateContent(prompt);
  const text = res.response.text();
  const parsed = JSON.parse(text);
  return {
    provider: 'gemini',
    scores: {
      relevance: clamp(Number(parsed.relevance) || 0),
      continuity: clamp(Number(parsed.continuity) || 0),
      documentation: clamp(Number(parsed.documentation) || 0),
    },
    feedback: {
      relevance: String(parsed.feedback?.relevance ?? ''),
      continuity: String(parsed.feedback?.continuity ?? ''),
      documentation: String(parsed.feedback?.documentation ?? ''),
    },
  };
}

export async function runStub(content: string, brief?: string, assignmentContext?: AssignmentContext): Promise<ValidationOutput> {
  const length = content.length;
  const relevance = clamp(Math.round((brief ? 80 : 70) + (length % 20) - 10), 50, 100);
  const continuity = clamp(Math.round(65 + (length % 30) - 10), 50, 100);
  const documentation = clamp(Math.round(75 + (length % 25) - 10), 50, 100);
  return {
    provider: 'stub',
    scores: { relevance, continuity, documentation },
    feedback: { relevance: 'Stub', continuity: 'Stub', documentation: 'Stub' },
  };
}

export async function runDualValidation(content: string, brief?: string, assignmentContext?: AssignmentContext) {
  const jobs: Promise<ValidationOutput>[] = [];
  if (env.openaiApiKey) jobs.push(runOpenAIValidation(content, brief, assignmentContext));
  if (env.geminiApiKey) jobs.push(runGeminiValidation(content, brief, assignmentContext));
  if (jobs.length === 0) jobs.push(runStub(content, brief, assignmentContext));

  const results = await Promise.allSettled(jobs);
  const successes = results.filter((r): r is PromiseFulfilledResult<ValidationOutput> => r.status === 'fulfilled').map(r => r.value);
  if (successes.length === 0) {
    const fallback = await runStub(content, brief, assignmentContext);
    successes.push(fallback);
  }

  // Consensus: average scores; providers length indicates how many contributed
  const sum = successes.reduce(
    (acc, r) => {
      acc.relevance += r.scores.relevance;
      acc.continuity += r.scores.continuity;
      acc.documentation += r.scores.documentation;
      return acc;
    },
    { relevance: 0, continuity: 0, documentation: 0 }
  );

  const n = successes.length;
  const consensus: CriteriaScores = {
    relevance: Math.round(sum.relevance / n),
    continuity: Math.round(sum.continuity / n),
    documentation: Math.round(sum.documentation / n),
  };

  const overall = Math.round((consensus.relevance + consensus.continuity + consensus.documentation) / 3);

  // Agreement/confidence: inverse of standard deviation normalized to 0-1
  const relVals = successes.map(s => s.scores.relevance);
  const conVals = successes.map(s => s.scores.continuity);
  const docVals = successes.map(s => s.scores.documentation);

  const std = (vals: number[]) => {
    if (vals.length <= 1) return 0;
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
    const variance = vals.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / vals.length;
    return Math.sqrt(variance);
  };

  const normalize = (s: number) => clamp(1 - s / 50, 0, 1); // 50-pt std dev -> 0 confidence
  const confidence = {
    relevance: normalize(std(relVals)),
    continuity: normalize(std(conVals)),
    documentation: normalize(std(docVals)),
  };
  const overallConfidence = Math.round(((confidence.relevance + confidence.continuity + confidence.documentation) / 3) * 100) / 100;

  return { successes, consensus, overall, confidence, overallConfidence };
}


