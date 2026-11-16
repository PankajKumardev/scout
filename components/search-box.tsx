"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, Search } from "lucide-react";
import {
  AnswerBody,
  ProcessDisclosure,
  ProcessPanel,
  SourceLedger,
  SourceSkeleton,
  type ResearchPayload,
} from "@/components/research-result";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";

const EXAMPLES = [
  "What are the advantages of solar energy?",
  "How do vaccines train the immune system?",
  "Why is the Amazon rainforest important?",
];

const LOADING_STEPS = [
  "Searching the web...",
  "Processing sources in C...",
  "Generating your answer...",
];

function isPayload(value: unknown): value is ResearchPayload {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const record = value as { answer?: unknown; sources?: unknown };
  if (typeof record.answer !== "string" || !Array.isArray(record.sources)) {
    return false;
  }
  return record.sources.every((source) => {
    if (typeof source !== "object" || source === null) {
      return false;
    }
    const item = source as {
      id?: unknown;
      title?: unknown;
      url?: unknown;
      score?: unknown;
    };
    return (
      typeof item.id === "number" &&
      typeof item.title === "string" &&
      typeof item.url === "string" &&
      typeof item.score === "number"
    );
  });
}

function errorFrom(value: unknown): string {
  if (typeof value === "object" && value !== null && "error" in value) {
    const message = (value as { error?: unknown }).error;
    if (typeof message === "string" && message.trim()) {
      return message;
    }
  }
  return "Research failed. Please try again.";
}

export function SearchBox() {
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(0);
  const [error, setError] = useState("");
  const [result, setResult] = useState<ResearchPayload | null>(null);
  const [asked, setAsked] = useState("");
  const [activeSource, setActiveSource] = useState<number | null>(null);
  const busy = useRef(false);

  useEffect(() => {
    if (!result && !error) {
      return;
    }
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    document.getElementById("results")?.scrollIntoView({
      behavior: reduce ? "auto" : "smooth",
      block: "start",
    });
  }, [result, error]);

  async function research(nextQuestion: string) {
    const trimmed = nextQuestion.trim();
    if (!trimmed || busy.current) {
      if (!trimmed) {
        setError("Enter a research question.");
        setResult(null);
      }
      return;
    }

    busy.current = true;
    setQuestion(trimmed);
    setLoading(true);
    setStep(0);
    setError("");
    setResult(null);

    const timers = [
      window.setTimeout(() => setStep(1), 1200),
      window.setTimeout(() => setStep(2), 2800),
    ];

    try {
      const response = await fetch("/api/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: trimmed }),
      });
      let data: unknown;
      try {
        data = await response.json();
      } catch {
        setError("The server sent a response SCOUT could not read.");
        return;
      }
      if (!response.ok || !isPayload(data)) {
        setError(errorFrom(data));
        return;
      }
      setAsked(trimmed);
      setResult(data);
    } catch {
      setError("Could not reach the SCOUT server. Check that npm run dev is still running.");
    } finally {
      timers.forEach((timer) => window.clearTimeout(timer));
      busy.current = false;
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="min-w-0">
        <h1 className="text-[2rem] font-medium leading-[1.12] tracking-[-0.035em] sm:text-[2.75rem]">
          Research smarter with SCOUT.
        </h1>
        <p className="mt-3 max-w-[40ch] text-base leading-relaxed sm:text-lg">
          Ask a question. Explore reliable sources. Get a clear answer.
        </p>

        <form
          className="mt-6"
          onSubmit={(event) => {
            event.preventDefault();
            void research(question);
          }}
        >
          <div className="grid gap-2">
            <Label htmlFor="question">Research question</Label>
            <div className="relative">
              <Textarea
                id="question"
                name="question"
                rows={4}
                value={question}
                disabled={loading}
                autoComplete="off"
                aria-describedby="question-help"
                placeholder="Ask anything you want to research..."
                onChange={(event) => setQuestion(event.target.value)}
                className="min-h-40 resize-none rounded-2xl bg-card px-4 py-4 pb-16 text-base md:text-base"
              />
              <Button
                type="submit"
                disabled={loading}
                size="lg"
                className="group absolute right-3 bottom-3 h-11 px-4"
              >
                <Search
                  aria-hidden="true"
                  strokeWidth={1.5}
                  className="transition-transform duration-200 group-hover:scale-110"
                />
                {loading ? "Researching" : "Research"}
              </Button>
            </div>
          </div>
          <p id="question-help" className="sr-only">
            SCOUT searches the web, ranks pages in C, and writes a short answer with citations.
          </p>
          <ul className="mt-3 grid gap-2 sm:grid-cols-3">
            {EXAMPLES.map((example) => (
              <li key={example}>
                <Button
                  type="button"
                  variant="outline"
                  disabled={loading}
                  onClick={() => {
                    void research(example);
                  }}
                  className="group h-auto min-h-11 w-full justify-between gap-3 px-3 py-2 text-left whitespace-normal hover:border-score hover:bg-[#f3f6fb]"
                >
                  <span>{example}</span>
                  <ArrowRight
                    aria-hidden="true"
                    strokeWidth={1.5}
                    className="shrink-0 text-muted-foreground transition-transform duration-200 group-hover:translate-x-1 group-hover:text-score"
                  />
                </Button>
              </li>
            ))}
          </ul>
        </form>

        {error ? (
          <Card id="results" role="alert" className="mt-6 scroll-mt-6 border-destructive/40">
            <CardContent className="flex items-start gap-3 text-sm">
              <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-destructive" aria-hidden="true" />
              {error}
            </CardContent>
          </Card>
        ) : null}
      </div>

      {!loading && !result ? (
        <div className="mt-6">
          <ProcessPanel />
        </div>
      ) : null}

      {loading || result ? (
        <div
          id={result ? "results" : undefined}
          className="mt-8 grid scroll-mt-6 grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_420px]"
        >
          <div className="min-w-0">
            {loading ? (
              <Card role="status" aria-live="polite">
                <CardContent className="space-y-5">
                  <ol className="space-y-2">
                    {LOADING_STEPS.map((label, index) => (
                      <li
                        key={label}
                        className={
                          index === step
                            ? "text-sm font-medium"
                            : index < step
                              ? "text-sm"
                              : "text-sm text-muted-foreground"
                        }
                      >
                        <span
                          className={
                            index === step
                              ? "mr-2 inline-block h-1.5 w-1.5 rounded-full bg-score"
                              : index < step
                                ? "mr-2 inline-block h-1.5 w-1.5 rounded-full bg-foreground"
                                : "mr-2 inline-block h-1.5 w-1.5 rounded-full bg-input"
                          }
                          aria-hidden="true"
                        />
                        {label}
                      </li>
                    ))}
                  </ol>
                  <div className="space-y-3" aria-hidden="true">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-11/12" />
                    <Skeleton className="h-4 w-4/5" />
                  </div>
                </CardContent>
              </Card>
            ) : null}
            {result ? (
              <Card>
                <CardContent>
                  <h2 className="text-base font-medium">Research question</h2>
                  <p className="mt-2 text-xl leading-snug">{asked}</p>
                  <h2 className="mt-8 text-base font-medium">Answer</h2>
                  <div className="mt-3">
                    <AnswerBody
                      answer={result.answer}
                      sourceIds={result.sources.map((source) => source.id)}
                      onHoverSource={setActiveSource}
                    />
                  </div>
                </CardContent>
              </Card>
            ) : null}
          </div>
          {loading ? <SourceSkeleton /> : null}
          {result ? <SourceLedger sources={result.sources} activeId={activeSource} /> : null}
        </div>
      ) : null}

      {result ? (
        <div className="mt-6">
          <ProcessDisclosure />
        </div>
      ) : null}
    </div>
  );
}
