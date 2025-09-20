export const env = {
  jwtSecret: process.env.JWT_SECRET || 'devsecret',
  openaiApiKey: process.env.OPENAI_API_KEY || '',
  geminiApiKey: process.env.GEMINI_API_KEY || '',
};


