import { oneLine, ResearchError, type Page, type RankedPage } from "./shared";

const FIRECRAWL_URL = "https://api.firecrawl.dev/v2/search";
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

async function postJson(service: "Firecrawl" | "Groq", apiKey: string, payload: object) {
  const search = service === "Firecrawl";
  let response: Response;
  try {
    response = await fetch(search ? FIRECRAWL_URL : GROQ_URL, {
      method: "POST",
      cache: "no-store",
      signal: AbortSignal.timeout(search ? 50000 : 45000),
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      throw new ResearchError(504, `${service} took too long. Try the question again.`);
    }
    throw new ResearchError(502, `Could not reach ${service}.`);
  }

  const body = await readBody(response);
  if (response.status === 401) {
    throw new ResearchError(502, `${service} rejected the API key. Check ${service.toUpperCase()}_API_KEY.`);
  }
  if (!response.ok) {
    throw new ResearchError(502, upstreamMessage(body, `${service} failed (${response.status}).`));
  }
  return body;
}

type FirecrawlWeb = {
  title?: unknown;
  description?: unknown;
  url?: unknown;
};

function safeMessage(value: unknown, fallback: string): string {
  if (typeof value !== "string") {
    return fallback;
  }
  const trimmed = value.replace(/\s+/g, " ").trim();
  if (!trimmed || trimmed.length > 220) {
    return fallback;
  }
  if (/gsk_|fc-|bearer|api[_ -]?key/i.test(trimmed)) {
    return fallback;
  }
  return trimmed;
}

async function readBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) {
    return {};
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { error: text.slice(0, 180) };
  }
}

function upstreamMessage(body: unknown, fallback: string): string {
  if (typeof body !== "object" || body === null) {
    return fallback;
  }
  const record = body as { error?: unknown; message?: unknown };
  if (typeof record.error === "string") {
    return safeMessage(record.error, fallback);
  }
  if (typeof record.error === "object" && record.error !== null) {
    const nested = record.error as { message?: unknown };
    return safeMessage(nested.message, fallback);
  }
  return safeMessage(record.message, fallback);
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export async function searchWeb(question: string, apiKey: string): Promise<Page[]> {
  const body = await postJson("Firecrawl", apiKey, {
    query: question,
    limit: 8,
    sources: [{ type: "web" }],
    highlights: false,
  });

  const record = body as { success?: unknown; data?: { web?: unknown } };
  if (record.success === false) {
    throw new ResearchError(502, upstreamMessage(body, "Firecrawl could not search the web."));
  }

  const web = record.data?.web;
  if (!Array.isArray(web)) {
    return [];
  }

  const pages: Page[] = [];
  for (const item of web) {
    if (typeof item !== "object" || item === null) {
      continue;
    }
    const row = item as FirecrawlWeb;
    const url = typeof row.url === "string" ? oneLine(row.url, 450, 480) : "";
    if (!isHttpUrl(url)) {
      continue;
    }
    const titleText = typeof row.title === "string" ? oneLine(row.title, 180, 190) : "";
    const snippetText =
      typeof row.description === "string" ? oneLine(row.description, 800, 900) : "";
    pages.push({
      id: pages.length + 1,
      title: titleText || "Untitled page",
      url,
      snippet: snippetText,
    });
    if (pages.length === 8) {
      break;
    }
  }
  return pages;
}

function cleanAnswer(text: string): string {
  return text
    .replace(/^(answer|response):\s*/i, "")
    .replace(/\s*\u2014\s*/g, ", ")
    .replace(/\s*\u2013\s*/g, " - ")
    .replace(/[\u2010\u2011]/g, "-")
    .replace(/\*\*/g, "")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/,\s*,/g, ",")
    .trim()
    .slice(0, 3000);
}

function messageText(content: unknown): string {
  if (typeof content === "string") {
    return content;
  }
  if (!Array.isArray(content)) {
    return "";
  }
  return content
    .map((part) => {
      if (typeof part === "string") {
        return part;
      }
      if (typeof part === "object" && part !== null && "text" in part) {
        const text = (part as { text?: unknown }).text;
        return typeof text === "string" ? text : "";
      }
      return "";
    })
    .join("");
}

export async function writeAnswer(question: string, pages: RankedPage[], apiKey: string, model: string): Promise<string> {
  const sourceBlock = pages
    .map((page, index) => {
      const excerpt = page.snippet || "No excerpt was available.";
      return `[${index + 1}] ${page.title}\nURL: ${page.url}\nExcerpt: ${excerpt}`;
    })
    .join("\n\n");

  const body = await postJson("Groq", apiKey, {
    model,
    temperature: 0.2,
    max_completion_tokens: 700,
    reasoning_effort: "low",
    reasoning_format: "hidden",
    messages: [
      {
        role: "system",
        content:
          "You are SCOUT, a college research assistant. Answer only from the numbered sources. Write 100 to 200 words of plain text, with no markdown. Cite facts as [1], [2], or [3], using only those source numbers. Do not invent sources, numbers, or facts. If the excerpts are not enough, say what is missing.",
      },
      {
        role: "user",
        content: `Question: ${question}\n\nSources:\n${sourceBlock}`,
      },
    ],
  });

  const record = body as {
    choices?: Array<{ message?: { content?: unknown } }>;
  };
  const answer = cleanAnswer(messageText(record.choices?.[0]?.message?.content));
  if (!answer) {
    throw new ResearchError(502, "Groq returned an empty answer.");
  }
  return answer;
}
