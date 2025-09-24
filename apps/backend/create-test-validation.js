const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function addValidationToExistingContent() {
  try {
    // Find content in REVIEW status
    const content = await prisma.content.findFirst({
      where: { status: 'REVIEW' },
      include: { author: true }
    });
    
    if (!content) {
      console.log('No content in REVIEW status found');
      return;
    }
    
    console.log('Found content:', content.title, 'by', content.author.name);
    
    // Check if validation results already exist
    const existingValidation = await prisma.validationResult.findFirst({
      where: { contentId: content.id }
    });
    
    if (existingValidation) {
      console.log('Validation results already exist for this content');
      return;
    }
    
    // Create validation results
    const validationResult = await prisma.validationResult.create({
      data: {
        contentId: content.id,
        llmProvider: 'OPENAI',
        modelVersion: 'gpt-4',
        criteria: {
          relevance: {
            score: 8.5,
            feedback: 'Content is highly relevant to the topic and provides valuable information about Python loops.',
            suggestions: ['Consider adding more specific examples of loop usage', 'Include practical use cases for different loop types']
          },
          continuity: {
            score: 7.8,
            feedback: 'Content flows well but could benefit from better transitions between concepts.',
            suggestions: ['Add transition sentences between paragraphs', 'Use connecting words for better flow']
          },
          documentation: {
            score: 9.2,
            feedback: 'Excellent documentation with clear explanations and examples of Python loop concepts.',
            suggestions: ['Consider adding a glossary section', 'Include troubleshooting tips for common loop errors']
          }
        },
        overallScore: 8.5,
        processingTimeMs: 1250
      }
    });
    
    console.log('Created validation result:', validationResult.id);
    console.log('Validation results added successfully!');
    console.log('Now refresh the admin review queue to see the LLM validation feedback.');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

addValidationToExistingContent();
