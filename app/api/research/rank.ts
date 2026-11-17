import { execFile } from "node:child_process";
import path from "node:path";
import { ResearchError, type Page, type RankedPage } from "./shared";

const SCOUT_EXECUTABLE = path.join(process.cwd(), "c-backend", "scout");
const RANK_LINE = /^(\d+)\s+(\d+)$/;

function scoutInput(question: string, pages: Page[]): string {
  const lines = [question, String(pages.length)];
  for (const page of pages) {
    lines.push(String(page.id), page.title, page.url, page.snippet);
  }
  return `${lines.join("\n")}\n`;
}

function runScout(input: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = execFile(SCOUT_EXECUTABLE, [], { timeout: 5000, killSignal: "SIGKILL" }, (error, stdout, stderr) => {
      if (stderr.trim()) console.error(stderr.trim());
      if (!error) {
        resolve(stdout);
      } else if (typeof error.code === "string") {
        reject(new ResearchError(500, "Could not start the C program. Run npm run compile."));
      } else {
        reject(new ResearchError(500, "The C ranking program failed."));
      }
    });
    child.stdin!.on("error", () => reject(new ResearchError(500, "Could not send sources to the C program.")));
    child.stdin!.end(input);
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

export async function rankPages(question: string, pages: Page[]) {
  const input = scoutInput(question, pages);
  const output = await runScout(input);
  return selectPages(pages, output);
}
