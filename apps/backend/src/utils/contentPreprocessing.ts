// Content preprocessing utilities
export function preprocessContent(content: string): {
  cleanedContent: string;
  warnings: string[];
  metadata: {
    originalLength: number;
    cleanedLength: number;
    hasCodeBlocks: boolean;
    hasHeaders: boolean;
    hasLists: boolean;
  };
} {
  const warnings: string[] = [];
  const originalLength = content.length;
  
  // Remove excessive whitespace
  let cleanedContent = content
    .replace(/\r\n/g, '\n') // Normalize line endings
    .replace(/\n{3,}/g, '\n\n') // Limit consecutive newlines
    .replace(/[ \t]+$/gm, '') // Remove trailing whitespace
    .trim();
  
  // Check for common markdown issues
  const hasUnclosedCodeBlocks = (cleanedContent.match(/```/g) || []).length % 2 !== 0;
  if (hasUnclosedCodeBlocks) {
    warnings.push('Unclosed code blocks detected');
    // Try to fix by adding closing ```
    if (cleanedContent.includes('```') && !cleanedContent.endsWith('```')) {
      cleanedContent += '\n```';
    }
  }
  
  const hasUnclosedBold = (cleanedContent.match(/\*\*/g) || []).length % 2 !== 0;
  if (hasUnclosedBold) {
    warnings.push('Unclosed bold formatting detected');
  }
  
  const hasUnclosedItalic = (cleanedContent.match(/\*/g) || []).length % 2 !== 0;
  if (hasUnclosedItalic) {
    warnings.push('Unclosed italic formatting detected');
  }
  
  // Extract metadata
  const metadata = {
    originalLength,
    cleanedLength: cleanedContent.length,
    hasCodeBlocks: /```/.test(cleanedContent),
    hasHeaders: /^#+\s/m.test(cleanedContent),
    hasLists: /^[\s]*[-*+]\s/m.test(cleanedContent) || /^[\s]*\d+\.\s/m.test(cleanedContent)
  };
  
  // Check for suspiciously short content
  if (cleanedContent.length < 50) {
    warnings.push('Content is very short - may result in low validation scores');
  }
  
  // Check for suspiciously long content
  if (cleanedContent.length > 10000) {
    warnings.push('Content is very long - may impact processing time');
  }
  
  return {
    cleanedContent,
    warnings,
    metadata
  };
}

// Content validation utilities
export function validateContentStructure(content: string): {
  isValid: boolean;
  issues: string[];
  suggestions: string[];
} {
  const issues: string[] = [];
  const suggestions: string[] = [];
  
  // Check for basic structure
  if (!content.trim()) {
    issues.push('Content is empty or only whitespace');
    return { isValid: false, issues, suggestions };
  }
  
  // Check for minimum content length
  if (content.trim().length < 10) {
    issues.push('Content is too short to be meaningful');
    suggestions.push('Add more descriptive content');
  }
  
  // Check for headers
  if (!/^#+\s/m.test(content)) {
    suggestions.push('Consider adding headers to structure your content');
  }
  
  // Check for paragraphs
  const paragraphs = content.split(/\n\s*\n/).filter(p => p.trim().length > 0);
  if (paragraphs.length < 2) {
    suggestions.push('Consider breaking content into multiple paragraphs');
  }
  
  // Check for code blocks (for technical content)
  if (!/```/.test(content) && /function|class|import|const|let|var/i.test(content)) {
    suggestions.push('Consider using code blocks for code snippets');
  }
  
  return {
    isValid: issues.length === 0,
    issues,
    suggestions
  };
}
