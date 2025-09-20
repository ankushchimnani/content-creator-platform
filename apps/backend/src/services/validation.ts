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
  contentType?: 'PRE_READ' | 'ASSIGNMENT' | 'LECTURE_NOTE';
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
  if (assignmentContext) {
    // Use content-type-specific prompts for assignment-related content
    const prerequisites = assignmentContext.prerequisiteTopics.length > 0 
      ? assignmentContext.prerequisiteTopics.join(', ') 
      : 'N/A';
    const guidelines = assignmentContext.guidelines || 'N/A';
    const briefText = brief || 'N/A';
    const contentType = assignmentContext.contentType || 'LECTURE_NOTE';

    return buildContentTypePrompt(contentType, assignmentContext.topic, prerequisites, guidelines, briefText, content);
  } else {
    // Keep the original simple prompt for standalone content
    let prompt = `You are a content validation engine. Analyze the given markdown content and return strict JSON with numeric scores 0-100 for criteria: relevance, continuity, documentation, and short feedback strings.`;

    prompt += `\n\n=== VALIDATION CRITERIA ===`;
    prompt += `\n• RELEVANCE (0-100): How relevant and focused is the content?`;
    prompt += `\n• CONTINUITY (0-100): How well does the content flow and maintain logical progression?`;
    prompt += `\n• DOCUMENTATION (0-100): How well is the content structured and documented?`;

    prompt += `\n\nBrief (optional): ${brief ?? 'N/A'}`;
    prompt += `\n\nContent to validate:\n${content}`;
    prompt += `\n\nReturn JSON only with keys: relevance, continuity, documentation, feedback: {relevance, continuity, documentation}.`;
    
    return prompt;
  }
}

function buildContentTypePrompt(contentType: string, topic: string, prerequisites: string, guidelines: string, briefText: string, content: string): string {
  const basePrompt = `# Content Validation Engine Prompt

You are a precise content validation engine. Analyze the provided content and return a strict JSON response with numeric scores and feedback.

## CRITICAL INSTRUCTIONS
- Return ONLY valid JSON, no additional text or explanations
- All scores must be integers from 0-100 (no decimals, ranges, or text)
- If you cannot complete validation, return error JSON format shown below
- Feedback strings must be exactly 50 words or fewer (truncate with "..." if needed)
- Escape all quotes in feedback strings with \\"

## Assignment Context
- **Required Topic**: ${topic}
- **Prerequisite Topics**: ${prerequisites}
- **Specific Guidelines**: ${guidelines}
- **Brief/Additional Context**: ${briefText}
- **Content Type**: ${contentType}

## Input Validation Rules
If any critical error occurs, return this error format instead:
\`\`\`json
{
  "error": "Error description here",
  "validation_attempted": false
}
\`\`\`

Common errors:
- Required topic is empty/missing
- Content is empty, over 15,000 characters, or contains only placeholders
- Unable to generate valid JSON due to content issues`;

  let contentTypeSpecificCriteria = '';

  if (contentType === 'ASSIGNMENT') {
    contentTypeSpecificCriteria = `
## Validation Criteria & Conflict Resolution (ASSIGNMENT)

### RELEVANCE (0-100)
Score how well content addresses "${topic}" as an assignment:
- **90-100**: Comprehensive assignment covering all required aspects, clear objectives, appropriate difficulty
- **70-89**: Good assignment structure with minor gaps in objectives or scope
- **50-69**: Adequate assignment but missing key learning objectives or unclear instructions
- **30-49**: Poor assignment structure, unclear objectives, inappropriate difficulty
- **0-29**: Not a valid assignment or completely off-topic

### CONTINUITY (0-100)
Score integration with prerequisites "${prerequisites}" for assignment progression:
- **If prerequisites are "N/A", "none", or empty**: Score internal logical progression and skill building
- **90-100**: Seamless skill progression, builds perfectly on prerequisites, appropriate challenge level
- **70-89**: Good prerequisite integration with minor gaps in skill progression
- **50-69**: Adequate prerequisite connection but some missing skill bridges
- **30-49**: Weak prerequisite integration, inappropriate difficulty jump
- **0-29**: No clear prerequisite connection or illogical skill progression

### DOCUMENTATION (0-100)
Score assignment structure and clarity:
- **90-100**: Excellent assignment format, clear instructions, proper deliverables, good examples
- **70-89**: Good assignment structure with minor clarity issues
- **50-69**: Adequate structure but unclear instructions or missing deliverables
- **30-49**: Poor assignment format, confusing instructions, missing key elements
- **0-29**: Very poor structure, unclear objectives, inappropriate format`;
  } else if (contentType === 'PRE_READ') {
    contentTypeSpecificCriteria = `
## Validation Criteria & Conflict Resolution (PRE-READ)

### RELEVANCE (0-100)
Score how well content addresses "${topic}" as preparatory material:
- **90-100**: Comprehensive pre-read covering all essential background knowledge, perfect preparation
- **70-89**: Good pre-read with minor gaps in background coverage
- **50-69**: Adequate pre-read but missing important foundational concepts
- **30-49**: Poor pre-read coverage, missing key background information
- **0-29**: Not suitable as pre-read or completely off-topic

### CONTINUITY (0-100)
Score prerequisite integration "${prerequisites}" for pre-read effectiveness:
- **If prerequisites are "N/A", "none", or empty**: Score internal logical flow and concept building
- **90-100**: Perfect prerequisite coverage, seamless knowledge building, ideal preparation
- **70-89**: Good prerequisite integration with minor knowledge gaps
- **50-69**: Adequate prerequisite coverage but some missing foundational links
- **30-49**: Weak prerequisite integration, knowledge gaps
- **0-29**: No clear prerequisite connection or poor knowledge foundation

### DOCUMENTATION (0-100)
Score pre-read structure and clarity:
- **90-100**: Excellent pre-read format, clear explanations, good examples, proper pacing
- **70-89**: Good pre-read structure with minor clarity issues
- **50-69**: Adequate structure but unclear explanations or poor pacing
- **30-49**: Poor pre-read format, confusing explanations, inappropriate complexity
- **0-29**: Very poor structure, unclear content, inappropriate for preparation`;
  } else { // LECTURE_NOTE
    contentTypeSpecificCriteria = `
## Validation Criteria & Conflict Resolution (LECTURE NOTE)

### RELEVANCE (0-100)
Score how well content addresses "${topic}" as lecture material:
- **90-100**: Comprehensive lecture note covering all key concepts, clear explanations, good examples
- **70-89**: Good lecture coverage with minor gaps in concept explanation
- **50-69**: Adequate lecture material but missing important concepts or unclear explanations
- **30-49**: Poor lecture coverage, missing key concepts, unclear explanations
- **0-29**: Not suitable as lecture material or completely off-topic

### CONTINUITY (0-100)
Score prerequisite integration "${prerequisites}" for lecture flow:
- **If prerequisites are "N/A", "none", or empty**: Score internal logical flow and concept progression
- **90-100**: Perfect prerequisite integration, seamless concept flow, ideal learning progression
- **70-89**: Good prerequisite connection with minor flow issues
- **50-69**: Adequate prerequisite integration but some missing concept bridges
- **30-49**: Weak prerequisite integration, poor concept flow
- **0-29**: No clear prerequisite connection or illogical concept progression

### DOCUMENTATION (0-100)
Score lecture note structure and clarity:
- **90-100**: Excellent lecture format, clear structure, good examples, proper pacing
- **70-89**: Good lecture structure with minor clarity issues
- **50-69**: Adequate structure but unclear explanations or poor organization
- **30-49**: Poor lecture format, confusing explanations, inappropriate complexity
- **0-29**: Very poor structure, unclear content, inappropriate for learning`;
  }

  const conflictResolution = `
## Scoring Conflict Resolution
- **High relevance + Poor prerequisites**: Cap continuity at maximum 40
- **Boundary scores (68-72)**: Default to lower score unless content clearly merits higher
- **Multiple topics covered**: Score based on required topic coverage only
- **Contradictory content quality**: Weight most recent/specific evidence higher`;

  const contentSection = `
## Content to Validate
\`\`\`
${content}
\`\`\``;

  const outputFormat = `
## Required Output Format
Return ONLY this JSON structure (no additional text):

\`\`\`json
{
  "relevance": 85,
  "continuity": 72,
  "documentation": 90,
  "feedback": {
    "relevance": "Content thoroughly covers the required topic with comprehensive examples and clear focus throughout.",
    "continuity": "Builds well on most prerequisites but lacks clear connection to advanced concepts mentioned.",
    "documentation": "Excellent structure and formatting. Follows all specified guidelines with minor spacing issues."
  }
}
\`\`\``;

  const checklist = `
## Final Validation Checklist
Before returning JSON, verify:
- [ ] All scores are integers 0-100
- [ ] Each feedback string is ≤50 words
- [ ] All quotes in feedback are escaped with \\"
- [ ] JSON is valid and parseable
- [ ] If validation impossible, error format is used instead`;

  return basePrompt + contentTypeSpecificCriteria + conflictResolution + contentSection + outputFormat + checklist;
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


