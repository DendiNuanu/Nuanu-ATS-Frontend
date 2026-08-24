import type { ReactNode } from "react";

type FormattedCommentProps = {
  content: string;
  className?: string;
};

/**
 * Safely renders the small Markdown subset commonly returned by AI drafts.
 * React escapes all source text; no raw HTML or dangerouslySetInnerHTML is used.
 */
export function FormattedComment({ content, className = "" }: FormattedCommentProps) {
  const blocks = parseBlocks(content);

  return (
    <div className={`space-y-2 text-sm leading-6 text-slate-700 ${className}`.trim()}>
      {blocks.map((block, index) => {
        if (block.type === "list") {
          return (
            <ul key={index} className="list-disc space-y-1 pl-5">
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex}>{renderInline(item)}</li>
              ))}
            </ul>
          );
        }

        if (block.type === "heading") {
          return (
            <p key={index} className="font-semibold text-slate-900">
              {renderInline(block.content)}
            </p>
          );
        }

        return <p key={index}>{renderInline(block.content)}</p>;
      })}
    </div>
  );
}

type Block =
  | { type: "paragraph" | "heading"; content: string }
  | { type: "list"; items: string[] };

function parseBlocks(content: string): Block[] {
  const blocks: Block[] = [];
  const lines = content.replace(/\r\n?/g, "\n").split("\n");
  let paragraph: string[] = [];
  let listItems: string[] = [];

  const flushParagraph = () => {
    if (!paragraph.length) return;
    blocks.push({ type: "paragraph", content: paragraph.join("\n") });
    paragraph = [];
  };

  const flushList = () => {
    if (!listItems.length) return;
    blocks.push({ type: "list", items: listItems });
    listItems = [];
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    const listMatch = line.match(/^(?:[-*•]|\d+\.)\s+(.+)$/);
    const headingMatch = line.match(/^#{1,6}\s+(.+)$/);
    const boldHeadingMatch = line.match(/^\*\*(.+)\*\*:?$/);

    if (!line) {
      flushParagraph();
      flushList();
    } else if (listMatch) {
      flushParagraph();
      listItems.push(listMatch[1]);
    } else if (headingMatch || boldHeadingMatch) {
      flushParagraph();
      flushList();
      blocks.push({
        type: "heading",
        content: (headingMatch?.[1] ?? boldHeadingMatch?.[1] ?? "").trim(),
      });
    } else {
      flushList();
      paragraph.push(line);
    }
  }

  flushParagraph();
  flushList();
  return blocks;
}

function renderInline(content: string): ReactNode[] {
  return content.split(/(\*\*[^*]+\*\*)/g).map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }

    return part.split("\n").map((line, lineIndex, lines) => (
      <span key={`${index}-${lineIndex}`}>
        {line}
        {lineIndex < lines.length - 1 ? <br /> : null}
      </span>
    ));
  });
}
