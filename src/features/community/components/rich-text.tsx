import Link from "next/link";
import React from "react";

/**
 * Plain-text-safe rich rendering: linkifies @handles (→ profiles) and URLs.
 * No HTML is ever parsed — XSS-free by construction.
 */
const TOKEN = /(@[a-z0-9_]{3,20}|https?:\/\/[^\s<>"')\]]+)/g;

export function RichText({ text }: { text: string }) {
  const parts = text.split(TOKEN);
  return (
    <>
      {parts.map((part, i) => {
        if (/^@[a-z0-9_]{3,20}$/.test(part)) {
          return (
            <Link
              key={i}
              href={`/community/u/${part.slice(1)}`}
              className="text-accent hover:underline"
            >
              {part}
            </Link>
          );
        }
        if (/^https?:\/\//.test(part)) {
          return (
            <a
              key={i}
              href={part}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="text-accent underline break-all"
            >
              {part}
            </a>
          );
        }
        return <React.Fragment key={i}>{part}</React.Fragment>;
      })}
    </>
  );
}
