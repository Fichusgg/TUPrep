import katex from "katex";
import { Fragment } from "react";

/** Render $inline$ and $$display$$ KaTeX inside a text fragment, plus **bold** and `code`. */
function inline(text: string, key: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  const re = /\$\$([\s\S]+?)\$\$|\$([^$\n]+?)\$|\*\*([^*]+)\*\*|`([^`]+)`/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(<Fragment key={`${key}-t${i++}`}>{text.slice(last, m.index)}</Fragment>);
    if (m[1] !== undefined || m[2] !== undefined) {
      const display = m[1] !== undefined;
      const html = katex.renderToString(display ? m[1] : m[2], { throwOnError: false, displayMode: display });
      out.push(<span key={`${key}-k${i++}`} className={display ? "block overflow-x-auto py-1" : undefined} dangerouslySetInnerHTML={{ __html: html }} />);
    } else if (m[3] !== undefined) {
      out.push(<strong key={`${key}-b${i++}`}>{m[3]}</strong>);
    } else {
      out.push(
        <code key={`${key}-c${i++}`} className="rounded bg-surface-2 px-1 py-0.5 font-mono text-[0.9em]">
          {m[4]}
        </code>,
      );
    }
    last = re.lastIndex;
  }
  if (last < text.length) out.push(<Fragment key={`${key}-t${i++}`}>{text.slice(last)}</Fragment>);
  return out;
}

/**
 * Small Markdown subset used for questions and unit summaries:
 * headings (## / ###), paragraphs, "- " and "• " bullet lists, ``` code fences, line breaks.
 */
export function RichText({ text, className = "" }: { text: string; className?: string }) {
  const blocks: React.ReactNode[] = [];
  text.split(/```/).forEach((chunk, ci) => {
    if (ci % 2 === 1) {
      blocks.push(<CodeBlock key={`c${ci}`} code={chunk.replace(/^\w*\n|\n$/g, "")} />);
      return;
    }
    chunk
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .filter(Boolean)
      .forEach((para, pi) => {
        const key = `p${ci}-${pi}`;
        const lines = para.split("\n");
        const heading = /^(#{2,3})\s+(.*)$/.exec(lines[0]);
        if (heading && lines.length === 1) {
          const H = heading[1].length === 2 ? "h2" : "h3";
          blocks.push(
            <H key={key} className={H === "h2" ? "pt-2 text-lg font-semibold" : "pt-1 font-semibold"}>
              {inline(heading[2], key)}
            </H>,
          );
          return;
        }
        if (lines.every((l) => /^(- |• )/.test(l))) {
          blocks.push(
            <ul key={key} className="list-disc space-y-1.5 pl-5">
              {lines.map((l, li) => (
                <li key={li}>{inline(l.replace(/^(- |• )/, ""), `${key}-${li}`)}</li>
              ))}
            </ul>,
          );
          return;
        }
        blocks.push(
          <p key={key}>
            {lines.map((l, li) => (
              <Fragment key={li}>
                {li > 0 && <br />}
                {inline(l, `${key}-${li}`)}
              </Fragment>
            ))}
          </p>,
        );
      });
  });
  return <div className={`space-y-3 leading-relaxed ${className}`}>{blocks}</div>;
}

export function CodeBlock({ code }: { code: string }) {
  return (
    <pre className="overflow-x-auto rounded-lg border border-line bg-surface-2 p-4 font-mono text-sm leading-relaxed">
      <code>{code}</code>
    </pre>
  );
}

/** Inline-only rendering (for option labels). */
export function Inline({ text }: { text: string }) {
  return <>{inline(text, "i")}</>;
}
