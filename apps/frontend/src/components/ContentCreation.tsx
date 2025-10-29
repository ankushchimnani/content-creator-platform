import { useState, useEffect, useRef } from 'react';
import { apiCall } from '../utils/api';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import 'highlight.js/styles/github.css';
import { MarkdownComponents } from '../utils/markdownComponents';
import * as monaco from 'monaco-editor';
import { Loader } from './Loader';

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
  topicsTaughtSoFar: string[];
  existingContent?: {
    id: string;
    title: string;
    content: string;
    reviewFeedback?: string;
  };
};

type ValidationResult = {
  criteria: {
    relevance: { score: number; confidence: number; feedback: string; issues: any[] };
    continuity: { score: number; confidence: number; feedback: string; issues: any[] };
    documentation: { score: number; confidence: number; feedback: string; issues: any[] };
  };
  providers?: string[];
  overallScore?: number;
  overall?: number; // New dual LLM format
  overallConfidence?: number;
  confidence?: number; // New dual LLM format
  processingTime: number;
  assignmentContext?: {
    topic: string;
    topicsTaughtSoFar: string[];
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
  const [contentType, setContentType] = useState('LECTURE_NOTE');
  const [isCreating, setIsCreating] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [contentId, setContentId] = useState<string | null>(null);
  const [contentCreated, setContentCreated] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [showValidationModal, setShowValidationModal] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);

  // Monaco Editor refs
  const editorRef = useRef<HTMLDivElement>(null);
  const monacoEditorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);

  useEffect(() => {
    if (taskData) {
      if (taskData.existingContent) {
        // Pre-fill with existing content for revision
        setTitle(taskData.existingContent.title);
        setContent(taskData.existingContent.content);
        setContentType(taskData.contentType);
        setContentId(taskData.existingContent.id);
      } else {
        // Create new content
        setTitle(`${taskData.contentType.replace('_', ' ')}: ${taskData.topic}`);
        setContentType(taskData.contentType);
      }
    }
  }, [taskData]);

  // Initialize Monaco Editor
  useEffect(() => {
    if (editorRef.current && !monacoEditorRef.current) {
      // Suppress Monaco web worker warning
      (window as any).MonacoEnvironment = {
        getWorker() {
          return new Worker(new URL('monaco-editor/esm/vs/editor/editor.worker', import.meta.url), { type: 'module' });
        }
      };

      // Detect dark mode
      const isDarkMode = document.documentElement.classList.contains('dark');

      // Create Monaco Editor instance
      monacoEditorRef.current = monaco.editor.create(editorRef.current, {
        value: content,
        language: 'markdown',
        theme: isDarkMode ? 'vs-dark' : 'vs-light',
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

      // Watch for theme changes
      const observer = new MutationObserver(() => {
        if (monacoEditorRef.current) {
          const isDark = document.documentElement.classList.contains('dark');
          monaco.editor.setTheme(isDark ? 'vs-dark' : 'vs-light');
        }
      });

      observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['class']
      });

      // Store observer for cleanup
      return () => {
        observer.disconnect();
        if (monacoEditorRef.current) {
          monacoEditorRef.current.dispose();
          monacoEditorRef.current = null;
        }
      };
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

  // Handle editor resize when expansion state changes
  useEffect(() => {
    if (monacoEditorRef.current) {
      // Small delay to ensure DOM has updated
      setTimeout(() => {
        monacoEditorRef.current?.layout();
      }, 100);
    }
  }, [isExpanded]);

  const validateContent = async () => {
    if (!content.trim()) {
      setValidationResult(null);
      return;
    }

    setIsValidating(true);
    setShowValidationModal(true);
    setValidationResult(null);

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
        setShowValidationModal(false);
      }
    } catch (error) {
      console.error('Validation error:', error);
      alert(`Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setValidationResult(null);
      setShowValidationModal(false);
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
    setShowSubmitModal(true);

    try {
      // Now submit for review with validation data
      const res = await apiCall('/api/content/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          contentId: contentId,
          validationData: validationResult
        })
      });

      if (res.ok) {
        await res.json();
        setShowSubmitModal(false);
        alert('Content submitted for review successfully!');
        onBack(); // Go back to dashboard after successful submission
      } else {
        const error = await res.json();
        setShowSubmitModal(false);
        alert(`Failed to submit content: ${error.error}`);
      }
    } catch (error) {
      console.error('Failed to submit content:', error);
      setShowSubmitModal(false);
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
            // Simply link content to assignment without validation
            const linkRes = await apiCall(`/api/assignments/${taskData.taskId}/link-content`, {
              method: 'POST',
              headers: { 
                'Content-Type': 'application/json', 
                Authorization: `Bearer ${token}` 
              },
              body: JSON.stringify({ 
                contentId: data.content.id
                // No validation data - validation happens only on submit for review
              })
            });
            
            if (linkRes.ok) {
              // For assignments, content is automatically completed when linked
              alert('Assignment completed successfully! You can now submit the content for review if needed.');
              setContentCreated(true); // Enable Submit for Review button
              return;
            } else {
              const error = await linkRes.json();
              alert(`Failed to link content to assignment: ${error.error}`);
            }
          } catch (error) {
            console.error('Failed to complete assignment:', error);
            console.error('Error details:', error);
            const errorMessage = error instanceof Error ? error.message : String(error);
            alert(`Content created but failed to complete assignment: ${errorMessage}`);
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


  return (
    <div className={`h-full bg-gray-50 dark:bg-gray-900 ${isExpanded ? 'fixed inset-0 z-50' : ''}`}>
      {/* Main Content */}
      <main className="h-full flex flex-col">
        {/* Main Editor Area */}
        <div className="flex-1 flex flex-col">
          <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 md:px-6 py-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Create New Content</h2>
          </div>

          <div className="flex-1 p-4 md:p-6 overflow-auto">
            <div className="max-w-7xl mx-auto space-y-6">
              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Title
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  disabled={!!taskData}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:border-transparent disabled:opacity-60 disabled:cursor-not-allowed"
                  placeholder="Enter content title..."
                />
              </div>


              {/* Rejection Feedback - Only show when revising rejected content */}
              {taskData?.existingContent?.reviewFeedback && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Admin Feedback
                  </label>
                  <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-4">
                    <div className="flex items-start gap-3">
                      <svg className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                      </svg>
                      <div>
                        <p className="text-sm font-medium text-red-800 dark:text-red-300 mb-1">Rejection Feedback</p>
                        <p className="text-sm text-red-700 dark:text-red-400">
                          {taskData.existingContent.reviewFeedback}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Content Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Content Type
                </label>
                <select
                  value={contentType}
                  onChange={(e) => setContentType(e.target.value)}
                  disabled={!!taskData}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:border-transparent disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <option value="LECTURE_NOTE">Lecture Note</option>
                  <option value="PRE_READ">Pre-read</option>
                  <option value="ASSIGNMENT">Assignment</option>
                </select>
              </div>

              {/* Sample Reference Links - Only for Content Creators */}
              {user.role === 'CREATOR' && (
                <div>
                  
                </div>
              )}

              {/* Success Message */}
              {contentCreated && (
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="material-icons text-green-600 dark:text-green-400">check_circle</span>
                    <span className="text-sm font-medium text-green-900 dark:text-green-300">Content Created Successfully!</span>
                  </div>
                  <div className="text-sm text-green-800 dark:text-green-400">
                    {taskData ?
                      'Your assignment content has been created and linked to the task. You can now submit it for review.' :
                      'Your content has been created and is ready for submission. Click "Submit for Review" to send it to your assigned admin for review.'
                    }
                  </div>
                </div>
              )}

              {/* Editor/Preview Split */}
              <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                <div className={`flex flex-col md:flex-row ${isExpanded ? 'h-[calc(100vh-200px)]' : 'h-[600px] md:h-[500px]'}`}>
                  {/* Monaco Editor */}
                  <div className="flex-1 flex flex-col min-h-[300px] md:min-h-0">
                    <div className="bg-gray-50 dark:bg-gray-800 px-4 py-2 border-b border-gray-200 dark:border-gray-700 text-left">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">MARKDOWN EDITOR</span>
                    </div>
                    <div
                      ref={editorRef}
                      className="flex-1 bg-white dark:bg-gray-900"
                      style={{
                        height: '100%',
                        minHeight: '400px',
                        textAlign: 'left',
                        direction: 'ltr'
                      }}
                    />
                  </div>

                  {/* Preview */}
                  <div className="flex-1 flex flex-col border-t md:border-t-0 md:border-l border-gray-200 dark:border-gray-700 min-h-[300px] md:min-h-0">
                    <div className="bg-gray-50 dark:bg-gray-800 px-4 py-2 border-b border-gray-200 dark:border-gray-700 flex-shrink-0 text-left">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">LIVE PREVIEW</span>
                    </div>
                    <div className="flex-1 overflow-auto bg-white dark:bg-gray-900 min-h-0">
                      {content ? (
                        <div className="p-4 text-left max-w-none prose prose-sm dark:prose-invert max-w-none text-gray-900 dark:text-gray-100">
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            rehypePlugins={[rehypeHighlight]}
                            components={MarkdownComponents}
                          >
                            {content}
                          </ReactMarkdown>
                        </div>
                      ) : (
                        <div className="text-gray-500 dark:text-gray-400 text-left py-8 px-4">
                          <div className="text-lg mb-2">Start writing...</div>
                          <div className="text-sm">Your formatted content will appear here as you type.</div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-col sm:flex-row justify-between gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={validateContent}
                    disabled={!content.trim() || isValidating}
                    className="px-4 py-2 bg-purple-600 dark:bg-purple-500 text-white rounded-md hover:bg-purple-700 dark:hover:bg-purple-600 disabled:bg-purple-300 dark:disabled:bg-purple-800 disabled:text-gray-400 transition-colors w-full sm:w-auto"
                  >
                    {isValidating ? 'Validating...' : 'Validate Content'}
                  </button>
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={onBack}
                    className="px-4 py-2 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors w-full sm:w-auto"
                  >
                    {contentCreated ? 'Back to Dashboard' : 'Cancel'}
                  </button>

                  {!contentCreated ? (
                    <button
                      onClick={createContent}
                      disabled={!title.trim() || !content.trim() || isCreating}
                      className="px-4 py-2 bg-indigo-600 dark:bg-indigo-500 text-white rounded-md hover:bg-indigo-700 dark:hover:bg-indigo-600 disabled:bg-indigo-300 dark:disabled:bg-indigo-800 disabled:text-gray-400 transition-colors w-full sm:w-auto"
                    >
                      {isCreating ? 'Creating...' : (taskData?.existingContent ? 'Update Content' : (taskData ? 'Complete Assignment' : 'Create Content'))}
                    </button>
                  ) : (!taskData || contentCreated) ? (
                    <button
                      onClick={submitForReview}
                      disabled={isSubmitting}
                      className="px-4 py-2 bg-green-600 dark:bg-green-500 text-white rounded-md hover:bg-green-700 dark:hover:bg-green-600 disabled:bg-green-300 dark:disabled:bg-green-800 disabled:text-gray-400 transition-colors w-full sm:w-auto"
                    >
                      {isSubmitting ? 'Submitting...' : 'Submit for Review'}
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </div>


      </main>

      {/* Validation Modal */}
      {showValidationModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4 pt-20 pb-4" onClick={() => setShowValidationModal(false)}>
          <div
            className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[70vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between rounded-t-lg flex-shrink-0">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Validation Dashboard</h3>
              <button
                onClick={() => setShowValidationModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              >
                <span className="material-icons">close</span>
              </button>
            </div>

            <div className="px-6 py-6 overflow-y-auto flex-1">
              {isValidating ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <Loader type="file" size="lg" />
                  <p className="mt-4 text-gray-600 dark:text-gray-400 text-lg">Validating your content...</p>
                  <p className="mt-2 text-sm text-gray-500 dark:text-gray-500">This may take a few moments</p>
                </div>
              ) : validationResult ? (
                <div className="space-y-6">
                  {/* Overall Score Card */}
                  <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-6">
                    <div className="flex items-center gap-3 mb-3">
                      <span className="material-icons text-green-600 dark:text-green-400 text-3xl">check_circle</span>
                      <div>
                        <h4 className="font-semibold text-lg text-green-900 dark:text-green-300">Validation Complete</h4>
                        <p className="text-sm text-green-700 dark:text-green-400">
                          Overall Score: <span className="font-bold text-2xl">{validationResult.overallScore || validationResult.overall || 0}/100</span>
                        </p>
                      </div>
                    </div>
                    <div className="text-sm text-green-700 dark:text-green-400 space-y-1">
                      <div>Confidence: {((validationResult.overallConfidence || validationResult.confidence || 0) * 100).toFixed(0)}%</div>
                      <div>Processing Time: {validationResult.processingTime}ms</div>
                      <div>Providers: {validationResult.providers?.join(', ') || 'Dual LLM'}</div>
                    </div>
                  </div>

                  {/* Criteria Breakdown */}
                  <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
                    <h4 className="font-semibold text-lg text-blue-900 dark:text-blue-300 mb-4">Criteria Breakdown</h4>
                    <div className="space-y-4">
                      <div>
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-sm font-medium text-blue-700 dark:text-blue-400">Adherence to Structure</span>
                          <span className="font-semibold text-lg text-blue-900 dark:text-blue-300">{validationResult.criteria.relevance.score}/100</span>
                        </div>
                        <p className="text-xs text-blue-600 dark:text-blue-400">{validationResult.criteria.relevance.feedback}</p>
                      </div>
                      <div>
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-sm font-medium text-blue-700 dark:text-blue-400">Coverage of Topics</span>
                          <span className="font-semibold text-lg text-blue-900 dark:text-blue-300">{validationResult.criteria.continuity.score}/100</span>
                        </div>
                        <p className="text-xs text-blue-600 dark:text-blue-400">{validationResult.criteria.continuity.feedback}</p>
                      </div>
                      <div>
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-sm font-medium text-blue-700 dark:text-blue-400">Ease of Understanding</span>
                          <span className="font-semibold text-lg text-blue-900 dark:text-blue-300">{validationResult.criteria.documentation.score}/100</span>
                        </div>
                        <p className="text-xs text-blue-600 dark:text-blue-400">{validationResult.criteria.documentation.feedback}</p>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>

            {validationResult && (
              <div className="bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 px-6 py-4 rounded-b-lg flex-shrink-0">
                <button
                  onClick={() => setShowValidationModal(false)}
                  className="w-full px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-md transition-colors"
                >
                  Close
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Submit Modal with Guardrail Loader */}
      {showSubmitModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md p-8">
            <div className="flex flex-col items-center justify-center">
              <Loader type="guardrail" size="lg" />
              <p className="mt-6 text-gray-900 dark:text-white text-lg font-semibold">Submitting for Review...</p>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400 text-center">Please wait while we submit your content</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
