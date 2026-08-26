"use client";

import * as React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";
import { cn } from "@/lib/utils";

/**
 * Models sometimes emit LaTeX (e.g. $285{,}000, \[...\], \div) even though
 * we only render plain Markdown. Scrub the common artifacts so students see
 * normal money/math text. Intentionally narrow — does not touch Markdown links.
 */
export function scrubLatexArtifacts(text: string): string {
  let out = text;
  // $285{,}000 → $285,000
  out = out.replace(/\{\s*,\s*\}/g, ",");
  // Common math commands → plain symbols
  out = out.replace(/\\div\b/g, "÷");
  out = out.replace(/\\approx\b/g, "≈");
  out = out.replace(/\\times\b/g, "×");
  out = out.replace(/\\cdot\b/g, "·");
  out = out.replace(/\\pm\b/g, "±");
  out = out.replace(/\\%/g, "%");
  out = out.replace(/\\\$/g, "$");
  // Display-math delimiters
  out = out.replace(/\\\[/g, "");
  out = out.replace(/\\\]/g, "");
  out = out.replace(/\$\$/g, "");
  // Bracketed display lines like: [ $339,000 - $285,000 = $54,000 ]
  // Only when content includes $ (money/math) — leave Markdown links alone.
  out = out.replace(/\[\s*([^\]\n]*\$[^\]\n]*)\s*\]/g, (_, inner: string) =>
    inner.trim(),
  );
  return out;
}

const components: Components = {
  p: ({ children }) => (
    <p className="mb-2 last:mb-0 first:mt-0 [&:only-child]:mb-0">{children}</p>
  ),
  ul: ({ children }) => (
    <ul className="mb-2 ml-4 list-disc space-y-1 last:mb-0 [&:first-child]:mt-0">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="mb-2 ml-4 list-decimal space-y-1 last:mb-0 [&:first-child]:mt-0">
      {children}
    </ol>
  ),
  li: ({ children }) => <li className="leading-relaxed [&>p]:mb-0">{children}</li>,
  strong: ({ children }) => (
    <strong className="font-semibold text-ink">{children}</strong>
  ),
  em: ({ children }) => <em className="italic">{children}</em>,
  h1: ({ children }) => (
    <h1 className="mb-2 font-serif text-base font-semibold tracking-tight text-ink first:mt-0">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="mb-2 mt-3 text-[15px] font-semibold text-ink first:mt-0">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="mb-1.5 mt-2 text-sm font-semibold text-ink first:mt-0">{children}</h3>
  ),
  code: ({ className, children, ...props }) => {
    const inline = !className;
    if (inline) {
      return (
        <code
          className="rounded bg-ink/10 px-1 py-0.5 font-mono text-[0.9em]"
          {...props}
        >
          {children}
        </code>
      );
    }
    return (
      <code className={cn("block font-mono text-xs leading-relaxed", className)} {...props}>
        {children}
      </code>
    );
  },
  pre: ({ children }) => (
    <pre className="mb-2 overflow-x-auto rounded-lg border border-border bg-surface p-3 last:mb-0">
      {children}
    </pre>
  ),
  blockquote: ({ children }) => (
    <blockquote className="mb-2 border-l-2 border-primary/40 pl-3 text-ink-muted italic last:mb-0">
      {children}
    </blockquote>
  ),
  a: ({ href, children }) => (
    <a
      href={href}
      className="font-medium text-primary underline underline-offset-2 hover:text-primary/90"
      target="_blank"
      rel="noopener noreferrer"
    >
      {children}
    </a>
  ),
  hr: () => <hr className="my-3 border-border" />,
  table: ({ children }) => (
    <div className="mb-2 overflow-x-auto last:mb-0">
      <table className="w-full border-collapse text-xs">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-surface">{children}</thead>,
  th: ({ children }) => (
    <th className="border border-border px-2 py-1 text-left font-semibold text-ink">{children}</th>
  ),
  td: ({ children }) => (
    <td className="border border-border px-2 py-1 text-ink">{children}</td>
  ),
};

export function ChatMarkdown({
  content,
  className,
}: {
  content: string;
  className?: string;
}) {
  if (!content?.trim()) return null;
  const cleaned = scrubLatexArtifacts(content);
  return (
    <div
      className={cn(
        "min-w-0 text-sm leading-relaxed text-ink [&_*]:break-words",
        className,
      )}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {cleaned}
      </ReactMarkdown>
    </div>
  );
}
