import { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import 'highlight.js/styles/github.css';
import { MarkdownComponents } from '../utils/markdownComponents';
import { apiCall } from '../utils/api';

type GuidelinesTemplate = {
  id: string;
  name: string;
  contentType: 'PRE_READ' | 'ASSIGNMENT' | 'LECTURE_NOTE';
  guidelines: string;
  version: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

type Props = {
  token: string;
  onBack: () => void;
};

export function CreatorGuidelines({ token, onBack }: Props) {
  const [guidelines, setGuidelines] = useState<GuidelinesTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedContentType, setSelectedContentType] = useState<'PRE_READ' | 'ASSIGNMENT' | 'LECTURE_NOTE'>('ASSIGNMENT');

  useEffect(() => {
    fetchGuidelines();
  }, []);

  const fetchGuidelines = async () => {
    try {
      setLoading(true);
      const res = await apiCall('/api/content/guidelines', {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.ok) {
        const data = await res.json();
        setGuidelines(data.guidelines || []);
      } else {
        console.error('Failed to fetch guidelines');
      }
    } catch (error) {
      console.error('Error fetching guidelines:', error);
    } finally {
      setLoading(false);
    }
  };

  const getGuidelinesForContentType = (contentType: string) => {
    return guidelines.find(g => g.contentType === contentType && g.isActive);
  };

  const selectedGuideline = getGuidelinesForContentType(selectedContentType);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 dark:border-purple-400"></div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* Content Type Selector */}
      <div className="mb-6">
        <select
          value={selectedContentType}
          onChange={(e) => setSelectedContentType(e.target.value as 'PRE_READ' | 'ASSIGNMENT' | 'LECTURE_NOTE')}
          className="w-full max-w-xs px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-md focus:ring-2 focus:ring-purple-500 dark:focus:ring-purple-400 focus:border-transparent" style={{ textAlign: 'left' }}
        >
          <option value="ASSIGNMENT">Assignment Guidelines</option>
          <option value="LECTURE_NOTE">Lecture Notes Guidelines</option>
          <option value="PRE_READ">Pre-Read Guidelines</option>
        </select>
      </div>

      {/* Guidelines Content */}
      <div className="bg-white dark:bg-gray-800 shadow-lg dark:shadow-gray-900/50 rounded-lg" style={{ textAlign: 'left' }}>
        {selectedGuideline ? (
          <div className="p-6">
            <div className="flex items-center justify-between mb-4 pb-4 border-b border-gray-200 dark:border-gray-700">
            </div>

            {/* Rendered Markdown Content */}
            <div className="p-4 text-left max-w-none">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeHighlight]}
                components={MarkdownComponents}
              >
                {selectedGuideline.guidelines}
              </ReactMarkdown>
            </div>
          </div>
        ) : (
          <div className="p-6 text-center">
            <div className="text-gray-400 dark:text-gray-500 mb-4">
              <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No Guidelines Available</h3>
            <p className="text-gray-600 dark:text-gray-400">
              No guidelines have been set for {selectedContentType.replace('_', ' ').toLowerCase()} content yet.
              <br />
              Please contact your administrator for more information.
            </p>
          </div>
        )}
      </div>

      {/* Help Section */}
      <div className="mt-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <svg className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <h4 className="text-sm font-medium text-blue-900 dark:text-blue-300 mb-1">How to Use Guidelines</h4>
            <p className="text-sm text-blue-800 dark:text-blue-400">
              These guidelines are set by your administrators to help you create high-quality content.
              Please review the relevant guidelines before creating content of each type.
              The guidelines are automatically applied during the validation process.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
