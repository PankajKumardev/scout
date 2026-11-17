export type Page = {
  id: number;
  title: string;
  url: string;
  snippet: string;
};

export type RankedPage = Page & {
  score: number;
};

export class ResearchError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ResearchError";
    this.status = status;
  }
}

export function oneLine(value: string, maxChars: number, maxBytes: number): string {
  const cleaned = value
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxChars);
  const encoder = new TextEncoder();
  let end = cleaned.length;

  while (end > 0 && encoder.encode(cleaned.slice(0, end)).length > maxBytes) {
    end -= 1;
  }
  return cleaned.slice(0, end);
}
