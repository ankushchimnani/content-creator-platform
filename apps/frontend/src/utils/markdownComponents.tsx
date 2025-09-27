import React from 'react';

// Custom components for react-markdown with better responsive design
export const MarkdownComponents = {
  // Headings with proper hierarchy and mobile responsiveness
  h1: ({children, ...props}: any) => (
    <h1 className="text-xl md:text-2xl font-bold text-gray-900 mb-3 md:mb-4 mt-4 md:mt-6 pb-2 border-b-2 border-blue-200" {...props}>
      {children}
    </h1>
  ),
  h2: ({children, ...props}: any) => (
    <h2 className="text-lg md:text-xl font-semibold text-gray-800 mb-2 md:mb-3 mt-4 md:mt-5 px-2 md:px-3 py-2 bg-blue-50 rounded-lg border-l-4 border-blue-400" {...props}>
      {children}
    </h2>
  ),
  h3: ({children, ...props}: any) => (
    <h3 className="text-base md:text-lg font-medium text-gray-700 mb-2 mt-3 md:mt-4" {...props}>
      {children}
    </h3>
  ),
  
  // Paragraphs with proper spacing
  p: ({children, ...props}: any) => (
    <p className="text-gray-700 leading-relaxed mb-3 text-left" {...props}>
      {children}
    </p>
  ),
  
  // Lists with proper bullets
  ul: ({children, ...props}: any) => (
    <ul className="mb-4 ml-6 space-y-1 list-disc list-outside" {...props}>
      {children}
    </ul>
  ),
  ol: ({children, ...props}: any) => (
    <ol className="mb-4 ml-6 space-y-1 list-decimal list-outside" {...props}>
      {children}
    </ol>
  ),
  li: ({children, ...props}: any) => (
    <li className="text-gray-700 leading-relaxed pl-1" {...props}>
      {children}
    </li>
  ),
  
  // Enhanced text formatting
  strong: ({children, ...props}: any) => (
    <strong className="font-semibold text-gray-900" {...props}>
      {children}
    </strong>
  ),
  em: ({children, ...props}: any) => (
    <em className="italic text-gray-600" {...props}>
      {children}
    </em>
  ),
  
  // Better code handling - no horizontal scroll, proper wrapping
  code: ({inline, children, ...props}: any) => {
    if (inline) {
      return (
        <code className="bg-gray-100 text-gray-800 px-2 py-1 rounded text-sm font-mono border break-words" {...props}>
          {children}
        </code>
      );
    }
    return (
      <code className="block bg-gray-900 text-gray-100 p-4 rounded-lg mb-4 border font-mono text-sm whitespace-pre-wrap break-words overflow-hidden" {...props}>
        {children}
      </code>
    );
  },
  
  // Responsive tables - stack on mobile
  table: ({children, ...props}: any) => (
    <div className="mb-4 overflow-hidden">
      <div className="hidden md:block">
        <table className="w-full border-collapse border border-gray-300" {...props}>
          {children}
        </table>
      </div>
      <div className="md:hidden">
        <div className="bg-gray-50 p-3 rounded border border-gray-300 text-sm text-gray-600">
          📱 Table content - best viewed on desktop
        </div>
      </div>
    </div>
  ),
  th: ({children, ...props}: any) => (
    <th className="border border-gray-300 bg-gray-100 px-3 py-2 text-left font-semibold text-gray-800" {...props}>
      {children}
    </th>
  ),
  td: ({children, ...props}: any) => (
    <td className="border border-gray-300 px-3 py-2 text-gray-700" {...props}>
      {children}
    </td>
  ),
  
  // Better blockquotes
  blockquote: ({children, ...props}: any) => (
    <blockquote className="border-l-4 border-blue-400 bg-blue-50 pl-4 py-2 my-4 italic text-gray-600" {...props}>
      {children}
    </blockquote>
  ),
  
  // Styled horizontal rules
  hr: ({...props}: any) => (
    <hr className="my-6 border-0 h-1 bg-gradient-to-r from-blue-200 via-purple-200 to-blue-200 rounded" {...props} />
  ),
  
  // Better links
  a: ({children, href, ...props}: any) => (
    <a 
      href={href} 
      target="_blank" 
      rel="noopener noreferrer" 
      className="text-blue-600 hover:text-blue-800 underline break-words"
      {...props}
    >
      {children}
    </a>
  ),
};
