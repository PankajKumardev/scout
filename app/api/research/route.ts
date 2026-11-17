import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

export const runtime = "nodejs";

const FIRECRAWL_URL = "https://api.firecrawl.dev/v2/search";
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const SCOUT_EXECUTABLE = path.join(process.cwd(), "c-backend", "scout");
const RANK_LINE = /^(\d+)\s+(\d+)$/;
const DEFAULT_MODEL = "openai/gpt-oss-20b";

type Page = {
  id: number;
  title: string;
  url: string;
  snippet: string;
};

type RankedPage = Page & {
  score: number;
};

type FirecrawlWeb = {
  title?: unknown;
  description?: unknown;
  url?: unknown;
};

class ResearchError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ResearchError";
    this.status = status;
  }
}

function oneLine(value: string, maxChars: number, maxBytes: number): string {
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

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new ResearchError(
      500,
      `${name} is missing. Add it to .env.local and restart the server.`,
    );
  }
  return value;
}

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

async function searchWeb(question: string, apiKey: string): Promise<Page[]> {
  let response: Response;
  try {
    response = await fetch(FIRECRAWL_URL, {
      method: "POST",
      cache: "no-store",
      signal: AbortSignal.timeout(50000),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: question,
        limit: 8,
        sources: [{ type: "web" }],
        highlights: false,
      }),
    });
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      throw new ResearchError(504, "Firecrawl took too long. Try the question again.");
    }
    throw new ResearchError(502, "Could not reach Firecrawl.");
  }

  const body = await readBody(response);
  if (response.status === 401) {
    throw new ResearchError(502, "Firecrawl rejected the API key. Check FIRECRAWL_API_KEY.");
  }
  if (!response.ok) {
    throw new ResearchError(502, upstreamMessage(body, `Firecrawl failed (${response.status}).`));
  }

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

function scoutInput(question: string, pages: Page[]): string {
  const lines = [oneLine(question, 400, 480), String(pages.length)];
  for (const page of pages) {
    lines.push(String(page.id), page.title, page.url, page.snippet);
  }
  return `${lines.join("\n")}\n`;
}

function runScout(input: string): Promise<{ stdout: string; stderr: string }> {
  if (!fs.existsSync(SCOUT_EXECUTABLE)) {
    return Promise.reject(
      new ResearchError(
        500,
        "The C program is not compiled. In the project folder run: npm run compile",
      ),
    );
  }

  return new Promise((resolve, reject) => {
    const child = spawn(SCOUT_EXECUTABLE, [], { stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    let settled = false;

    const fail = (error: ResearchError) => {
      if (settled) {
        return;
      }
      settled = true;
      reject(error);
    };

    const killer = setTimeout(() => {
      child.kill("SIGKILL");
    }, 5000);

    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });
    child.on("error", () => {
      clearTimeout(killer);
      fail(
        new ResearchError(
          500,
          "Could not start the C program. Compile it with: npm run compile",
        ),
      );
    });
    child.on("close", (code) => {
      clearTimeout(killer);
      if (settled) {
        return;
      }
      settled = true;
      if (code !== 0) {
        console.error(stderr);
        reject(new ResearchError(500, "The C ranking program failed."));
        return;
      }
      resolve({ stdout, stderr });
    });

    child.stdin.on("error", () => {
      clearTimeout(killer);
      fail(new ResearchError(500, "Could not send sources to the C program."));
    });
    child.stdin.write(input);
    child.stdin.end();
  });
}

function selectPages(pages: Page[], stdout: string): RankedPage[] {
  const byId = new Map(pages.map((page) => [page.id, page]));
  const selected: RankedPage[] = [];
  const seen = new Set<number>();

  for (const line of stdout.split("\n")) {
    const match = RANK_LINE.exec(line.trim());
    if (!match) {
      continue;
    }
    const id = Number(match[1]);
    const score = Number(match[2]);
    const page = byId.get(id);
    if (!page || seen.has(id)) {
      continue;
    }
    seen.add(id);
    selected.push({ ...page, score });
    if (selected.length === 5) {
      break;
    }
  }
  return selected;
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

async function writeAnswer(question: string, pages: RankedPage[], apiKey: string, model: string): Promise<string> {
  const sourceBlock = pages
    .map((page, index) => {
      const excerpt = page.snippet || "No excerpt was available.";
      return `[${index + 1}] ${page.title}\nURL: ${page.url}\nExcerpt: ${excerpt}`;
    })
    .join("\n\n");

  let response: Response;
  try {
    response = await fetch(GROQ_URL, {
      method: "POST",
      cache: "no-store",
      signal: AbortSignal.timeout(45000),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
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
      }),
    });
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      throw new ResearchError(504, "Groq took too long. Try the question again.");
    }
    throw new ResearchError(502, "Could not reach Groq.");
  }

  const body = await readBody(response);
  if (response.status === 401) {
    throw new ResearchError(502, "Groq rejected the API key. Check GROQ_API_KEY.");
  }
  if (!response.ok) {
    throw new ResearchError(502, upstreamMessage(body, `Groq failed (${response.status}).`));
  }

  const record = body as {
    choices?: Array<{ message?: { content?: unknown } }>;
  };
  const answer = cleanAnswer(messageText(record.choices?.[0]?.message?.content));
  if (!answer) {
    throw new ResearchError(502, "Groq returned an empty answer.");
  }
  return answer;
}

export async function POST(request: Request) {
  try {
    let payload: unknown;
    try {
      payload = await request.json();
    } catch {
      throw new ResearchError(400, "Send a JSON body with a question.");
    }

    if (typeof payload !== "object" || payload === null || !("question" in payload)) {
      throw new ResearchError(400, "Send a JSON body with a question.");
    }

    const rawQuestion = (payload as { question?: unknown }).question;
    if (typeof rawQuestion !== "string") {
      throw new ResearchError(400, "The question must be text.");
    }

    const question = oneLine(rawQuestion, 400, 480);
    if (!question) {
      throw new ResearchError(400, "Enter a research question.");
    }

    const firecrawlKey = requireEnv("FIRECRAWL_API_KEY");
    const groqKey = requireEnv("GROQ_API_KEY");
    const model = process.env.GROQ_MODEL?.trim() || DEFAULT_MODEL;

    const pages = await searchWeb(question, firecrawlKey);
    if (pages.length === 0) {
      throw new ResearchError(404, "No webpages were found for that question.");
    }

    const scout = await runScout(scoutInput(question, pages));
    if (scout.stderr.trim()) {
      console.error(scout.stderr.trim());
    }

    const selected = selectPages(pages, scout.stdout);
    if (selected.length === 0) {
      throw new ResearchError(422, "The C program did not select any sources.");
    }

    const answer = await writeAnswer(question, selected, groqKey, model);
    console.info(`SCOUT ranked ${selected.length} sources`);

    return Response.json({
      answer,
      sources: selected.map((page, index) => ({
        id: index + 1,
        title: page.title,
        url: page.url,
        score: page.score,
      })),
    });
  } catch (error) {
    if (error instanceof ResearchError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    console.error(error);
    return Response.json(
      { error: "Something went wrong while researching that question." },
      { status: 500 },
    );
  }
}
