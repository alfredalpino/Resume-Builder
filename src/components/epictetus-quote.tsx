"use client";

import { useEffect, useState } from "react";

/** Short Epictetus lines — calm, human, fits a kindness / coffee page. */
const EPICTETUS_QUOTES: { text: string; attribution: string }[] = [
  {
    text: "Wealth consists not in having great possessions, but in having few wants.",
    attribution: "Epictetus",
  },
  {
    text: "He is a wise man who does not grieve for the things which he has not, but rejoices for those which he has.",
    attribution: "Epictetus",
  },
  {
    text: "It is not what happens to you, but how you react to it that matters.",
    attribution: "Epictetus",
  },
  {
    text: "No man is free who is not master of himself.",
    attribution: "Epictetus",
  },
  {
    text: "Don't explain your philosophy. Embody it.",
    attribution: "Epictetus",
  },
  {
    text: "First say to yourself what you would be; and then do what you have to do.",
    attribution: "Epictetus",
  },
  {
    text: "Make the best use of what is in your power, and take the rest as it happens.",
    attribution: "Epictetus",
  },
  {
    text: "The greater the difficulty, the more glory in surmounting it.",
    attribution: "Epictetus",
  },
  {
    text: "Freedom is the only worthy goal in life. It is won by disregarding things that lie beyond our control.",
    attribution: "Epictetus",
  },
  {
    text: "Be careful to leave your sons well instructed rather than rich.",
    attribution: "Epictetus",
  },
];

const INTERVAL_MS = 7000;

export function EpictetusQuote() {
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const id = setInterval(() => {
      setVisible(false);
      window.setTimeout(() => {
        setIndex((i) => (i + 1) % EPICTETUS_QUOTES.length);
        setVisible(true);
      }, 320);
    }, INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  const quote = EPICTETUS_QUOTES[index];

  return (
    <figure
      className="mx-auto max-w-md px-1 text-center"
      aria-live="polite"
    >
      <blockquote
        className={`text-xl leading-snug tracking-tight text-[var(--text)] transition-all duration-300 sm:text-2xl ${
          visible ? "translate-y-0 opacity-100" : "translate-y-1 opacity-0"
        }`}
        style={{ fontFamily: "var(--font-quote), Georgia, 'Times New Roman', serif" }}
      >
        <span className="text-[var(--alfred-amber)]/80">“</span>
        {quote.text}
        <span className="text-[var(--alfred-amber)]/80">”</span>
      </blockquote>
      <figcaption
        className={`mt-3 font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--text-muted)] transition-opacity duration-300 ${
          visible ? "opacity-100" : "opacity-0"
        }`}
      >
        — {quote.attribution}
      </figcaption>
    </figure>
  );
}
