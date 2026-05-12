import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import remarkBreaks from "remark-breaks";

export const zernixMarkdownComponents: Components = {
  h1: ({ children }) => (
    <h1 className="mb-3 border-b border-gold/25 pb-2 font-serif text-lg tracking-wide text-gold lg:text-xl">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="mt-5 border-b border-gold/15 pb-1.5 font-serif text-base text-gold/95 first:mt-0 lg:text-lg">{children}</h2>
  ),
  h3: ({ children }) => <h3 className="mt-3 font-serif text-sm text-gold/90 lg:text-base">{children}</h3>,
  h4: ({ children }) => <h4 className="mt-2 font-serif text-[13px] text-gold/85 lg:text-sm">{children}</h4>,
  hr: () => <hr className="my-4 border-0 border-t border-gold/25" />,
  p: ({ children }) => (
    <p className="my-2 text-[13px] leading-relaxed text-zinc-200 first:mt-0 last:mb-0 [&+ul]:mt-2">{children}</p>
  ),
  ul: ({ children }) => (
    <ul className="my-3 list-disc space-y-1.5 pl-5 text-[13px] leading-relaxed text-zinc-200 marker:text-gold/45">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="my-3 list-decimal space-y-1.5 pl-5 text-[13px] leading-relaxed text-zinc-200 marker:text-gold/45">{children}</ol>
  ),
  li: ({ children }) => <li className="[&>p]:my-1">{children}</li>,
  strong: ({ children }) => <strong className="font-semibold text-gold/95">{children}</strong>,
  em: ({ children }) => <em className="italic text-zinc-400">{children}</em>,
  a: ({ children, href }) => (
    <a
      href={href}
      className="text-gold underline decoration-gold/40 underline-offset-2 transition hover:text-gold/80"
      target="_blank"
      rel="noreferrer noopener"
    >
      {children}
    </a>
  ),
  code: ({ children }) => (
    <code className="rounded bg-black/50 px-1 py-0.5 font-mono text-[12px] text-gold/90">{children}</code>
  ),
  blockquote: ({ children }) => (
    <blockquote className="my-3 border-l-2 border-gold/35 pl-3 text-[13px] italic text-zinc-400">{children}</blockquote>
  ),
  table: ({ children }) => (
    <div className="my-4 max-w-full overflow-x-auto rounded-lg border border-gold/22">
      <table className="w-full min-w-[260px] border-collapse text-left text-[12px]">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="[&_th]:whitespace-nowrap">{children}</thead>,
  tbody: ({ children }) => <tbody className="[&_tr:nth-child(even)_td]:bg-black/25">{children}</tbody>,
  tr: ({ children }) => <tr>{children}</tr>,
  th: ({ children }) => (
    <th className="border border-gold/25 bg-black/50 px-2.5 py-2 font-serif text-[11px] font-semibold uppercase tracking-wide text-gold/90">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="border border-gold/15 px-2.5 py-2 align-top text-zinc-200">{children}</td>
  ),
};

export function ZernixMarkdownBody({ markdown, className = "" }: { markdown: string; className?: string }) {
  return (
    <article className={`loot-result-md selection:bg-gold/25 [&>*:first-child]:mt-0 ${className}`.trim()}>
      <ReactMarkdown
        remarkPlugins={[remarkBreaks]}
        rehypePlugins={[rehypeRaw]}
        components={zernixMarkdownComponents}
      >
        {markdown}
      </ReactMarkdown>
    </article>
  );
}
