import cx from 'classnames'

type Props = {
  result: {
    overallScore: number
    overallConfidence?: number
    providers?: string[]
    processingTime?: number
    assignmentContext?: {
      topic: string
      prerequisiteTopics: string[]
      hasGuidelines: boolean
      guidelines?: string
    } | null
    criteria: {
      relevance: { score: number; confidence?: number; feedback: string; suggestions?: string[] }
      continuity: { score: number; confidence?: number; feedback: string; suggestions?: string[] }
      documentation: { score: number; confidence?: number; feedback: string; suggestions?: string[]; issues?: { start: number; end: number; message: string; severity: 'critical' | 'important' | 'minor' }[] }
    }
  } | null
  onValidate?: () => void
  isValidating?: boolean
  validationError?: string | null
}

function band(score: number) {
  if (score > 85) return 'green'
  if (score >= 70) return 'yellow'
  return 'red'
}

export function ResultsPanel({ result, onValidate, isValidating, validationError }: Props) {
  if (!result && !isValidating && !validationError) {
    return (
      <div className="bg-white p-4 rounded-lg shadow-sm flex flex-col gap-4">
        <h2 className="text-lg font-semibold">Validation Dashboard</h2>
        
        <div className="border-2 border-dashed border-gray-200 rounded-lg p-6 text-center">
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-gray-100 mb-3">
            <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-sm text-gray-600">Write content and click "Validate Content" to see results</p>
        </div>
        
        <button 
          onClick={onValidate}
          disabled={isValidating}
          className="w-full bg-gray-800 text-white px-4 py-2 rounded-md text-sm font-medium flex items-center justify-center gap-2 hover:bg-gray-700 disabled:bg-gray-400 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Validate Content
        </button>
        
        <div className="flex justify-between items-center border-t border-gray-200 pt-4">
          <span className="text-sm font-medium">Real-time Preview</span>
          <button className="bg-gray-200 relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2">
            <span className="sr-only">Use setting</span>
            <span className="translate-x-0 pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out"></span>
          </button>
        </div>
      </div>
    )
  }

  if (isValidating) {
    return (
      <div className="space-y-6">
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold mb-4">Validation Dashboard</h2>
          <div className="text-center py-8">
            <div className="animate-spin w-12 h-12 mx-auto mb-4 text-blue-600">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </div>
            <p className="text-blue-600 font-medium mb-2">Validating Content...</p>
            <p className="text-gray-500 text-sm">Running dual-LLM analysis for comprehensive validation</p>
            <div className="mt-4 bg-gray-100 rounded-full h-2">
              <div className="bg-blue-600 h-2 rounded-full animate-pulse" style={{ width: '60%' }}></div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (validationError) {
    return (
      <div className="space-y-6">
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 shadow-sm">
          <h2 className="text-lg font-semibold mb-4 text-red-800">Validation Error</h2>
          <div className="text-center py-4">
            <div className="text-red-500 mb-2">
              <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <p className="text-red-700 font-medium mb-1">Validation Failed</p>
            <p className="text-red-600 text-sm">{validationError}</p>
          </div>
          
          <button 
            onClick={onValidate}
            className="w-full bg-red-600 hover:bg-red-700 text-white font-medium py-3 px-4 rounded-lg transition-colors duration-200 flex items-center justify-center gap-2 mt-4"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Try Again
          </button>
        </div>
      </div>
    )
  }
  
  const { overallScore, providers, criteria, overallConfidence, processingTime } = result
  const qualityLabel = overallScore > 85 ? 'Good' : overallScore >= 70 ? 'Fair' : 'Needs work'
  const qualityColor = overallScore > 85 ? 'text-green-600' : overallScore >= 70 ? 'text-yellow-600' : 'text-red-600'

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="rounded-lg border border-gray-200 bg-white p-4 sm:p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-2">
          <h2 className="text-base sm:text-lg font-semibold">Validation Dashboard</h2>
          {processingTime && (
            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
              {(processingTime / 1000).toFixed(1)}s
            </span>
          )}
        </div>
        
        {/* Dual LLM Provider Info */}
        {providers && providers.length > 0 && (
          <div className="mb-6 p-3 bg-blue-50 rounded-lg border border-blue-200">
            <div className="flex items-center gap-2 mb-2">
              <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              <span className="text-sm font-medium text-blue-800">Dual-LLM Analysis</span>
            </div>
            <p className="text-xs text-blue-700">
              Validated using {providers.length} LLM provider{providers.length > 1 ? 's' : ''}: {providers.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(', ')}
            </p>
          </div>
        )}

        {/* Assignment Context Display */}
        {result.assignmentContext && (
          <div className="mb-6 p-4 bg-purple-50 border border-purple-200 rounded-lg">
            <div className="flex items-center gap-2 mb-3">
              <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <h3 className="font-medium text-purple-900">Assignment-Based Validation</h3>
            </div>
            
            <div className="space-y-2 text-sm">
              <div>
                <span className="font-medium text-purple-800">Topic:</span>
                <span className="ml-2 text-purple-700">{result.assignmentContext.topic}</span>
              </div>
              
              {result.assignmentContext.prerequisiteTopics.length > 0 && (
                <div>
                  <span className="font-medium text-purple-800">Prerequisites:</span>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {result.assignmentContext.prerequisiteTopics.map((topic, index) => (
                      <span key={index} className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs">
                        {topic}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              
              {result.assignmentContext.hasGuidelines && (
                <div className="flex items-center gap-1 text-purple-700">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-xs">Specific guidelines applied</span>
                </div>
              )}
            </div>
          </div>
        )}
        
        <div className="mb-6">
          <div className="text-sm font-medium text-gray-700 mb-2">Overall Quality</div>
          <div className="flex items-center gap-3">
            <span className={cx('inline-block h-3 w-3 rounded-full', overallScore > 85 ? 'bg-green-500' : overallScore >= 70 ? 'bg-yellow-500' : 'bg-red-500')} />
            <div className={cx('text-lg font-semibold', qualityColor)}>{qualityLabel}</div>
            <div className="text-sm text-gray-600">({overallScore}%)</div>
            {overallConfidence !== undefined && (
              <div className="ml-auto text-sm text-gray-500">
                <span className="bg-gray-100 px-2 py-1 rounded text-xs">
                  Consensus {(overallConfidence * 100).toFixed(0)}%
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="mb-6">
          <div className="text-sm font-medium text-gray-700 mb-3">Detailed Breakdown</div>
          <div className="space-y-6">
            {([
              ['Relevance', criteria.relevance, 'How well the content aligns with the provided topics and requirements'],
              ['Knowledge Continuity', criteria.continuity, 'Logical flow and progression of concepts in the content'],
              ['Documentation Compliance', criteria.documentation, 'Adherence to formatting and documentation standards'],
            ] as const).map(([label, item, description]) => (
              <div key={label} className="border border-gray-100 rounded-lg p-4 bg-gray-50">
                <div className="flex items-center justify-between text-sm text-gray-700 mb-2">
                  <div>
                    <span className="font-medium text-gray-900">{label}</span>
                    <p className="text-xs text-gray-500 mt-1">{description}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-semibold text-gray-900">{item.score}%</span>
                    {item.confidence !== undefined && (
                      <div className="text-xs text-gray-500">
                        Agreement {Math.round(item.confidence * 100)}%
                      </div>
                    )}
                  </div>
                </div>
                <div className="h-2 w-full rounded-full bg-gray-200 mb-3">
                  <div 
                    className={cx('h-2 rounded-full transition-all duration-300', 
                      item.score > 85 ? 'bg-green-500' : 
                      item.score >= 70 ? 'bg-yellow-500' : 'bg-red-500'
                    )} 
                    style={{ width: `${item.score}%` }} 
                  />
                </div>
                {item.feedback && (
                  <div className="bg-white rounded border border-gray-200 p-3">
                    <div className="text-xs font-medium text-gray-600 mb-1">LLM Feedback</div>
                    <p className="text-sm text-gray-700">{item.feedback}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="mb-6">
          <div className="text-sm font-medium text-gray-700 mb-3">Actionable Suggestions</div>
          <div className="space-y-3">
            {/* Collect all suggestions from all criteria */}
            {(() => {
              const allSuggestions = [
                ...(criteria.relevance.suggestions || []),
                ...(criteria.continuity.suggestions || []),
                ...(criteria.documentation.suggestions || []),
                ...(criteria.documentation.issues?.map(iss => iss.message) || [])
              ].filter(Boolean).slice(0, 5);

              if (allSuggestions.length === 0) {
                return (
                  <div className="text-center py-6">
                    <svg className="w-12 h-12 text-green-400 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-green-600 font-medium mb-1">Great work!</p>
                    <p className="text-gray-500 text-sm">Your content meets the validation criteria well.</p>
                  </div>
                );
              }

              return allSuggestions.map((suggestion, i) => (
                <div key={i} className="flex items-start gap-3 p-3 rounded-lg border border-blue-100 bg-blue-50">
                  <div className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center mt-0.5">
                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <p className="text-sm text-blue-900">{suggestion}</p>
                </div>
              ));
            })()}
          </div>
        </div>

        <div className="mb-6">
          <button 
            onClick={onValidate}
            disabled={isValidating}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium py-3 px-4 rounded-lg transition-colors duration-200 flex items-center justify-center gap-2"
          >
            {isValidating ? (
              <>
                <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full"></div>
                Validating...
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Re-validate Content
              </>
            )}
          </button>
        </div>

        <div className="flex items-center justify-between">
          <label className="text-sm text-gray-600">Real-time Preview</label>
          <div className="relative inline-block w-10 mr-2 align-middle select-none transition duration-200 ease-in">
            <input type="checkbox" name="toggle" id="toggle" className="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer"/>
            <label htmlFor="toggle" className="toggle-label block overflow-hidden h-6 rounded-full bg-gray-300 cursor-pointer"></label>
          </div>
        </div>
      </div>
    </div>
  )
}


