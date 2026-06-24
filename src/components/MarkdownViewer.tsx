import Markdown from "react-markdown";

interface MarkdownViewerProps {
  content: string;
}

export default function MarkdownViewer({ content }: MarkdownViewerProps) {
  if (!content) {
    return <span className="text-gray-500 italic">No content provided.</span>;
  }
  return (
    <div className="markdown-body">
      <Markdown>{content}</Markdown>
    </div>
  );
}
