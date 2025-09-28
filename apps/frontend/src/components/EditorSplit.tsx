import { useRef } from 'react'
// Temporarily disable CodeMirror to resolve runtime issues
// import { EditorView } from '@codemirror/view'
// import { basicSetup } from '@codemirror/basic-setup'
// import { markdown } from '@codemirror/lang-markdown'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import 'highlight.js/styles/github.css'
import { MarkdownComponents } from '../utils/markdownComponents'

type Issue = { start: number; end: number; message: string; severity: 'critical' | 'important' | 'minor' }

type Props = {
  value: string
  onChange: (v: string) => void
  preview?: boolean
  issues?: Issue[]
}

export function EditorSplit({ value, onChange }: Props) {
  // const cmRef = useRef<HTMLDivElement | null>(null)
  // const [cmView, setCmView] = useState<EditorView | null>(null)
  const editorTextareaRef = useRef<HTMLTextAreaElement>(null)
  const previewRef = useRef<HTMLDivElement>(null)

  // useEffect(() => {
  //   if (!cmRef.current || cmView) return
  //   const view = new EditorView({
  //     parent: cmRef.current,
  //     doc: value,
  //     extensions: [basicSetup, markdown(), EditorView.updateListener.of((u) => {
  //       if (u.docChanged) onChange(u.state.doc.toString())
  //     })],
  //   })
  //   setCmView(view)
  //   return () => view.destroy()
  // }, [cmRef.current])

  // useEffect(() => {
  //   if (cmView && cmView.state.doc.toString() !== value) {
  //     cmView.dispatch({
  //       changes: { from: 0, to: cmView.state.doc.length, insert: value },
  //     })
  //   }
  // }, [value, cmView])

  // Note: Issues highlighting could be implemented with textarea overlays if needed
  // For now, we'll focus on consistency with the main ContentCreation editor

  // Synchronized scrolling for split view
  const handleEditorScroll = () => {
    if (editorTextareaRef.current && previewRef.current) {
      const editor = editorTextareaRef.current
      const preview = previewRef.current
      const scrollPercentage = editor.scrollTop / (editor.scrollHeight - editor.clientHeight)
      preview.scrollTop = scrollPercentage * (preview.scrollHeight - preview.clientHeight)
    }
  }

  return (
    <div className="space-y-4">
      {/* Editor Content - Mobile responsive split view */}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <div className="flex flex-col md:flex-row h-[600px] md:h-[400px]">
          {/* Editor Pane */}
          <div className="flex-1 flex flex-col min-h-[300px] md:min-h-0">
            <div className="bg-gray-50 px-4 py-2 border-b border-gray-200 text-center">
              <span className="text-sm font-medium text-gray-700">MARKDOWN EDITOR</span>
            </div>
            <textarea
              ref={editorTextareaRef}
              className="flex-1 p-4 border-none outline-none resize-none font-mono text-sm text-gray-900 placeholder-gray-500"
              placeholder="Start writing your content here..."
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onScroll={handleEditorScroll}
              style={{ 
                textAlign: 'left',
                direction: 'ltr'
              }}
            />
          </div>
          
          {/* Preview Pane */}
          <div ref={previewRef} className="flex-1 flex flex-col border-t md:border-t-0 md:border-l border-gray-200 min-h-[300px] md:min-h-0">
            <div className="bg-gray-50 px-4 py-2 border-b border-gray-200 flex-shrink-0 text-center">
              <span className="text-sm font-medium text-gray-700">LIVE PREVIEW</span>
            </div>
            <div className="flex-1 overflow-auto bg-white min-h-0">
              {value ? (
                <div className="p-4 text-left max-w-none">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    rehypePlugins={[rehypeHighlight]}
                    components={MarkdownComponents}
                  >
                    {value}
                  </ReactMarkdown>
                </div>
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

      {/* <div ref={cmRef} style={{ height: 240, border: '1px solid #eee' }} /> */}
      <style>{`
        .dec-important { background: rgba(234, 179, 8, 0.3); }
        .dec-minor { background: rgba(59, 130, 246, 0.2); }
        .dec-critical { background: rgba(220, 38, 38, 0.3); }
      `}</style>
    </div>
  )
}
