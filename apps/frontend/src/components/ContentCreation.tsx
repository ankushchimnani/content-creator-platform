import { useState, useEffect, useRef } from 'react';
import { apiCall } from '../utils/api';
import { marked } from 'marked';
import * as monaco from 'monaco-editor';

type User = {
  id: string;
  email: string;
  name: string;
  role: string;
};

type TaskData = {
  taskId: string;
  topic: string;
  contentType: string;
  guidelines?: string;
  prerequisiteTopics: string[];
  existingContent?: {
    id: string;
    title: string;
    content: string;
    brief: string;
    reviewFeedback?: string;
  };
};

type ValidationResult = {
  criteria: {
    relevance: { score: number; confidence: number; feedback: string; suggestions: string[]; issues: any[] };
    continuity: { score: number; confidence: number; feedback: string; suggestions: string[]; issues: any[] };
    documentation: { score: number; confidence: number; feedback: string; suggestions: string[]; issues: any[] };
  };
  providers: string[];
  overallScore: number;
  overallConfidence: number;
  processingTime: number;
  assignmentContext?: {
    topic: string;
    prerequisiteTopics: string[];
    hasGuidelines: boolean;
  };
};

type Props = {
  user: User;
  token: string;
  onBack: () => void;
  taskData?: TaskData;
};

export function ContentCreation({ user, token, onBack, taskData }: Props) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [brief, setBrief] = useState('');
  const [contentType, setContentType] = useState('LECTURE_NOTE');
  const [realTimePreview, setRealTimePreview] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [contentId, setContentId] = useState<string | null>(null);
  const [contentCreated, setContentCreated] = useState(false);
  
  // Monaco Editor refs
  const editorRef = useRef<HTMLDivElement>(null);
  const monacoEditorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);

  useEffect(() => {
    if (taskData) {
      if (taskData.existingContent) {
        // Pre-fill with existing content for revision
        setTitle(taskData.existingContent.title);
        setContent(taskData.existingContent.content);
        setBrief(taskData.existingContent.brief);
        setContentType(taskData.contentType);
        setContentId(taskData.existingContent.id);
      } else {
        // Create new content
        setTitle(`${taskData.contentType.replace('_', ' ')}: ${taskData.topic}`);
        setBrief(taskData.guidelines || '');
        setContentType(taskData.contentType);
      }
    }
  }, [taskData]);

  // Initialize Monaco Editor
  useEffect(() => {
    if (editorRef.current && !monacoEditorRef.current) {
      // Create Monaco Editor instance
      monacoEditorRef.current = monaco.editor.create(editorRef.current, {
        value: content,
        language: 'markdown',
        theme: 'vs-light',
        automaticLayout: true,
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        wordWrap: 'on',
        lineNumbers: 'on',
        fontSize: 14,
        fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace',
        padding: { top: 16, bottom: 16 },
        // Disable suggestions to avoid interference
        suggest: {
          showKeywords: false,
          showSnippets: false,
        },
        quickSuggestions: false,
        parameterHints: {
          enabled: false,
        },
        hover: {
          enabled: false,
        },
        // Basic formatting
        formatOnPaste: false,
        formatOnType: false,
        insertSpaces: true,
        tabSize: 2,
      });

      // Listen for content changes
      monacoEditorRef.current.onDidChangeModelContent(() => {
        const newContent = monacoEditorRef.current?.getValue() || '';
        setContent(newContent);
      });
    }

    return () => {
      if (monacoEditorRef.current) {
        monacoEditorRef.current.dispose();
        monacoEditorRef.current = null;
      }
    };
  }, []);

  // Update editor content when content state changes
  useEffect(() => {
    if (monacoEditorRef.current && monacoEditorRef.current.getValue() !== content) {
      monacoEditorRef.current.setValue(content);
    }
  }, [content]);

  // Real-time preview effect
  useEffect(() => {
    if (realTimePreview && content) {
      // Trigger validation automatically when real-time preview is on
      const timeoutId = setTimeout(() => {
        validateContent();
      }, 2000); // Debounce validation
      
      return () => clearTimeout(timeoutId);
    }
  }, [content, realTimePreview]); // Note: validateContent is not in deps to avoid infinite loop

  const validateContent = async () => {
    if (!content.trim()) {
      setValidationResult(null);
      return;
    }

    setIsValidating(true);
    try {
      const endpoint = taskData?.taskId 
        ? `/api/validate/assignment/${taskData.taskId}`
        : '/api/validate';
      
      const res = await apiCall(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          content,
          brief: brief || undefined,
          contentId: contentId || undefined
        })
      });
      
      if (res.ok) {
        const result = await res.json();
        setValidationResult(result);
      } else {
        const error = await res.json();
        console.error('Validation failed:', error);
        alert(`Validation failed: ${error.error || 'Unknown error'}`);
        setValidationResult(null);
      }
    } catch (error) {
      console.error('Validation error:', error);
      alert(`Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setValidationResult(null);
    } finally {
      setIsValidating(false);
    }
  };

  const submitForReview = async () => {
    if (!contentId) {
      alert('No content to submit');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await apiCall('/api/content/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          contentId: contentId
        })
      });

      if (res.ok) {
        await res.json();
        alert('Content submitted for review successfully!');
        onBack(); // Go back to dashboard after successful submission
      } else {
        const error = await res.json();
        alert(`Failed to submit content: ${error.error}`);
      }
    } catch (error) {
      console.error('Failed to submit content:', error);
      alert('Failed to submit content');
    } finally {
      setIsSubmitting(false);
    }
  };

  const createContent = async () => {
    if (!title.trim() || !content.trim()) {
      alert('Please fill in all required fields');
      return;
    }

    setIsCreating(true);
    try {
      let res;
      
      if (taskData?.existingContent) {
        // Update existing content for revision
        res = await apiCall(`/api/content/${taskData.existingContent.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            title,
            content,
            brief: brief || undefined,
            contentType: contentType as 'LECTURE_NOTE' | 'PRE_READ' | 'ASSIGNMENT',
            tags: [],
            category: undefined
          })
        });
      } else {
        // Create new content
        res = await apiCall('/api/content', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            title,
            content,
            brief: brief || undefined,
            contentType: contentType as 'LECTURE_NOTE' | 'PRE_READ' | 'ASSIGNMENT',
            tags: [],
            category: undefined
          })
        });
      }

      if (res.ok) {
        const data = await res.json();
        setContentId(data.content.id);
        
        // Link content to assignment if taskData exists and it's not a revision
        if (taskData?.taskId && !taskData?.existingContent) {
          try {
            await apiCall(`/api/assignments/${taskData.taskId}/link-content`, {
              method: 'POST',
              headers: { 
                'Content-Type': 'application/json', 
                Authorization: `Bearer ${token}` 
              },
              body: JSON.stringify({ contentId: data.content.id })
            });
            
            // For assignments, content is automatically completed when linked
            alert('Assignment completed successfully!');
            onBack(); // Go back to dashboard immediately
            return;
          } catch (error) {
            console.error('Failed to link content to assignment:', error);
            alert('Content created but failed to link to assignment');
          }
        }
        
        if (taskData?.existingContent) {
          // For revisions, show success message and allow resubmission
          alert('Content updated successfully! You can now resubmit for review.');
          setContentCreated(true);
        } else {
          // For new content, show success message
          alert('Content created successfully!');
          setContentCreated(true);
        }
      } else {
        const error = await res.json();
        alert(`Failed to ${taskData?.existingContent ? 'update' : 'create'} content: ${error.error}`);
      }
    } catch (error) {
      console.error(`Failed to ${taskData?.existingContent ? 'update' : 'create'} content:`, error);
      alert(`Failed to ${taskData?.existingContent ? 'update' : 'create'} content`);
    } finally {
      setIsCreating(false);
    }
  };

  const renderMarkdownPreview = (text: string) => {
    // Preprocess text to fix common markdown mistakes
    let processedText = text
      // Fix links with spaces: [text] (url) -> [text](url)
      .replace(/\[([^\]]+)\]\s+\(([^)]+)\)/g, '[$1]($2)')
      // Fix URLs without protocol: www.example.com -> https://www.example.com
      .replace(/\[([^\]]+)\]\((www\.[^)]+)\)/g, '[$1](https://$2)')
      // Fix URLs without protocol: example.com -> https://example.com (but not if already has protocol)
      .replace(/\[([^\]]+)\]\(([^h][^)]+)\)/g, (match, text, url) => {
        if (!url.startsWith('http') && !url.startsWith('mailto:') && !url.startsWith('#')) {
          return `[${text}](https://${url})`;
        }
        return match;
      });
    
    // Debug logging (remove in production)
    if (processedText !== text) {
      console.log('Markdown preprocessing:', { original: text, processed: processedText });
    }
    
    // Configure marked for better security and rendering
    marked.setOptions({
      breaks: true, // Convert line breaks to <br>
      gfm: true, // GitHub Flavored Markdown
    });
    
    try {
      const html = marked.parse(processedText) as string;
      // Add target="_blank" to all links for better UX
      return html.replace(/<a href="/g, '<a target="_blank" rel="noopener noreferrer" href="');
    } catch (error) {
      console.error('Markdown parsing error:', error);
      return text.replace(/\n/g, '<br>'); // Fallback to basic rendering
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
          >
            <span className="material-icons">arrow_back</span>
          </button>
          <h1 className="text-xl font-bold text-gray-900">Content Validator</h1>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center">
            <span className="text-sm font-medium text-orange-600">
              {user.name.split(' ').map(n => n[0]).join('')}
            </span>
          </div>
          <div className="text-right">
            <div className="text-sm font-medium text-gray-900">{user.name}</div>
            <div className="text-xs text-gray-500 capitalize">{user.role.toLowerCase()} Validator</div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex h-[calc(100vh-73px)]">
        {/* Main Editor Area */}
        <div className="flex-1 flex flex-col">
          <div className="bg-white border-b border-gray-200 px-6 py-4">
            <h2 className="text-lg font-semibold text-gray-900">Create New Content</h2>
          </div>

          <div className="flex-1 p-6 overflow-auto">
            <div className="max-w-4xl mx-auto space-y-6">
              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Title
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="Enter content title..."
                />
              </div>

              {/* Brief/Requirements */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Brief/Requirements
                </label>
                <textarea
                  value={brief}
                  onChange={(e) => setBrief(e.target.value)}
                  className="w-full h-24 px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
                  placeholder="Describe the content requirements and objectives..."
                />
              </div>

              {/* Rejection Feedback - Only show when revising rejected content */}
              {taskData?.existingContent?.reviewFeedback && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Admin Feedback
                  </label>
                  <div className="bg-red-50 border border-red-200 rounded-md p-4">
                    <div className="flex items-start gap-3">
                      <svg className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                      </svg>
                      <div>
                        <p className="text-sm font-medium text-red-800 mb-1">Rejection Feedback</p>
                        <p className="text-sm text-red-700">
                          {taskData.existingContent.reviewFeedback}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Content Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Content Type
                </label>
                <select
                  value={contentType}
                  onChange={(e) => setContentType(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                >
                  <option value="LECTURE_NOTE">Lecture Note</option>
                  <option value="PRE_READ">Pre-read</option>
                  <option value="ASSIGNMENT">Assignment</option>
                </select>
              </div>

              {/* Success Message */}
              {contentCreated && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="material-icons text-green-600">check_circle</span>
                    <span className="text-sm font-medium text-green-900">Content Created Successfully!</span>
                  </div>
                  <div className="text-sm text-green-800">
                    {taskData ? 
                      'Your assignment content has been created and linked to the task.' :
                      'Your content has been created and is ready for submission. Click "Submit for Review" to send it to your assigned admin for review.'
                    }
                  </div>
                </div>
              )}

              {/* Editor/Preview Split */}
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="flex h-[500px]">
                  {/* Monaco Editor */}
                  <div className="flex-1 flex flex-col">
                    <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
                      <span className="text-sm font-medium text-gray-700">MARKDOWN EDITOR</span>
                    </div>
                    <div 
                      ref={editorRef}
                      className="flex-1"
                      style={{ 
                        height: '100%',
                        textAlign: 'left',
                        direction: 'ltr'
                      }}
                    />
                  </div>

                  {/* Preview */}
                  <div className="flex-1 flex flex-col border-l border-gray-200">
                    <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
                      <span className="text-sm font-medium text-gray-700">LIVE PREVIEW</span>
                    </div>
                    <div className="flex-1 px-4 py-3 overflow-auto bg-white">
                      {content ? (
                        <div 
                          className="prose max-w-none prose-sm prose-headings:text-gray-900 prose-p:text-gray-700 prose-a:text-blue-600 prose-a:no-underline hover:prose-a:underline prose-strong:text-gray-900 prose-code:text-gray-800 prose-code:bg-gray-100 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-pre:bg-gray-100 prose-blockquote:border-l-blue-500 prose-blockquote:text-gray-700"
                          dangerouslySetInnerHTML={{ 
                            __html: renderMarkdownPreview(content)
                          }}
                        />
                      ) : (
                        <div className="text-gray-500 text-center py-8">
                          <div className="text-lg mb-2">Start writing...</div>
                          <div className="text-sm">Your formatted content will appear here as you type.</div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                <button
                  onClick={onBack}
                  className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                >
                  {contentCreated ? 'Back to Dashboard' : 'Cancel'}
                </button>
                
                {!contentCreated ? (
                  <button
                    onClick={createContent}
                    disabled={!title.trim() || !content.trim() || isCreating}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:bg-indigo-300 transition-colors"
                  >
                    {isCreating ? 'Creating...' : (taskData?.existingContent ? 'Update Content' : (taskData ? 'Complete Assignment' : 'Create Content'))}
                  </button>
                ) : !taskData ? (
                  <button
                    onClick={submitForReview}
                    disabled={isSubmitting}
                    className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-green-300 transition-colors"
                  >
                    {isSubmitting ? 'Submitting...' : 'Submit for Review'}
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        {/* Right Panel - Validation Dashboard */}
        <aside className="w-80 bg-white border-l border-gray-200 flex flex-col">
          <div className="bg-gray-50 border-b border-gray-200 px-4 py-3">
            <h3 className="text-sm font-medium text-gray-900">Validation Dashboard</h3>
          </div>

          <div className="flex-1 p-4">
            {!validationResult ? (
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                <span className="material-icons text-gray-400 text-4xl mb-2">check_circle</span>
                <p className="text-sm text-gray-600">
                  Write content and click 'Validate Content' to see results.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="material-icons text-green-600">check_circle</span>
                    <span className="text-sm font-medium text-green-900">Validation Complete</span>
                  </div>
                  <div className="text-sm text-green-800">
                    <div>Overall Score: {validationResult.overallScore}/100</div>
                    <div>Confidence: {validationResult.overallConfidence}%</div>
                    <div>Processing Time: {validationResult.processingTime}ms</div>
                    <div>Providers: {validationResult.providers.join(', ')}</div>
                  </div>
                </div>

                {/* Criteria Scores */}
                <div className="space-y-2">
                  <div className="text-sm font-medium text-gray-700">Criteria Scores:</div>
                  <div className="grid grid-cols-1 gap-2">
                    <div className="flex justify-between text-sm">
                      <span>Relevance:</span>
                      <span className="font-medium">{validationResult.criteria.relevance.score}/100</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Continuity:</span>
                      <span className="font-medium">{validationResult.criteria.continuity.score}/100</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Documentation:</span>
                      <span className="font-medium">{validationResult.criteria.documentation.score}/100</span>
                    </div>
                  </div>
                </div>

                {/* Issues */}
                {validationResult.criteria.documentation.issues.length > 0 && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="material-icons text-yellow-600">warning</span>
                      <span className="text-sm font-medium text-yellow-900">Issues Found</span>
                    </div>
                    <div className="space-y-2">
                      {validationResult.criteria.documentation.issues.map((issue: any, index: number) => (
                        <div key={index} className="text-sm text-yellow-800">
                          {issue.message}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="mt-6 space-y-4">
              <button
                onClick={validateContent}
                disabled={!content.trim() || isValidating}
                className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:bg-indigo-300 transition-colors"
              >
                <span className="material-icons text-base">check_circle</span>
                {isValidating ? 'Validating...' : 'Validate Content'}
              </button>

              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-700">Real-time Preview</span>
                <button
                  onClick={() => setRealTimePreview(!realTimePreview)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    realTimePreview ? 'bg-indigo-600' : 'bg-gray-200'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      realTimePreview ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>
        </aside>
      </main>
    </div>
  );
}