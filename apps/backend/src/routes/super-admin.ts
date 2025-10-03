import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { runDualLLMValidation, type AssignmentContext } from '../services/validation.js';
import bcrypt from 'bcryptjs';
import csv from 'csv-parser';
import { Readable } from 'stream';

export const superAdminRouter = Router();

// Middleware to ensure user is super admin
const requireSuperAdmin = (req: any, res: any, next: any) => {
  if (req.user?.role !== 'SUPER_ADMIN') {
    return res.status(403).json({ error: 'Super admin access required' });
  }
  next();
};

// Apply auth and super admin middleware to all routes
superAdminRouter.use(requireAuth);
superAdminRouter.use(requireSuperAdmin);

// Validation schemas
const promptTemplateSchema = z.object({
  name: z.string().min(1),
  contentType: z.enum(['PRE_READ', 'ASSIGNMENT', 'LECTURE_NOTE']),
  prompt: z.string().min(1),
});

const llmConfigSchema = z.object({
  provider: z.enum(['OPENAI', 'ANTHROPIC', 'LOCAL']),
  modelName: z.string().min(1),
  temperature: z.number().min(0).max(2).default(0.0),
  maxTokens: z.number().optional(),
  apiEndpoint: z.string().optional(),
  priority: z.number().default(1),
});

const userCreateSchema = z.object({
  email: z.string().email(),
  role: z.enum(['CREATOR', 'REVIEWER', 'ADMIN']),
  adminMapped: z.string().optional(), // Admin email for creators
});

const promptTestSchema = z.object({
  prompt: z.string().min(1),
  contentType: z.enum(['PRE_READ', 'ASSIGNMENT', 'LECTURE_NOTE']),
  variables: z.object({
    topic: z.string(),
    prerequisites: z.string(),
    content: z.string(),
  }),
});

// PROMPT MANAGEMENT ROUTES

// Test a prompt with sample data
superAdminRouter.post('/prompts/test', async (req, res) => {
  try {
    const { prompt, contentType, variables } = promptTestSchema.parse(req.body);
    
    // Replace variables in the prompt
    let processedPrompt = prompt
      .replace(/{TOPIC}/g, variables.topic)
      .replace(/{TOPICS_TAUGHT_SO_FAR}/g, variables.prerequisites)
      .replace(/{PREREQUISITES}/g, variables.prerequisites) // Keep backward compatibility
      .replace(/{CONTENT}/g, variables.content);
    
    // Create assignment context for validation
    const assignmentContext: AssignmentContext = {
      topic: variables.topic,
      topicsTaughtSoFar: variables.prerequisites.split(',').map(p => p.trim()).filter(p => p),
      contentType: contentType,
    };
    
    // Run dual LLM validation
    const startTime = Date.now();
    const dualResult = await runDualLLMValidation(
      variables.content, 
      assignmentContext
    );
    const processingTime = Date.now() - startTime;
    
    res.json({
      success: true,
      processedPrompt,
      variables: {
        topic: variables.topic,
        prerequisites: variables.prerequisites,
        content: variables.content,
      },
      dualValidationResult: {
        finalScore: dualResult.finalScore,
        finalFeedback: dualResult.finalFeedback,
        round1Results: dualResult.round1Results,
        round2Results: dualResult.round2Results,
        processingTime: dualResult.processingTime,
      },
      testMetadata: {
        contentType,
        totalProcessingTime: processingTime,
        timestamp: new Date().toISOString(),
      }
    });
  } catch (error) {
    console.error('Error testing prompt:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid test data', details: error.issues });
    }
    res.status(500).json({ 
      error: 'Failed to test prompt', 
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get available variables for prompt creation
superAdminRouter.get('/prompts/variables', async (req, res) => {
  try {
    const variables = {
      available: [
        {
          name: 'TOPIC',
          description: 'The main topic/subject of the content',
          example: 'Introduction to React Hooks',
          required: true,
        },
        {
          name: 'TOPICS_TAUGHT_SO_FAR',
          description: 'Comma-separated list of topics taught so far',
          example: 'JavaScript Fundamentals, ES6 Features, React Basics',
          required: true,
        },
        {
          name: 'CONTENT',
          description: 'The actual content to be validated (markdown format)',
          example: '# React Hooks\n\nReact Hooks are functions that...',
          required: true,
        },
      ],
      usage: {
        syntax: 'Use {VARIABLE_NAME} in your prompt template',
        examples: [
          'Analyze the following {CONTENT} about {TOPIC}',
          'Topics Taught So Far: {TOPICS_TAUGHT_SO_FAR}',
        ],
      },
      sampleData: {
        assignment: {
          topic: 'JavaScript Array Methods',
          topicsTaughtSoFar: 'JavaScript Basics, Functions, Loops',
          content: `# JavaScript Array Methods Assignment

## Exercise 1: Basic Array Operations
Write a function that takes an array of numbers and returns a new array with each number doubled.

\`\`\`javascript
function doubleNumbers(arr) {
  // Your code here
}
\`\`\`

## Exercise 2: Filtering Data
Given an array of user objects, filter out users who are under 18 years old.

## Exercise 3: Data Transformation
Use reduce to calculate the total price of items in a shopping cart.`,
        },
        lectureNote: {
          topic: 'Database Normalization',
          topicsTaughtSoFar: 'Relational Databases, SQL Basics, Entity-Relationship Diagrams',
          content: `# Database Normalization

## Introduction
Database normalization is the process of organizing data in a database to reduce redundancy and improve data integrity.

## First Normal Form (1NF)
A table is in 1NF if:
- All columns contain atomic values
- Each row is unique
- No repeating groups

### Example
**Before 1NF:**
| Student | Courses |
|---------|---------|
| John    | Math, Physics |
| Mary    | Chemistry, Biology |

**After 1NF:**
| Student | Course |
|---------|---------|
| John    | Math |
| John    | Physics |
| Mary    | Chemistry |
| Mary    | Biology |`,
        },
        preRead: {
          topic: 'Introduction to Machine Learning',
          topicsTaughtSoFar: 'Statistics, Python Programming, Linear Algebra',
          content: `# Introduction to Machine Learning

Machine Learning (ML) is a subset of artificial intelligence that enables computers to learn and make decisions from data without being explicitly programmed for every task.

## What is Machine Learning?
At its core, machine learning is about finding patterns in data and using those patterns to make predictions or decisions about new, unseen data.

## Types of Machine Learning

### 1. Supervised Learning
- Uses labeled training data
- Examples: Email spam detection, image recognition
- Common algorithms: Linear regression, decision trees

### 2. Unsupervised Learning  
- Finds patterns in unlabeled data
- Examples: Customer segmentation, anomaly detection
- Common algorithms: K-means clustering, PCA

### 3. Reinforcement Learning
- Learns through interaction and feedback
- Examples: Game playing, robotics
- Uses rewards and penalties to improve performance

## Real-World Applications
- Recommendation systems (Netflix, Amazon)
- Autonomous vehicles
- Medical diagnosis
- Financial fraud detection`,
        },
      },
    };
    
    res.json(variables);
  } catch (error) {
    console.error('Error fetching prompt variables:', error);
    res.status(500).json({ error: 'Failed to fetch prompt variables' });
  }
});

// Get all prompt templates
superAdminRouter.get('/prompts', async (req, res) => {
  try {
    const prompts = await prisma.promptTemplate.findMany({
      include: {
        createdBy: {
          select: { name: true, email: true }
        }
      },
      orderBy: [
        { contentType: 'asc' },
        { version: 'desc' }
      ]
    });
    res.json({ prompts });
  } catch (error) {
    console.error('Error fetching prompts:', error);
    res.status(500).json({ error: 'Failed to fetch prompts' });
  }
});

// Create new prompt template
superAdminRouter.post('/prompts', async (req, res) => {
  try {
    const { name, contentType, prompt } = promptTemplateSchema.parse(req.body);
    
    // Deactivate existing prompts for this content type
    await prisma.promptTemplate.updateMany({
      where: { contentType, isActive: true },
      data: { isActive: false }
    });
    
    // Get next version number
    const lastVersion = await prisma.promptTemplate.findFirst({
      where: { contentType },
      orderBy: { version: 'desc' }
    });
    
    const newPrompt = await prisma.promptTemplate.create({
      data: {
        name,
        contentType,
        prompt,
        version: (lastVersion?.version || 0) + 1,
        createdById: req.user!.id,
      },
      include: {
        createdBy: {
          select: { name: true, email: true }
        }
      }
    });
    
    res.json({ prompt: newPrompt });
  } catch (error) {
    console.error('Error creating prompt:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid prompt data', details: error.issues });
    }
    res.status(500).json({ error: 'Failed to create prompt' });
  }
});

// Update prompt template
superAdminRouter.put('/prompts/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, contentType, prompt } = promptTemplateSchema.parse(req.body);
    
    const updatedPrompt = await prisma.promptTemplate.update({
      where: { id },
      data: { name, contentType, prompt },
      include: {
        createdBy: {
          select: { name: true, email: true }
        }
      }
    });
    
    res.json({ prompt: updatedPrompt });
  } catch (error) {
    console.error('Error updating prompt:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid prompt data', details: error.issues });
    }
    res.status(500).json({ error: 'Failed to update prompt' });
  }
});

// Activate/deactivate prompt template
superAdminRouter.patch('/prompts/:id/toggle', async (req, res) => {
  try {
    const { id } = req.params;
    
    const prompt = await prisma.promptTemplate.findUnique({ where: { id } });
    if (!prompt) {
      return res.status(404).json({ error: 'Prompt not found' });
    }
    
    // If activating, deactivate others of same content type
    if (!prompt.isActive) {
      await prisma.promptTemplate.updateMany({
        where: { contentType: prompt.contentType, isActive: true },
        data: { isActive: false }
      });
    }
    
    const updatedPrompt = await prisma.promptTemplate.update({
      where: { id },
      data: { isActive: !prompt.isActive },
      include: {
        createdBy: {
          select: { name: true, email: true }
        }
      }
    });
    
    res.json({ prompt: updatedPrompt });
  } catch (error) {
    console.error('Error toggling prompt:', error);
    res.status(500).json({ error: 'Failed to toggle prompt' });
  }
});

// GUIDELINES MANAGEMENT ROUTES

// Get all guidelines templates
superAdminRouter.get('/guidelines', async (req, res) => {
  try {
    const guidelines = await prisma.guidelinesTemplate.findMany({
      include: {
        createdBy: {
          select: { name: true, email: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json({ guidelines });
  } catch (error) {
    console.error('Error fetching guidelines:', error);
    res.status(500).json({ error: 'Failed to fetch guidelines' });
  }
});

// Create new guidelines template
const createGuidelinesSchema = z.object({
  name: z.string().min(1),
  contentType: z.enum(['PRE_READ', 'ASSIGNMENT', 'LECTURE_NOTE']),
  guidelines: z.string().min(1),
});

superAdminRouter.post('/guidelines', async (req, res) => {
  try {
    const { name, contentType, guidelines } = createGuidelinesSchema.parse(req.body);
    
    // Deactivate existing guidelines for this content type
    await prisma.guidelinesTemplate.updateMany({
      where: { contentType, isActive: true },
      data: { isActive: false }
    });
    
    const newGuidelines = await prisma.guidelinesTemplate.create({
      data: {
        name,
        contentType,
        guidelines,
        createdById: req.user!.id,
        isActive: true,
      },
      include: {
        createdBy: {
          select: { name: true, email: true }
        }
      }
    });
    
    res.json({ guidelines: newGuidelines });
  } catch (error) {
    console.error('Error creating guidelines:', error);
    res.status(500).json({ error: 'Failed to create guidelines' });
  }
});

// Update guidelines template
const updateGuidelinesSchema = z.object({
  name: z.string().min(1).optional(),
  guidelines: z.string().min(1).optional(),
});

superAdminRouter.put('/guidelines/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = updateGuidelinesSchema.parse(req.body);
    
    const updatedGuidelines = await prisma.guidelinesTemplate.update({
      where: { id },
      data: {
        ...(updates.name && { name: updates.name }),
        ...(updates.guidelines && { guidelines: updates.guidelines }),
        version: { increment: 1 },
        updatedAt: new Date(),
      },
      include: {
        createdBy: {
          select: { name: true, email: true }
        }
      }
    });
    
    res.json({ guidelines: updatedGuidelines });
  } catch (error) {
    console.error('Error updating guidelines:', error);
    res.status(500).json({ error: 'Failed to update guidelines' });
  }
});

// Toggle guidelines active status
superAdminRouter.patch('/guidelines/:id/toggle', async (req, res) => {
  try {
    const { id } = req.params;
    
    const currentGuidelines = await prisma.guidelinesTemplate.findUnique({
      where: { id }
    });
    
    if (!currentGuidelines) {
      return res.status(404).json({ error: 'Guidelines not found' });
    }
    
    const updatedGuidelines = await prisma.guidelinesTemplate.update({
      where: { id },
      data: { isActive: !currentGuidelines.isActive },
      include: {
        createdBy: {
          select: { name: true, email: true }
        }
      }
    });
    
    res.json({ guidelines: updatedGuidelines });
  } catch (error) {
    console.error('Error toggling guidelines:', error);
    res.status(500).json({ error: 'Failed to toggle guidelines' });
  }
});

// LLM CONFIGURATION ROUTES

// Get all LLM configurations
superAdminRouter.get('/llm-configs', async (req, res) => {
  try {
    const configs = await prisma.lLMConfiguration.findMany({
      include: {
        createdBy: {
          select: { name: true, email: true }
        }
      },
      orderBy: { priority: 'asc' }
    });
    res.json({ configs });
  } catch (error) {
    console.error('Error fetching LLM configs:', error);
    res.status(500).json({ error: 'Failed to fetch LLM configurations' });
  }
});

// Create new LLM configuration
superAdminRouter.post('/llm-configs', async (req, res) => {
  try {
    const configData = llmConfigSchema.parse(req.body);
    
    const newConfig = await prisma.lLMConfiguration.create({
      data: {
        provider: configData.provider,
        modelName: configData.modelName,
        temperature: configData.temperature,
        maxTokens: configData.maxTokens || null,
        apiEndpoint: configData.apiEndpoint || null,
        priority: configData.priority,
        createdById: req.user!.id,
      },
      include: {
        createdBy: {
          select: { name: true, email: true }
        }
      }
    });
    
    res.json({ config: newConfig });
  } catch (error) {
    console.error('Error creating LLM config:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid LLM config data', details: error.issues });
    }
    res.status(500).json({ error: 'Failed to create LLM configuration' });
  }
});

// Update LLM configuration
superAdminRouter.put('/llm-configs/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const configData = llmConfigSchema.parse(req.body);
    
    const updatedConfig = await prisma.lLMConfiguration.update({
      where: { id },
      data: {
        provider: configData.provider,
        modelName: configData.modelName,
        temperature: configData.temperature,
        maxTokens: configData.maxTokens || null,
        apiEndpoint: configData.apiEndpoint || null,
        priority: configData.priority,
      },
      include: {
        createdBy: {
          select: { name: true, email: true }
        }
      }
    });
    
    res.json({ config: updatedConfig });
  } catch (error) {
    console.error('Error updating LLM config:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid LLM config data', details: error.issues });
    }
    res.status(500).json({ error: 'Failed to update LLM configuration' });
  }
});

// Toggle LLM configuration active status
superAdminRouter.patch('/llm-configs/:id/toggle', async (req, res) => {
  try {
    const { id } = req.params;
    
    const config = await prisma.lLMConfiguration.findUnique({ where: { id } });
    if (!config) {
      return res.status(404).json({ error: 'LLM configuration not found' });
    }
    
    const updatedConfig = await prisma.lLMConfiguration.update({
      where: { id },
      data: { isActive: !config.isActive },
      include: {
        createdBy: {
          select: { name: true, email: true }
        }
      }
    });
    
    res.json({ config: updatedConfig });
  } catch (error) {
    console.error('Error toggling LLM config:', error);
    res.status(500).json({ error: 'Failed to toggle LLM configuration' });
  }
});

// USER MANAGEMENT ROUTES

// Get all users
superAdminRouter.get('/users', requireSuperAdmin, async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
        assignedAdmin: {
          select: {
            id: true,
            name: true,
            email: true,
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    res.json({
      success: true,
      users
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Create individual user
superAdminRouter.post('/users/create', requireSuperAdmin, async (req, res) => {
  try {
    const { email, role, password, adminMapped } = req.body;
    
    // Validate required fields
    if (!email || !role || !password) {
      return res.status(400).json({ error: 'Email, role, and password are required' });
    }
    
    // Validate password length
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long' });
    }
    
    // Validate role
    if (!['CREATOR', 'ADMIN', 'SUPER_ADMIN'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }
    
    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });
    
    if (existingUser) {
      return res.status(400).json({ error: 'User with this email already exists' });
    }
    
    // Hash the provided password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Find admin if adminMapped is provided
    let assignedAdminId = null;
    if (adminMapped && role === 'CREATOR') {
      const admin = await prisma.user.findUnique({
        where: { email: adminMapped }
      });
      if (admin && admin.role === 'ADMIN') {
        assignedAdminId = admin.id;
      }
    }
    
    // Create user
    const newUser = await prisma.user.create({
      data: {
        email,
        name: email.split('@')[0], // Use email prefix as default name
        passwordHash: hashedPassword,
        role: role as any,
        assignedAdminId,
      }
    });
    
    res.json({
      success: true,
      user: {
        id: newUser.id,
        email: newUser.email,
        name: newUser.name,
        role: newUser.role,
      }
    });
    
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// Create users from CSV
superAdminRouter.post('/users/bulk-create', async (req, res) => {
  try {
    const { csvData } = req.body;
    if (!csvData || typeof csvData !== 'string') {
      return res.status(400).json({ error: 'CSV data is required' });
    }
    
    const users: any[] = [];
    const errors: string[] = [];
    
    // Parse CSV data
    const readable = Readable.from([csvData]);
    
    await new Promise((resolve, reject) => {
      readable
        .pipe(csv())
        .on('data', (row: any) => {
          try {
            const userData = userCreateSchema.parse({
              email: row.email?.trim(),
              role: row.role?.trim().toUpperCase(),
              adminMapped: row.admin_mapped?.trim() || undefined,
            });
            users.push(userData);
          } catch (error) {
            if (error instanceof z.ZodError) {
              errors.push(`Row with email ${row.email}: ${error.issues.map((e: any) => e.message).join(', ')}`);
            } else {
              errors.push(`Row with email ${row.email}: Invalid data`);
            }
          }
        })
        .on('end', resolve)
        .on('error', reject);
    });
    
    if (errors.length > 0) {
      return res.status(400).json({ error: 'CSV validation errors', details: errors });
    }
    
    const results = {
      created: 0,
      errors: [] as string[],
      users: [] as any[]
    };
    
    // Process each user
    for (const userData of users) {
      try {
        // Check if user already exists
        const existingUser = await prisma.user.findUnique({
          where: { email: userData.email }
        });
        
        if (existingUser) {
          results.errors.push(`User with email ${userData.email} already exists`);
          continue;
        }
        
        // Find admin if specified
        let assignedAdminId = undefined;
        if (userData.role === 'CREATOR' && userData.adminMapped) {
          const admin = await prisma.user.findFirst({
            where: { 
              email: userData.adminMapped,
              role: 'ADMIN'
            }
          });
          
          if (!admin) {
            results.errors.push(`Admin with email ${userData.adminMapped} not found for creator ${userData.email}`);
            continue;
          }
          assignedAdminId = admin.id;
        }
        
        // Generate temporary password
        const tempPassword = Math.random().toString(36).slice(-8);
        const passwordHash = await bcrypt.hash(tempPassword, 10);
        
        // Create user
        const newUser = await prisma.user.create({
          data: {
            email: userData.email,
            role: userData.role as any,
            passwordHash,
            assignedAdminId: assignedAdminId || null,
            name: userData.email.split('@')[0], // Use email prefix as default name
          },
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            assignedAdmin: {
              select: { name: true, email: true }
            }
          }
        });
        
        results.created++;
        results.users.push({
          ...newUser,
          tempPassword // Include temp password in response for admin to share
        });
        
      } catch (error) {
        console.error(`Error creating user ${userData.email}:`, error);
        results.errors.push(`Failed to create user ${userData.email}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
    
    res.json(results);
  } catch (error) {
    console.error('Error in bulk user creation:', error);
    res.status(500).json({ error: 'Failed to process user creation' });
  }
});

// ANALYTICS ROUTES

// Get creator content analytics
superAdminRouter.get('/analytics/creators', async (req, res) => {
  try {
    const creators = await prisma.user.findMany({
      where: { role: 'CREATOR' },
      include: {
        contents: {
          select: {
            id: true,
            status: true,
            contentType: true,
            createdAt: true,
          }
        },
        assignedAdmin: {
          select: { id: true, name: true, email: true }
        },
        _count: {
          select: { contents: true }
        }
      }
    });
    
    const analytics = creators.map(creator => {
      const contentStats = creator.contents.reduce((acc, content) => {
        acc.total++;
        acc.byStatus[content.status] = (acc.byStatus[content.status] || 0) + 1;
        acc.byType[content.contentType] = (acc.byType[content.contentType] || 0) + 1;
        return acc;
      }, {
        total: 0,
        byStatus: {} as Record<string, number>,
        byType: {} as Record<string, number>
      });
      
      return {
        id: creator.id,
        name: creator.name,
        email: creator.email,
        assignedAdmin: creator.assignedAdmin,
        contentStats,
        lastContentCreated: creator.contents.length > 0 
          ? creator.contents.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]?.createdAt || null
          : null
      };
    });
    
    res.json({ creators: analytics });
  } catch (error) {
    console.error('Error fetching creator analytics:', error);
    res.status(500).json({ error: 'Failed to fetch creator analytics' });
  }
});

// Update creator's assigned admin
superAdminRouter.patch('/creators/:creatorId/admin', async (req, res) => {
  try {
    const { creatorId } = req.params;
    const { adminId } = req.body;
    
    // Validate that the admin exists and has ADMIN role
    if (adminId) {
      const admin = await prisma.user.findFirst({
        where: { id: adminId, role: 'ADMIN' }
      });
      
      if (!admin) {
        return res.status(400).json({ error: 'Invalid admin ID or user is not an admin' });
      }
    }
    
    // Update creator's assigned admin
    const updatedCreator = await prisma.user.update({
      where: { id: creatorId },
      data: { assignedAdminId: adminId || null },
      include: {
        assignedAdmin: {
          select: { id: true, name: true, email: true }
        }
      }
    });
    
    res.json({ creator: updatedCreator });
  } catch (error) {
    console.error('Error updating creator admin assignment:', error);
    res.status(500).json({ error: 'Failed to update admin assignment' });
  }
});

// Get all admins for assignment dropdown
superAdminRouter.get('/admins', async (req, res) => {
  try {
    const admins = await prisma.user.findMany({
      where: { role: 'ADMIN' },
      select: {
        id: true,
        name: true,
        email: true,
        _count: {
          select: { assignedCreators: true }
        }
      },
      orderBy: { name: 'asc' }
    });
    
    res.json({ admins });
  } catch (error) {
    console.error('Error fetching admins:', error);
    res.status(500).json({ error: 'Failed to fetch admins' });
  }
});
