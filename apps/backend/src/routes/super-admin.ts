import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { runDualLLMValidation, type AssignmentContext } from '../services/validation.js';
import bcrypt from 'bcryptjs';
import csv from 'csv-parser';
import { Readable } from 'stream';
import { sendCredentialsEmail } from '../services/email.js';

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

// Helper function to generate default password from name
function generateDefaultPassword(name: string): string {
  // Extract first name (everything before first space)
  const firstName = name.trim().split(' ')[0];
  // Capitalize first letter
  const capitalizedFirstName = firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase();
  return `${capitalizedFirstName}@123`;
}

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
  name: z.string().min(1),
  email: z.string().email(),
  contactNumber: z.string().optional(),
  role: z.enum(['CREATOR', 'REVIEWER', 'ADMIN', 'SUPER_ADMIN']),
  courseAssigned: z.string().optional(),
  admins: z.string().optional(), // Comma-separated admin emails for creators
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
        User: {
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
        User: {
          select: { name: true, email: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Transform the data to match frontend expectations
    const transformedGuidelines = guidelines.map(g => ({
      ...g,
      createdBy: g.User
    }));

    res.json({ guidelines: transformedGuidelines });
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
        updatedAt: new Date(),
      },
      include: {
        User: {
          select: { name: true, email: true }
        }
      }
    });

    // Transform the response to match frontend expectations
    const response = {
      ...newGuidelines,
      createdBy: newGuidelines.User
    };

    res.json({ guidelines: response });
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
        User: {
          select: { name: true, email: true }
        }
      }
    });

    // Transform the response to match frontend expectations
    const response = {
      ...updatedGuidelines,
      createdBy: updatedGuidelines.User
    };

    res.json({ guidelines: response });
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
        contactNumber: true,
        role: true,
        courseAssigned: true,
        isActive: true,
        assignedAdminId: true,
        createdAt: true
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
    const { name, email, contactNumber, role, courseAssigned, adminMapped } = req.body;

    // Validate required fields (password is auto-generated)
    if (!name || !email || !role) {
      return res.status(400).json({ error: 'Name, email, and role are required' });
    }

    // Validate role
    if (!['CREATOR', 'ADMIN', 'SUPER_ADMIN'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    // Validate course requirement for CREATOR
    if (role === 'CREATOR' && !courseAssigned) {
      return res.status(400).json({ error: 'Course is required for creators' });
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      return res.status(400).json({ error: 'User with this email already exists' });
    }

    // Generate default password from first name (e.g., "John" -> "John@123")
    const defaultPassword = generateDefaultPassword(name);

    // Hash the password
    const hashedPassword = await bcrypt.hash(defaultPassword, 10);

    // Build assignedAdminId array
    let assignedAdminIds: string[] = [];
    if (adminMapped && role === 'CREATOR') {
      // adminMapped can be either a string (single email) or array of emails
      const adminEmails = Array.isArray(adminMapped) ? adminMapped : [adminMapped];

      // Fetch all admins by email
      const adminUsers = await prisma.user.findMany({
        where: {
          email: { in: adminEmails.filter(email => email) }, // Filter out empty strings
          role: 'ADMIN'
        },
        select: { id: true }
      });

      assignedAdminIds = adminUsers.map(admin => admin.id);
    }

    // Parse courseAssigned - can be comma-separated or single value
    let courseArray: string[] = [];
    if (courseAssigned && role === 'CREATOR') {
      // Split by comma and trim, support both single and multiple courses
      courseArray = courseAssigned.split(',').map((c: string) => c.trim()).filter((c: string) => c);
    }

    // Create user
    const newUser = await prisma.user.create({
      data: {
        name,
        email,
        contactNumber: contactNumber || null,
        passwordHash: hashedPassword,
        role: role as any,
        courseAssigned: courseArray,
        assignedAdminId: assignedAdminIds,
        isActive: true, // Default to active
      }
    });

    res.json({
      success: true,
      user: {
        id: newUser.id,
        email: newUser.email,
        name: newUser.name,
        role: newUser.role,
        courseAssigned: newUser.courseAssigned,
        contactNumber: newUser.contactNumber,
        isActive: newUser.isActive,
      },
      defaultPassword // Return the generated password so frontend can show it
    });

  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// Update user
superAdminRouter.put('/users/:userId', requireSuperAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { name, contactNumber, role, courseAssigned, adminMapped, isActive } = req.body;

    // Validate required fields
    if (!name || !role || isActive === undefined) {
      return res.status(400).json({ error: 'Name, role, and status are required' });
    }

    // Validate role
    if (!['CREATOR', 'ADMIN', 'SUPER_ADMIN'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    // Validate course requirement for CREATOR
    if (role === 'CREATOR' && !courseAssigned) {
      return res.status(400).json({ error: 'Course is required for creators' });
    }

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!existingUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Build assignedAdminId array
    let assignedAdminIds: string[] = [];
    if (adminMapped && role === 'CREATOR') {
      // adminMapped can be either a string (single email) or array of emails
      const adminEmails = Array.isArray(adminMapped) ? adminMapped : [adminMapped];

      // Fetch all admins by email
      const adminUsers = await prisma.user.findMany({
        where: {
          email: { in: adminEmails.filter(email => email) }, // Filter out empty strings
          role: 'ADMIN'
        },
        select: { id: true }
      });

      assignedAdminIds = adminUsers.map(admin => admin.id);
    }

    // Parse courseAssigned - can be comma-separated or single value
    let courseArray: string[] = [];
    if (courseAssigned && role === 'CREATOR') {
      // Split by comma and trim, support both single and multiple courses
      courseArray = courseAssigned.split(',').map((c: string) => c.trim()).filter((c: string) => c);
    }

    // Update user
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        name,
        contactNumber: contactNumber || null,
        role: role as any,
        courseAssigned: role === 'CREATOR' ? courseArray : [],
        assignedAdminId: role === 'CREATOR' ? assignedAdminIds : [],
        isActive,
      }
    });

    res.json({
      success: true,
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        name: updatedUser.name,
        role: updatedUser.role,
        courseAssigned: updatedUser.courseAssigned,
        contactNumber: updatedUser.contactNumber,
        isActive: updatedUser.isActive,
      }
    });

  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// Send credentials email to user
superAdminRouter.post('/users/:userId/send-credentials', requireSuperAdmin, async (req, res) => {
  try {
    const { userId } = req.params;

    // Get user details
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        courseAssigned: true,
        assignedAdminId: true,
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Generate the default password from user's name (firstname@123)
    const defaultPassword = generateDefaultPassword(user.name);

    // Get all assigned admins' details
    let admins: Array<{ name: string; contact?: string }> = [];

    if (user.assignedAdminId && user.assignedAdminId.length > 0) {
      // Fetch all assigned admins
      const adminUsers = await prisma.user.findMany({
        where: {
          id: { in: user.assignedAdminId },
          role: 'ADMIN'
        },
        select: {
          name: true,
          contactNumber: true,
        }
      });

      admins = adminUsers.map(admin => ({
        name: admin.name,
        contact: admin.contactNumber || undefined
      }));
    }

    // Send email with all details
    await sendCredentialsEmail(
      user.email,
      user.name,
      defaultPassword,
      user.role,
      user.courseAssigned && user.courseAssigned.length > 0 ? user.courseAssigned : undefined,
      admins
    );

    // Optionally: Clear temporary password after sending
    // await prisma.user.update({
    //   where: { id: userId },
    //   data: { temporaryPassword: null }
    // });

    res.json({
      success: true,
      message: 'Credentials email sent successfully'
    });

  } catch (error) {
    console.error('Error sending credentials email:', error);
    res.status(500).json({ error: 'Failed to send credentials email' });
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
              name: row.name?.trim(),
              email: row.email?.trim(),
              contactNumber: row.contactNumber?.trim() || undefined,
              role: row.role?.trim().toUpperCase(),
              courseAssigned: row.courseAssigned?.trim() || undefined,
              admins: row.admins?.trim() || undefined,
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

        // Find admins if specified (handle multiple admins separated by commas)
        let assignedAdminIds: string[] = [];
        if (userData.role === 'CREATOR' && userData.admins) {
          // Split by comma and trim each email
          const adminEmails = userData.admins.split(',').map(email => email.trim()).filter(email => email);

          if (adminEmails.length > 0) {
            const adminUsers = await prisma.user.findMany({
              where: {
                email: { in: adminEmails },
                role: 'ADMIN'
              },
              select: { id: true, email: true }
            });

            if (adminUsers.length !== adminEmails.length) {
              const foundEmails = adminUsers.map(a => a.email);
              const notFoundEmails = adminEmails.filter(e => !foundEmails.includes(e));
              results.errors.push(`Admin(s) not found for creator ${userData.email}: ${notFoundEmails.join(', ')}`);
              continue;
            }
            assignedAdminIds = adminUsers.map(admin => admin.id);
          }
        }

        // Parse courseAssigned - can be comma-separated or single value
        let courseArray: string[] = [];
        if (userData.courseAssigned) {
          // Split by comma and trim, support both single and multiple courses
          courseArray = userData.courseAssigned.split(',').map((c: string) => c.trim()).filter((c: string) => c);
        }

        // Generate default password using firstname@123 pattern
        const defaultPassword = generateDefaultPassword(userData.name);
        const passwordHash = await bcrypt.hash(defaultPassword, 10);

        // Create user
        const newUser = await prisma.user.create({
          data: {
            name: userData.name,
            email: userData.email,
            contactNumber: userData.contactNumber || null,
            role: userData.role as any,
            courseAssigned: courseArray,
            passwordHash,
            assignedAdminId: assignedAdminIds.length > 0 ? assignedAdminIds : [],
            isActive: true,
          },
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            courseAssigned: true,
            assignedAdminId: true,
          }
        });
        
        // Store default password for tracking
        await prisma.$executeRaw`
          INSERT INTO "TemporaryPassword" (id, "userId", email, "tempPassword", "createdAt")
          VALUES (gen_random_uuid()::text, ${newUser.id}, ${newUser.email}, ${defaultPassword}, NOW())
        `;

        results.created++;
        results.users.push({
          ...newUser,
          tempPassword: defaultPassword // Include default password in response for admin to share
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

// Get all temporary passwords (for download)
superAdminRouter.get('/users/temporary-passwords', async (req, res) => {
  try {
    const tempPasswords = await prisma.$queryRaw`
      SELECT 
        tp.email,
        tp."tempPassword",
        tp."createdAt",
        tp.used,
        tp."usedAt",
        u.name,
        u.role,
        u."assignedAdminId",
        admin.name as "adminName",
        admin.email as "adminEmail"
      FROM "TemporaryPassword" tp
      JOIN "User" u ON tp."userId" = u.id
      LEFT JOIN "User" admin ON u."assignedAdminId" = admin.id
      ORDER BY tp."createdAt" DESC
    ` as any[];
    
    res.json({ tempPasswords });
  } catch (error) {
    console.error('Error fetching temporary passwords:', error);
    res.status(500).json({ error: 'Failed to fetch temporary passwords' });
  }
});

// Download temporary passwords as CSV
superAdminRouter.get('/users/temporary-passwords/download', async (req, res) => {
  try {
    const tempPasswords = await prisma.$queryRaw`
      SELECT 
        tp.email,
        tp."tempPassword",
        tp."createdAt",
        tp.used,
        tp."usedAt",
        u.name,
        u.role,
        admin.name as "adminName",
        admin.email as "adminEmail"
      FROM "TemporaryPassword" tp
      JOIN "User" u ON tp."userId" = u.id
      LEFT JOIN "User" admin ON u."assignedAdminId" = admin.id
      ORDER BY tp."createdAt" DESC
    ` as any[];
    
    // Create CSV content
    const csvHeader = 'Email,Name,Role,Admin Name,Admin Email,Temporary Password,Created At,Used,Used At\n';
    const csvRows = tempPasswords.map(row => 
      `"${row.email}","${row.name || ''}","${row.role}","${row.adminName || ''}","${row.adminEmail || ''}","${row.tempPassword}","${row.createdAt}","${row.used}","${row.usedAt || ''}"`
    ).join('\n');
    
    const csvContent = csvHeader + csvRows;
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="temporary-passwords.csv"');
    res.send(csvContent);
  } catch (error) {
    console.error('Error downloading temporary passwords:', error);
    res.status(500).json({ error: 'Failed to download temporary passwords' });
  }
});

// ANALYTICS ROUTES

// Get creator content analytics
superAdminRouter.get('/analytics/creators', async (req, res) => {
  try {
    const creators = await prisma.user.findMany({
      where: { role: 'CREATOR' },
      include: {
        Content_Content_authorIdToUser: {
          select: {
            id: true,
            status: true,
            contentType: true,
            createdAt: true,
          }
        },
        _count: {
          select: { Content_Content_authorIdToUser: true }
        }
      }
    });

    const analytics = creators.map(creator => {
      const contentStats = creator.Content_Content_authorIdToUser.reduce((acc, content) => {
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
        contentStats,
        lastContentCreated: creator.Content_Content_authorIdToUser.length > 0
          ? creator.Content_Content_authorIdToUser.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]?.createdAt || null
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
        email: true
      },
      orderBy: { name: 'asc' }
    });
    
    res.json({ admins });
  } catch (error) {
    console.error('Error fetching admins:', error);
    res.status(500).json({ error: 'Failed to fetch admins' });
  }
});

// GET /api/super-admin/analytics - Get filtered analytics data with cross-filtering support
superAdminRouter.get('/analytics', async (req, res) => {
  try {
    const { adminId, creatorId, month, course, section } = req.query;

    // Build where clause for ContentAssignment supporting multiple filters simultaneously
    let assignmentWhereClause: any = {};

    // Apply admin filter (assignedById = admin who assigned the task)
    if (adminId && adminId !== 'all') {
      assignmentWhereClause.assignedById = adminId as string;
    }

    // Apply creator filter (assignedToId = creator who was assigned to)
    if (creatorId && creatorId !== 'all') {
      assignmentWhereClause.assignedToId = creatorId as string;
    }

    // Apply month filter
    if (month && month !== 'all') {
      // Parse month value (format: "2024-10")
      const [year, monthNum] = (month as string).split('-');
      const monthStart = new Date(parseInt(year), parseInt(monthNum) - 1, 1);
      const monthEnd = new Date(parseInt(year), parseInt(monthNum), 1);
      assignmentWhereClause.createdAt = { gte: monthStart, lt: monthEnd };
    }

    // Apply course filter
    if (course && course !== 'all') {
      assignmentWhereClause.course = course as string;
    }

    // Apply section filter
    if (section && section !== 'all') {
      assignmentWhereClause.section = section as string;
    }

    // Calculate the 4 key metrics using ContentAssignment table
    const totalAssigned = await prisma.contentAssignment.count({
      where: assignmentWhereClause
    });

    // Build where clause for Content based on filters
    let contentWhereClause: any = {};

    // Apply admin filter (via ContentAssignment relation)
    if (adminId && adminId !== 'all') {
      contentWhereClause.ContentAssignment = {
        assignedById: adminId as string
      };
    }

    // Apply creator filter
    if (creatorId && creatorId !== 'all') {
      contentWhereClause.authorId = creatorId as string;
    }

    // Apply month filter
    if (month && month !== 'all') {
      const [year, monthNum] = (month as string).split('-');
      const monthStart = new Date(parseInt(year), parseInt(monthNum) - 1, 1);
      const monthEnd = new Date(parseInt(year), parseInt(monthNum), 1);
      contentWhereClause.createdAt = { gte: monthStart, lt: monthEnd };
    }

    // Apply course and section filters via ContentAssignment
    if ((course && course !== 'all') || (section && section !== 'all')) {
      if (!contentWhereClause.ContentAssignment) {
        contentWhereClause.ContentAssignment = {};
      }
      if (course && course !== 'all') {
        contentWhereClause.ContentAssignment.course = course as string;
      }
      if (section && section !== 'all') {
        contentWhereClause.ContentAssignment.section = section as string;
      }
    }

    // Count content by status
    const [pendingReview, approved, rejected] = await prisma.$transaction([
      prisma.content.count({
        where: { ...contentWhereClause, status: 'REVIEW' }
      }),
      prisma.content.count({
        where: { ...contentWhereClause, status: 'APPROVED' }
      }),
      prisma.content.count({
        where: { ...contentWhereClause, status: 'REJECTED' }
      })
    ]);

    // Calculate overview metrics (without filters - global stats)
    const totalContent = await prisma.content.count();

    const activeUsers = await prisma.user.count({
      where: { isActive: true, role: { in: ['CREATOR', 'ADMIN'] } }
    });

    // Calculate average quality score
    const validationResults = await prisma.validationResult.findMany({
      select: { overallScore: true }
    });
    const avgQualityScore = validationResults.length > 0
      ? validationResults.reduce((sum, r) => sum + r.overallScore, 0) / validationResults.length
      : 0;

    // Calculate overall approval rate (approved / total assigned)
    const totalAssignedGlobal = await prisma.contentAssignment.count();
    const allApproved = await prisma.content.count({
      where: { status: 'APPROVED' }
    });
    const approvalRate = totalAssignedGlobal > 0
      ? (allApproved / totalAssignedGlobal) * 100
      : 0;

    // Get filter options
    // 1. Admins
    const admins = await prisma.user.findMany({
      where: { role: { in: ['ADMIN', 'SUPER_ADMIN'] }, isActive: true },
      select: { id: true, name: true, email: true },
      orderBy: { name: 'asc' }
    });
    const adminOptions = admins.map(admin => ({
      value: admin.id,
      label: `${admin.name} (${admin.email})`
    }));

    // 2. Creators
    const creators = await prisma.user.findMany({
      where: { role: 'CREATOR', isActive: true },
      select: { id: true, name: true, email: true },
      orderBy: { name: 'asc' }
    });
    const creatorOptions = creators.map(creator => ({
      value: creator.id,
      label: `${creator.name} (${creator.email})`
    }));

    // 3. Months - only include months where assignments were created
    const allAssignments = await prisma.contentAssignment.findMany({
      select: { createdAt: true },
      orderBy: { createdAt: 'desc' }
    });

    const monthsSet = new Set<string>();
    allAssignments.forEach(assignment => {
      const date = new Date(assignment.createdAt);
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      monthsSet.add(`${year}-${month.toString().padStart(2, '0')}`);
    });

    const monthOptions = Array.from(monthsSet)
      .sort((a, b) => b.localeCompare(a)) // Sort descending (newest first)
      .map(monthValue => {
        const [year, month] = monthValue.split('-');
        const date = new Date(parseInt(year), parseInt(month) - 1, 1);
        return {
          value: monthValue,
          label: date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
        };
      });

    // 4. Courses - get from ContentAssignment table
    const allCourses = await prisma.contentAssignment.findMany({
      where: { course: { not: null } },
      select: { course: true },
      distinct: ['course']
    });
    const courseOptions = allCourses
      .filter(item => item.course)
      .map(item => ({
        value: item.course!,
        label: item.course!
      }))
      .sort((a, b) => a.label.localeCompare(b.label));

    // 5. Sections
    const sectionOptions = [
      { value: 'PRE_ORDER', label: 'Pre-Order' },
      { value: 'IN_ORDER', label: 'In-Order' },
      { value: 'POST_ORDER', label: 'Post-Order' }
    ];

    res.json({
      metrics: {
        totalAssigned,
        pendingReview,
        approved,
        rejected
      },
      overview: {
        totalContent,
        activeUsers,
        avgQualityScore,
        approvalRate
      },
      filterOptions: {
        admins: adminOptions,
        creators: creatorOptions,
        months: monthOptions,
        courses: courseOptions,
        sections: sectionOptions
      }
    });
  } catch (error) {
    console.error('Error fetching analytics:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});
