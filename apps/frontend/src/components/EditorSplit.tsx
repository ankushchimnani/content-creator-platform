import { useEffect, useRef, useState } from 'react'
import Editor, { type OnMount } from '@monaco-editor/react'
// Temporarily disable CodeMirror to resolve runtime issues
// import { EditorView } from '@codemirror/view'
// import { basicSetup } from '@codemirror/basic-setup'
// import { markdown } from '@codemirror/lang-markdown'
import { marked } from 'marked'

type Issue = { start: number; end: number; message: string; severity: 'critical' | 'important' | 'minor' }

type Props = {
  value: string
  onChange: (v: string) => void
  preview?: boolean
  issues?: Issue[]
}

type EditorMode = 'visual' | 'markdown'

export function EditorSplit({ value, onChange, issues = [] }: Props) {
  // const cmRef = useRef<HTMLDivElement | null>(null)
  // const [cmView, setCmView] = useState<EditorView | null>(null)
  const monacoRef = useRef<Parameters<OnMount>[0] | null>(null)
  const monacoNsRef = useRef<Parameters<OnMount>[1] | null>(null)
  const [editorMode, setEditorMode] = useState<EditorMode>('visual')
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

  // Apply Monaco inline decorations when issues change
  useEffect(() => {
    const editor = monacoRef.current
    const monaco = monacoNsRef.current
    if (!editor || !monaco) return

    const model = editor.getModel()
    if (!model) return

    const decos = issues.map((iss) => {
      const startPos = model.getPositionAt(Math.max(0, Math.min(value.length, iss.start)))
      const endPos = model.getPositionAt(Math.max(0, Math.min(value.length, iss.end)))
      return {
        range: new monaco.Range(startPos.lineNumber, startPos.column, endPos.lineNumber, endPos.column),
        options: {
          inlineClassName: iss.severity === 'critical' ? 'dec-critical' : iss.severity === 'important' ? 'dec-important' : 'dec-minor',
          hoverMessage: { value: iss.message },
        },
      }
    })
    editor.deltaDecorations([], decos as any)
  }, [issues, value])

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
      {/* Editor Mode Tabs */}
      <div className="flex space-x-1 border-b border-gray-200">
        <button
          className={`px-4 py-2 text-sm font-medium border-b-2 ${
            editorMode === 'visual'
              ? 'text-blue-600 border-blue-600'
              : 'text-gray-500 border-transparent hover:text-gray-700'
          }`}
          onClick={() => setEditorMode('visual')}
        >
          <svg className="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
          </svg>
          Visual
        </button>
        <button
          className={`px-4 py-2 text-sm font-medium border-b-2 ${
            editorMode === 'markdown'
              ? 'text-blue-600 border-blue-600'
              : 'text-gray-500 border-transparent hover:text-gray-700'
          }`}
          onClick={() => setEditorMode('markdown')}
        >
          <svg className="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
          </svg>
          Markdown
        </button>
      </div>

      {/* Editor Content */}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        {editorMode === 'visual' ? (
          // Visual Editor with Split View
          <div className="grid grid-cols-2 h-[400px]">
            {/* Editor Pane */}
            <div className="border-r border-gray-200 bg-white">
              <div className="px-4 py-2 bg-gray-50 border-b border-gray-200">
                <span className="text-xs font-medium text-gray-600">EDITOR</span>
              </div>
              <textarea
                ref={editorTextareaRef}
                className="w-full h-full p-4 border-none outline-none resize-none font-mono text-sm text-gray-900 placeholder-gray-500"
                placeholder="Start writing your content here..."
                value={value}
                onChange={(e) => onChange(e.target.value)}
                onScroll={handleEditorScroll}
                style={{ height: 'calc(100% - 40px)' }}
              />
            </div>
            
            {/* Preview Pane */}
            <div ref={previewRef} className="bg-white overflow-auto">
              <div className="px-4 py-2 bg-gray-50 border-b border-gray-200">
                <span className="text-xs font-medium text-gray-600">PREVIEW</span>
              </div>
              <div className="p-4 prose prose-sm prose-gray max-w-none">
                <div dangerouslySetInnerHTML={{ 
                  __html: marked.parse(value || '# Start writing...\n\nYour formatted content will appear here.\n\n## Features\n- Real-time preview\n- Synchronized scrolling\n- Clean typography\n\nStart typing in the editor to see your content formatted!') as string 
                }} />
              </div>
            </div>
          </div>
        ) : (
          // Markdown Editor
          <div style={{ height: 400 }}>
            <Editor
              height="100%"
              defaultLanguage="markdown"
              value={value}
              onChange={(v?: string) => onChange(v || '')}
              options={{ 
                minimap: { enabled: false },
                fontSize: 14,
                lineNumbers: 'on',
                wordWrap: 'on',
                padding: { top: 16, bottom: 16 }
              }}
              onMount={(editor: Parameters<OnMount>[0], monaco: Parameters<OnMount>[1]) => {
                monacoRef.current = editor
                monacoNsRef.current = monaco
              }}
              theme="vs-light"
            />
          </div>
        )}
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
