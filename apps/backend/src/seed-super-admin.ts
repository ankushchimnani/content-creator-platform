import { prisma } from './lib/prisma';
import bcrypt from 'bcryptjs';

const ASSIGNMENT_PROMPT = `# Assignment Validation Prompt

You are an expert educational content validator. Analyze the following assignment content and provide a comprehensive evaluation.

## Content to Evaluate

**Topic:** {TOPIC}
**Prerequisites:** {PREREQUISITES}
**Guidelines:** {GUIDELINES}
**Brief:** {BRIEF}

**Assignment Content:**
\`\`\`
{CONTENT}
\`\`\`

## Evaluation Criteria

Evaluate the assignment on the following 7 criteria (each scored 0-100):

1. **Grammar and Spelling (0-10 points)**: Check for grammatical errors, spelling mistakes, and language clarity.

2. **Topic Relevance (0-15 points)**: Assess how well the assignment aligns with the specified topic and learning objectives.

3. **Difficulty Distribution (0-20 points)**: Evaluate if the assignment has appropriate difficulty levels (30% easy, 50% medium, 20% hard questions).

4. **Progressive Difficulty (0-15 points)**: Check if questions progress from basic to advanced concepts logically.

5. **Creativity and Engagement (0-15 points)**: Assess the use of creative elements, real-world applications, and student engagement factors.

6. **Clarity and Specificity (0-15 points)**: Evaluate how clear and specific the instructions and questions are.

7. **Factual Correctness (0-10 points)**: Verify the accuracy of information and concepts presented.

## Required JSON Output Format

Respond ONLY with valid JSON in this exact format:

\`\`\`json
{
  "overallScore": [Total Score out of 100],
  "scoreBreakdown": {
    "grammarSpelling": {
      "score": [Score out of 10],
      "explanation": "[Brief explanation]"
    },
    "topicRelevance": {
      "score": [Score out of 15],
      "explanation": "[Brief explanation]"
    },
    "difficultyDistribution": {
      "score": [Score out of 20],
      "explanation": "[Brief explanation with actual percentages]"
    },
    "progressiveDifficulty": {
      "score": [Score out of 15],
      "explanation": "[Brief explanation]"
    },
    "creativityEngagement": {
      "score": [Score out of 15],
      "explanation": "[Brief explanation]"
    },
    "claritySpecificity": {
      "score": [Score out of 15],
      "explanation": "[Brief explanation]"
    },
    "factualCorrectness": {
      "score": [Score out of 10],
      "explanation": "[Brief explanation]"
    }
  },
  "detailedFeedback": {
    "strengths": ["[Strength 1]", "[Strength 2]", "[Strength 3]"],
    "weaknesses": ["[Weakness 1]", "[Weakness 2]", "[Weakness 3]"],
    "suggestion": "[One actionable improvement recommendation]"
  }
}
\`\`\``;

const LECTURE_NOTE_PROMPT = `# Lecture Note Validation Prompt

You are an expert educational content validator. Analyze the following lecture note content and provide a comprehensive evaluation.

## Content to Evaluate

**Topic:** {TOPIC}
**Prerequisites:** {PREREQUISITES}
**Guidelines:** {GUIDELINES}
**Brief:** {BRIEF}

**Lecture Note Content:**
\`\`\`
{CONTENT}
\`\`\`

## Evaluation Criteria

Evaluate the lecture note on the following 7 criteria (each scored 0-100):

1. **Content Structure and Organization (0-20 points)**: Assess logical flow, clear headings, and well-organized sections.

2. **Topic Coverage and Depth (0-20 points)**: Evaluate comprehensiveness and appropriate depth for the target audience.

3. **Clarity and Readability (0-15 points)**: Check language clarity, sentence structure, and readability.

4. **Examples and Illustrations (0-15 points)**: Assess quality and relevance of examples, diagrams, or case studies.

5. **Learning Objectives Alignment (0-15 points)**: Evaluate how well content aligns with stated or implied learning goals.

6. **Engagement and Interactivity (0-10 points)**: Check for elements that promote active learning and student engagement.

7. **Accuracy and Currency (0-5 points)**: Verify factual accuracy and relevance of information.

## Required JSON Output Format

Respond ONLY with valid JSON in this exact format:

\`\`\`json
{
  "overallScore": [Total Score out of 100],
  "scoreBreakdown": {
    "contentStructure": {
      "score": [Score out of 20],
      "explanation": "[Brief explanation]"
    },
    "topicCoverage": {
      "score": [Score out of 20],
      "explanation": "[Brief explanation]"
    },
    "clarityReadability": {
      "score": [Score out of 15],
      "explanation": "[Brief explanation]"
    },
    "examplesIllustrations": {
      "score": [Score out of 15],
      "explanation": "[Brief explanation]"
    },
    "learningObjectives": {
      "score": [Score out of 15],
      "explanation": "[Brief explanation]"
    },
    "engagementInteractivity": {
      "score": [Score out of 10],
      "explanation": "[Brief explanation]"
    },
    "accuracyCurrency": {
      "score": [Score out of 5],
      "explanation": "[Brief explanation]"
    }
  },
  "detailedFeedback": {
    "strengths": ["[Strength 1]", "[Strength 2]", "[Strength 3]"],
    "weaknesses": ["[Weakness 1]", "[Weakness 2]", "[Weakness 3]"],
    "suggestion": "[One actionable improvement recommendation]"
  }
}
\`\`\``;

const PRE_READ_PROMPT = `# Pre-Read Validation Prompt

You are an expert educational content validator. Analyze the following pre-read content and provide a comprehensive evaluation.

## Content to Evaluate

**Topic:** {TOPIC}
**Prerequisites:** {PREREQUISITES}
**Guidelines:** {GUIDELINES}
**Brief:** {BRIEF}

**Pre-Read Content:**
\`\`\`
{CONTENT}
\`\`\`

## Evaluation Criteria

Evaluate the pre-read material on the following 8 criteria (each scored 0-100):

1. **Relevance to Upcoming Content (0-15 points)**: Assess how well the material prepares students for future lessons.

2. **Accessibility and Readability (0-15 points)**: Evaluate language level, clarity, and ease of understanding.

3. **Content Accuracy (0-15 points)**: Verify factual correctness and reliability of information.

4. **Engagement Factor (0-15 points)**: Assess how interesting and motivating the content is for students.

5. **Appropriate Length and Scope (0-15 points)**: Evaluate if the content length is suitable for pre-reading.

6. **Clear Learning Outcomes (0-10 points)**: Check if students will understand what they should learn.

7. **Source Quality and Citations (0-10 points)**: Assess credibility of sources and proper attribution.

8. **Practical Application (0-5 points)**: Evaluate connections to real-world applications or examples.

## Required JSON Output Format

Respond ONLY with valid JSON in this exact format:

\`\`\`json
{
  "overallScore": [Total Score out of 100],
  "scoreBreakdown": {
    "relevanceUpcoming": {
      "score": [Score out of 15],
      "explanation": "[Brief explanation]"
    },
    "accessibilityReadability": {
      "score": [Score out of 15],
      "explanation": "[Brief explanation]"
    },
    "contentAccuracy": {
      "score": [Score out of 15],
      "explanation": "[Brief explanation]"
    },
    "engagementFactor": {
      "score": [Score out of 15],
      "explanation": "[Brief explanation]"
    },
    "lengthScope": {
      "score": [Score out of 15],
      "explanation": "[Brief explanation]"
    },
    "learningOutcomes": {
      "score": [Score out of 10],
      "explanation": "[Brief explanation]"
    },
    "sourceQuality": {
      "score": [Score out of 10],
      "explanation": "[Brief explanation]"
    },
    "practicalApplication": {
      "score": [Score out of 5],
      "explanation": "[Brief explanation]"
    }
  },
  "detailedFeedback": {
    "strengths": ["[Strength 1]", "[Strength 2]", "[Strength 3]"],
    "weaknesses": ["[Weakness 1]", "[Weakness 2]", "[Weakness 3]"],
    "suggestion": "[One actionable improvement recommendation]"
  }
}
\`\`\``;

async function seedSuperAdmin() {
  try {
    console.log('🌱 Seeding super admin and initial configuration...');

    // Create super admin user
    const superAdminEmail = 'superadmin@masaischool.com';
    const superAdminPassword = 'SuperAdmin123!';
    
    // Check if super admin already exists
    const existingSuperAdmin = await prisma.user.findUnique({
      where: { email: superAdminEmail }
    });

    let superAdminUser;
    if (!existingSuperAdmin) {
      const passwordHash = await bcrypt.hash(superAdminPassword, 10);
      
      superAdminUser = await prisma.user.create({
        data: {
          email: superAdminEmail,
          name: 'Super Administrator',
          role: 'SUPER_ADMIN',
          passwordHash,
        }
      });
      
      console.log(`✅ Created super admin user: ${superAdminEmail}`);
      console.log(`🔑 Password: ${superAdminPassword}`);
    } else {
      superAdminUser = existingSuperAdmin;
      console.log(`ℹ️  Super admin user already exists: ${superAdminEmail}`);
    }

    // Create prompt templates
    const promptTemplates = [
      {
        name: 'Assignment Validation Prompt v1',
        contentType: 'ASSIGNMENT' as const,
        prompt: ASSIGNMENT_PROMPT,
      },
      {
        name: 'Lecture Note Validation Prompt v1',
        contentType: 'LECTURE_NOTE' as const,
        prompt: LECTURE_NOTE_PROMPT,
      },
      {
        name: 'Pre-Read Validation Prompt v1',
        contentType: 'PRE_READ' as const,
        prompt: PRE_READ_PROMPT,
      },
    ];

    for (const template of promptTemplates) {
      const existing = await prisma.promptTemplate.findFirst({
        where: { 
          contentType: template.contentType,
          isActive: true 
        }
      });

      if (!existing) {
        await prisma.promptTemplate.create({
          data: {
            ...template,
            createdById: superAdminUser.id,
          }
        });
        console.log(`✅ Created prompt template: ${template.name}`);
      } else {
        console.log(`ℹ️  Prompt template already exists: ${template.name}`);
      }
    }

    // Create default LLM configurations
    const llmConfigs = [
      {
        provider: 'OPENAI' as const,
        modelName: 'gpt-4o-mini',
        priority: 1,
        temperature: 0.0,
      },
      {
        provider: 'ANTHROPIC' as const,
        modelName: 'gemini-1.5-flash',
        priority: 2,
        temperature: 0.0,
      },
    ];

    for (const config of llmConfigs) {
      const existing = await prisma.lLMConfiguration.findFirst({
        where: { 
          provider: config.provider,
          modelName: config.modelName 
        }
      });

      if (!existing) {
        await prisma.lLMConfiguration.create({
          data: {
            ...config,
            createdById: superAdminUser.id,
          }
        });
        console.log(`✅ Created LLM configuration: ${config.provider} - ${config.modelName}`);
      } else {
        console.log(`ℹ️  LLM configuration already exists: ${config.provider} - ${config.modelName}`);
      }
    }

    console.log('🎉 Super admin seeding completed successfully!');
    console.log('\n📋 Summary:');
    console.log(`   Super Admin Email: ${superAdminEmail}`);
    console.log(`   Super Admin Password: ${superAdminPassword}`);
    console.log('   - 3 Prompt templates created');
    console.log('   - 2 LLM configurations created');
    console.log('\n🔐 Please change the super admin password after first login!');

  } catch (error) {
    console.error('❌ Error seeding super admin:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the seed function
seedSuperAdmin()
  .catch((error) => {
    console.error('Seeding failed:', error);
    process.exit(1);
  });
