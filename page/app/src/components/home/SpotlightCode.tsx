import React, { useState } from 'react';

const codeSnippets = [
  {
    id: 'init',
    lines: [
      { text: '$ ', color: 'text-primary' },
      { text: 'npx codependence init', color: 'text-base-content' },
      { text: '\n\n', color: '' },
      { text: 'Creating .codependencerc...', color: 'text-base-content/70' },
      { text: '\n', color: '' },
      { text: '✓', color: 'text-success' },
      { text: ' Configuration file created', color: 'text-base-content' }
    ]
  },
  {
    id: 'config',
    lines: [
      { text: '// .codependencerc', color: 'text-base-content/50' },
      { text: '\n{\n  ', color: 'text-base-content' },
      { text: '"codependencies"', color: 'text-primary' },
      { text: ': {\n    ', color: 'text-base-content' },
      { text: '"react"', color: 'text-primary' },
      { text: ': ', color: 'text-base-content' },
      { text: '"^18.0.0"', color: 'text-success' },
      { text: ',\n    ', color: 'text-base-content' },
      { text: '"typescript"', color: 'text-primary' },
      { text: ': ', color: 'text-base-content' },
      { text: '"^5.0.0"', color: 'text-success' },
      { text: ',\n    ', color: 'text-base-content' },
      { text: '"eslint"', color: 'text-primary' },
      { text: ': ', color: 'text-base-content' },
      { text: '"^8.0.0"', color: 'text-success' },
      { text: ',\n    ', color: 'text-base-content' },
      { text: '"prettier"', color: 'text-primary' },
      { text: ': ', color: 'text-base-content' },
      { text: '"^3.0.0"', color: 'text-success' },
      { text: '\n  }\n}', color: 'text-base-content' }
    ]
  },
  {
    id: 'check',
    lines: [
      { text: '$ ', color: 'text-primary' },
      { text: 'npx codependence', color: 'text-base-content' },
      { text: '\n\n', color: '' },
      { text: 'Checking codependencies...', color: 'text-base-content/70' },
      { text: '\n', color: '' },
      { text: '✓', color: 'text-success' },
      { text: ' react@', color: 'text-base-content' },
      { text: '18.2.0', color: 'text-info' },
      { text: ' matches ', color: 'text-base-content' },
      { text: '^18.0.0', color: 'text-success' },
      { text: '\n', color: '' },
      { text: '✓', color: 'text-success' },
      { text: ' typescript@', color: 'text-base-content' },
      { text: '5.3.3', color: 'text-info' },
      { text: ' matches ', color: 'text-base-content' },
      { text: '^5.0.0', color: 'text-success' },
      { text: '\n', color: '' },
      { text: '✗', color: 'text-error' },
      { text: ' eslint@', color: 'text-base-content' },
      { text: '7.32.0', color: 'text-info' },
      { text: ' does not match ', color: 'text-base-content' },
      { text: '^8.0.0', color: 'text-error' },
      { text: '\n', color: '' },
      { text: '✗', color: 'text-error' },
      { text: ' prettier@', color: 'text-base-content' },
      { text: '2.8.8', color: 'text-info' },
      { text: ' does not match ', color: 'text-base-content' },
      { text: '^3.0.0', color: 'text-error' }
    ]
  },
  {
    id: 'update',
    lines: [
      { text: '$ ', color: 'text-primary' },
      { text: 'npx codependence --update', color: 'text-base-content' },
      { text: '\n\n', color: '' },
      { text: 'Updating mismatched dependencies...', color: 'text-base-content/70' },
      { text: '\n', color: '' },
      { text: '⟳', color: 'text-info' },
      { text: ' Updating ', color: 'text-base-content' },
      { text: 'eslint', color: 'text-warning' },
      { text: ' from ', color: 'text-base-content' },
      { text: '7.32.0', color: 'text-error' },
      { text: ' to ', color: 'text-base-content' },
      { text: '8.57.0', color: 'text-success' },
      { text: '...', color: 'text-base-content/70' },
      { text: '\n', color: '' },
      { text: '⟳', color: 'text-info' },
      { text: ' Updating ', color: 'text-base-content' },
      { text: 'prettier', color: 'text-warning' },
      { text: ' from ', color: 'text-base-content' },
      { text: '2.8.8', color: 'text-error' },
      { text: ' to ', color: 'text-base-content' },
      { text: '3.2.5', color: 'text-success' },
      { text: '...', color: 'text-base-content/70' },
      { text: '\n', color: '' },
      { text: '✓', color: 'text-success' },
      { text: ' All codependencies updated successfully!', color: 'text-base-content' }
    ]
  }
];

export default function SpotlightCode() {
  const [activeIndex, setActiveIndex] = useState(0);

  return (
    <div className="w-full max-w-3xl mt-10 xl:mt-0">
      {/* Single terminal window */}
      <div className="relative overflow-hidden rounded-lg bg-white dark:bg-gray-900 border border-base-content/20">
        {/* Terminal header with dots */}
        <div className="bg-gray-100 dark:bg-gray-800 px-4 py-3 flex items-center gap-2">
          <div className="flex gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500"></div>
            <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
          </div>
        </div>
        
        {/* Terminal content */}
        <div className="bg-white dark:bg-gray-900 p-6 space-y-6 min-h-[500px]">
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