import React, { FunctionComponent } from 'react'
import Highlight, { defaultProps, Language } from 'prism-react-renderer'
import github from 'prism-react-renderer/themes/github'

interface CodeHighlightProps {
  children: string
  language: string
  className: string
}

export const CodeHighlight: FunctionComponent<CodeHighlightProps> = ({ children, language }) => (
  <Highlight {...defaultProps} theme={github} code={children} language={language as Language}>
    {({ className, style, tokens, getLineProps, getTokenProps }) => (
      <>
        <pre className={className} style={style}>
          {tokens.map((line, i) =>
            !line[0].empty ? (
              <div {...getLineProps({ line, key: i })}>
                {line.map((token, key) => (
                  <span {...getTokenProps({ token, key })} />
                ))}
              </div>
            ) : null,
          )}
        </pre>
      </>
    )}
  </Highlight>
)
