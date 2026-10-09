import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import "../styles/chat-answer.css";

export function ChatAnswer({ content, sql }: { content: string; sql?: string | null }) {
  return (
    <div className="aska-answer">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        skipHtml
        components={{
          img: () => null,
          a: ({ node, ...props }) => <a {...props} target="_blank" rel="noopener noreferrer" />,
          table: ({ node, ...props }) => (
            <div className="aska-answer-table" role="region" aria-label="Answer data table" tabIndex={0}>
              <table {...props} />
            </div>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
      {sql && (
        <details className="aska-answer-query">
          <summary>View SQL query</summary>
          <pre><code>{sql}</code></pre>
        </details>
      )}
    </div>
  );
}
