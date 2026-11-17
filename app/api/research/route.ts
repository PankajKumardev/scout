import { searchWeb, writeAnswer } from "./providers";
import { rankPages } from "./rank";
import { oneLine, ResearchError } from "./shared";

export const runtime = "nodejs";

const DEFAULT_MODEL = "openai/gpt-oss-20b";

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

async function readQuestion(request: Request): Promise<string> {
  const payload: unknown = await request.json().catch(() => null);

  if (typeof payload !== "object" || payload === null || !("question" in payload)) {
    throw new ResearchError(400, "Send a JSON body with a question.");
  }

  const rawQuestion = payload.question;
  if (typeof rawQuestion !== "string") {
    throw new ResearchError(400, "The question must be text.");
  }

  const question = oneLine(rawQuestion, 400, 480);
  if (!question) {
    throw new ResearchError(400, "Enter a research question.");
  }
  return question;
}

export async function POST(request: Request) {
  try {
    const question = await readQuestion(request);
    const firecrawlKey = requireEnv("FIRECRAWL_API_KEY");
    const groqKey = requireEnv("GROQ_API_KEY");
    const model = process.env.GROQ_MODEL?.trim() || DEFAULT_MODEL;

    const pages = await searchWeb(question, firecrawlKey);
    if (pages.length === 0) {
      throw new ResearchError(404, "No webpages were found for that question.");
    }

    const selected = await rankPages(question, pages);
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
