import React, { useState } from 'react';

const codeSnippets = [
  {
    id: 'init',
    lines: [
      { text: '$ ', color: 'text-green-400' },
      { text: 'npx codependence init', color: 'text-gray-300' },
      { text: '\n\n', color: '' },
      { text: 'Creating .codependencerc...', color: 'text-gray-400' },
      { text: '\n', color: '' },
      { text: '✓', color: 'text-green-400' },
      { text: ' Configuration file created', color: 'text-gray-300' }
    ]
  },
  {
    id: 'config',
    lines: [
      { text: '// .codependencerc', color: 'text-gray-500' },
      { text: '\n{\n  ', color: 'text-gray-300' },
      { text: '"codependencies"', color: 'text-blue-400' },
      { text: ': {\n    ', color: 'text-gray-300' },
      { text: '"react"', color: 'text-blue-400' },
      { text: ': ', color: 'text-gray-300' },
      { text: '"^18.0.0"', color: 'text-green-400' },
      { text: ',\n    ', color: 'text-gray-300' },
      { text: '"typescript"', color: 'text-blue-400' },
      { text: ': ', color: 'text-gray-300' },
      { text: '"^5.0.0"', color: 'text-green-400' },
      { text: ',\n    ', color: 'text-gray-300' },
      { text: '"eslint"', color: 'text-blue-400' },
      { text: ': ', color: 'text-gray-300' },
      { text: '"^8.0.0"', color: 'text-green-400' },
      { text: ',\n    ', color: 'text-gray-300' },
      { text: '"prettier"', color: 'text-blue-400' },
      { text: ': ', color: 'text-gray-300' },
      { text: '"^3.0.0"', color: 'text-green-400' },
      { text: '\n  }\n}', color: 'text-gray-300' }
    ]
  },
  {
    id: 'check',
    lines: [
      { text: '$ ', color: 'text-green-400' },
      { text: 'npx codependence', color: 'text-gray-300' },
      { text: '\n\n', color: '' },
      { text: 'Checking codependencies...', color: 'text-gray-400' },
      { text: '\n', color: '' },
      { text: '✓', color: 'text-green-400' },
      { text: ' react@', color: 'text-gray-300' },
      { text: '18.2.0', color: 'text-cyan-400' },
      { text: ' matches ', color: 'text-gray-300' },
      { text: '^18.0.0', color: 'text-green-400' },
      { text: '\n', color: '' },
      { text: '✓', color: 'text-green-400' },
      { text: ' typescript@', color: 'text-gray-300' },
      { text: '5.3.3', color: 'text-cyan-400' },
      { text: ' matches ', color: 'text-gray-300' },
      { text: '^5.0.0', color: 'text-green-400' },
      { text: '\n', color: '' },
      { text: '✗', color: 'text-red-400' },
      { text: ' eslint@', color: 'text-gray-300' },
      { text: '7.32.0', color: 'text-cyan-400' },
      { text: ' does not match ', color: 'text-gray-300' },
      { text: '^8.0.0', color: 'text-red-400' },
      { text: '\n', color: '' },
      { text: '✗', color: 'text-red-400' },
      { text: ' prettier@', color: 'text-gray-300' },
      { text: '2.8.8', color: 'text-cyan-400' },
      { text: ' does not match ', color: 'text-gray-300' },
      { text: '^3.0.0', color: 'text-red-400' }
    ]
  },
  {
    id: 'update',
    lines: [
      { text: '$ ', color: 'text-green-400' },
      { text: 'npx codependence --update', color: 'text-gray-300' },
      { text: '\n\n', color: '' },
      { text: 'Updating mismatched dependencies...', color: 'text-gray-400' },
      { text: '\n', color: '' },
      { text: '⟳', color: 'text-blue-400' },
      { text: ' Updating ', color: 'text-gray-300' },
      { text: 'eslint', color: 'text-yellow-400' },
      { text: ' from ', color: 'text-gray-300' },
      { text: '7.32.0', color: 'text-red-400' },
      { text: ' to ', color: 'text-gray-300' },
      { text: '8.57.0', color: 'text-green-400' },
      { text: '...', color: 'text-gray-400' },
      { text: '\n', color: '' },
      { text: '⟳', color: 'text-blue-400' },
      { text: ' Updating ', color: 'text-gray-300' },
      { text: 'prettier', color: 'text-yellow-400' },
      { text: ' from ', color: 'text-gray-300' },
      { text: '2.8.8', color: 'text-red-400' },
      { text: ' to ', color: 'text-gray-300' },
      { text: '3.2.5', color: 'text-green-400' },
      { text: '...', color: 'text-gray-400' },
      { text: '\n', color: '' },
      { text: '✓', color: 'text-green-400' },
      { text: ' All codependencies updated successfully!', color: 'text-gray-300' }
    ]
  }
];

export default function SpotlightCode() {
  const [activeIndex, setActiveIndex] = useState(0);

  return (
    <div className="w-full max-w-3xl mt-10 xl:mt-0">
      {/* Single terminal window */}
      <div className="relative overflow-hidden rounded-lg bg-gray-900 border border-base-content/20">
        {/* Terminal header with dots */}
        <div className="bg-gray-800 px-4 py-3 flex items-center gap-2">
          <div className="flex gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500"></div>
            <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
          </div>
        </div>
        
        {/* Terminal content */}
        <div className="bg-gray-900 p-6 space-y-6 min-h-[500px]">
          {codeSnippets.map((snippet, index) => (
            <div
              key={snippet.id}
              onMouseEnter={() => setActiveIndex(index)}
              className="relative cursor-pointer"
            >
              {/* Subtle glow effect for active snippet */}
              <div
                className={`absolute -inset-2 transition-opacity duration-300 ${
                  activeIndex === index ? 'opacity-100' : 'opacity-0'
                }`}
                style={{
                  background: 'radial-gradient(circle at center, hsl(var(--p) / 0.05), transparent 70%)',
                }}
              />
              
              <pre className="text-sm font-mono relative">
                <code>
                  {snippet.lines.map((line, lineIndex) => (
                    <span 
                      key={lineIndex} 
                      className={`transition-all duration-300 ${
                        activeIndex === index 
                          ? line.color || 'text-base-content' 
                          : 'text-base-content/40'
                      }`}
                    >
                      {line.text}
                    </span>
                  ))}
                </code>
              </pre>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}