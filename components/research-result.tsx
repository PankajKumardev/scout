"use client";

import { useState } from "react";
import { ArrowUpRight, ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";

export type SourceCard = {
  id: number;
  title: string;
  url: string;
  score: number;
};

export type ResearchPayload = {
  answer: string;
  sources: SourceCard[];
};

const CITATION_PART = /(\[\d+\])/g;

export const STEPS = [
  {
    name: "Queue",
    detail:
      "Webpage ids wait in a line. The C program takes the front id, then the next, until the line is empty.",
  },
  {
    name: "Linked list",
    detail:
      "Each new page becomes a node. The node stores the title, URL, snippet, score, and a pointer to the next node.",
  },
  {
    name: "Linear search",
    detail:
      "Before a page is added, SCOUT walks the list and compares URLs. A repeated URL is skipped.",
  },
  {
    name: "Bubble sort",
    detail:
      "Scores are copied into an array. Neighbors are compared and swapped until the highest scores sit at the front.",
  },
  {
    name: "Top sources",
    detail:
      "SCOUT prints the best 3 to 5 ids and scores. Next.js sends those pages to Groq for the short answer.",
  },
];

function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export function AnswerBody({
  answer,
  sourceIds,
  onHoverSource,
}: {
  answer: string;
  sourceIds: number[];
  onHoverSource?: (id: number | null) => void;
}) {
  const known = new Set(sourceIds);
  const paragraphs = answer
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
  const blocks = paragraphs.length > 0 ? paragraphs : [answer];

  return (
    <div className="max-w-[65ch] space-y-4 text-base leading-[1.55]">
      {blocks.map((paragraph, paragraphIndex) => (
        <p key={`${paragraphIndex}-${paragraph.slice(0, 24)}`}>
          {paragraph.split(CITATION_PART).map((part, partIndex) => {
            const match = /^\[(\d+)\]$/.exec(part);
            if (!match) {
              return <span key={partIndex}>{part}</span>;
            }
            const id = Number(match[1]);
            if (!known.has(id)) {
              return <span key={partIndex}>{part}</span>;
            }
            return (
              <Badge
                key={partIndex}
                variant="secondary"
                render={<a href={`#source-${id}`} />}
                onMouseEnter={() => onHoverSource?.(id)}
                onMouseLeave={() => onHoverSource?.(null)}
                onFocus={() => onHoverSource?.(id)}
                onBlur={() => onHoverSource?.(null)}
                className="mx-0.5 bg-[#e7eefb] text-score hover:bg-[#e7eefb]"
              >
                [{id}]
              </Badge>
            );
          })}
        </p>
      ))}
    </div>
  );
}

export function SourceLedger({
  sources,
  activeId = null,
}: {
  sources: SourceCard[];
  activeId?: number | null;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Sources</CardTitle>
      </CardHeader>
      <CardContent>
        <ol>
          {sources.map((source, index) => (
            <li key={source.id} id={`source-${source.id}`}>
              {index > 0 ? <Separator /> : null}
              <div
                data-active={activeId === source.id ? "true" : "false"}
                className="source-row group grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3 rounded-lg px-2 py-4 transition-colors hover:bg-[#f3f6fb]"
              >
                <Badge variant="secondary" className="bg-[#e7eefb] text-score">
                  {source.id}
                </Badge>
                <a
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="min-w-0 rounded-md"
                >
                  <span className="block text-sm font-medium leading-snug break-words transition-colors group-hover:text-score">
                    {source.title}
                  </span>
                  <span className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground">
                    {domainOf(source.url)}
                    <ArrowUpRight
                      aria-hidden="true"
                      strokeWidth={1.5}
                      className="size-3.5 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-score"
                    />
                    <span className="sr-only"> (opens in a new tab)</span>
                  </span>
                </a>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">C score</p>
                  <p className="text-2xl font-medium text-score tabular-nums transition-transform duration-200 group-hover:scale-105">
                    {source.score}
                  </p>
                </div>
              </div>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}

export function ProcessSteps() {
  return (
    <ol className="mt-5 grid gap-3 lg:grid-cols-5">
      {STEPS.map((step) => (
        <li key={step.name}>
          <Card className="group h-full transition duration-200 hover:-translate-y-0.5 hover:ring-score">
            <CardHeader>
              <CardTitle className="transition-colors group-hover:text-score">{step.name}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-relaxed text-muted-foreground">{step.detail}</p>
            </CardContent>
          </Card>
        </li>
      ))}
    </ol>
  );
}

export function ProcessPanel() {
  return (
    <section>
      <h2 className="text-xl font-medium tracking-[-0.02em]">How SCOUT processes sources</h2>
      <p className="mt-2 max-w-[62ch] text-sm leading-relaxed text-muted-foreground">
        The C program ranks pages with a queue, a linked list, linear search, and bubble sort.
        Groq then writes the short answer from the top sources.
      </p>
      <ProcessSteps />
    </section>
  );
}

export function ProcessDisclosure() {
  const [open, setOpen] = useState(false);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card>
        <CollapsibleTrigger className="flex w-full items-center justify-between gap-4 px-4 py-4 text-left">
          <h2 className="text-base font-medium">How SCOUT processes sources</h2>
          <ChevronDown
            aria-hidden="true"
            strokeWidth={1.5}
            className={`size-4 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
          />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0">
            <p className="max-w-[65ch] text-sm leading-relaxed text-muted-foreground">
              The C program ranks pages with a queue, a linked list, linear search, and bubble sort.
              Groq then writes the short answer from the top sources.
            </p>
            <ProcessSteps />
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

export function SourceSkeleton() {
  return (
    <Card aria-hidden="true">
      <CardHeader>
        <Skeleton className="h-4 w-20" />
      </CardHeader>
      <CardContent className="space-y-5">
        {[0, 1, 2, 3].map((row) => (
          <div key={row} className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-3 w-28" />
            </div>
            <Skeleton className="h-6 w-8" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
