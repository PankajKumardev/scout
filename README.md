# SCOUT

SCOUT (Smart Research Assistant) is a college mini project for Data Structures using C.

You type a question on a website. The site searches the web, a C program ranks the pages with a queue, a linked list, linear search, and bubble sort, and then a language model writes a short answer from the best pages. The answer uses numbered citations that match the source cards on the screen.

There is no login, no database, and no chat history. One question is handled, shown, and forgotten.

`VIVA.md` has shorter questions and answers for the lab exam. This file explains the whole working so you can walk through it out loud.

## One sentence for the examiner

The website collects pages. The C program is the ranking engine. Groq only writes the paragraph after C has already chosen the sources.

## What happens when you click Research

```text
Browser
  |
  |  POST /api/research   { "question": "..." }
  v
Next.js API route  (app/api/research/route.ts)
  |
  |  1. Firecrawl search, at most 8 pages
  v
Compiled C program  c-backend/scout
  |  read question and pages from stdin
  |  put ids in a queue
  |  dequeue one id at a time
  |  linear search: skip a URL already in the list
  |  add unique pages to a linked list and score them
  |  copy scores into an array
  |  bubble sort, highest score first
  |  print the best 3 to 5 lines: id score
  v
Next.js matches those ids to the original pages
  |
  |  2. Groq writes 100 to 200 words with [1], [2], [3]
  v
Browser shows the answer and the source cards
```

Citation `[1]` is the first card. That card is the highest scoring page C kept. The number on the card is the display number, not the old Firecrawl order.

## Why each part exists

| Part | Job | Does not do |
| --- | --- | --- |
| Next.js page | The screen you type into | Ranking |
| `POST /api/research` | Calls Firecrawl, starts C, calls Groq | Sorting or duplicate checks |
| Firecrawl | Finds real web pages | Choosing the best pages |
| `scout.c` | Queue, linked list, linear search, bubble sort, scores | Internet calls, JSON, the paragraph |
| Groq | Writes the short answer from the pages C selected | Searching or ranking |
| shadcn/ui | Buttons, field, cards, badges, skeletons | Any data-structure work |

C has no libcurl and no cJSON. It only uses the C standard library. That is deliberate. The data structures stay visible in one file you can open during the viva.

## How to run it

You need macOS or Linux, Node.js 20 or newer, and `gcc`. On a Mac, the `gcc` command is usually Apple clang, and that is fine.

```bash
cd scout
cp .env.example .env.local
```

Put your keys in `.env.local`:

```env
FIRECRAWL_API_KEY=your_firecrawl_key
GROQ_API_KEY=your_groq_key
GROQ_MODEL=openai/gpt-oss-20b
```

If `GROQ_MODEL` is missing, the server uses `openai/gpt-oss-20b`.

```bash
gcc c-backend/scout.c -o c-backend/scout
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). `npm run compile` is the same gcc command.

The keys stay on the server. The browser never receives them. The C program never sees them either. C only receives the question and the page text.

## What to click in a demo

1. Show the heading, the question box, and the five algorithm cards: Queue, Linked list, Linear search, Bubble sort, Top sources.
2. Click an example, or type a question such as "What are the advantages of solar energy?"
3. While it loads, point at the three status lines: searching the web, processing in C, generating the answer.
4. When the answer appears, click a blue `[1]` in the paragraph. The matching source row highlights. That row's link opens the real page.
5. Open "How SCOUT processes sources" and say the five steps in order.
6. If you have a terminal, run the C program alone (next section) and show that page 4 is dropped because its URL repeats page 1.

## The C program, line by line of the idea

File: `c-backend/scout.c`. One file. Plain functions. No extra libraries.

### Input and output

Next.js writes this to the program's stdin. One field per line. Fields do not contain newlines.

```text
question
count
id
title
url
snippet
```

The last four lines repeat `count` times. `count` is at most 10.

Stdout is only this, one selected page per line:

```text
id score
```

Anything a human might want to watch (keywords, enqueue, duplicate skipped, sorted list) goes to stderr. That keeps stdout machine-readable.

The route starts the binary with `spawn(executable, [])`. It does not build a shell string from the question, so the question cannot be turned into a command.

### The four data structures

**1. Queue (array, FIFO)**

`struct Queue` holds `items[10]`, `front`, and `rear`.

- `enqueue` writes the id at `rear`, then adds 1 to `rear`.
- `dequeue` reads the id at `front`, then adds 1 to `front`.
- The queue is empty when `front >= rear`.
- It is not circular. Ten ids do not need wrap-around.

The ids are placed in the queue first. Then `main` dequeues one id at a time. That is the "process one page at a time" step. The pages themselves wait in a plain array called `incoming` until their id comes out of the queue.

Enqueue and dequeue are O(1).

**2. Linked list**

```c
struct Source {
    int id;
    char title[200];
    char url[500];
    char snippet[1000];
    int score;
    struct Source *next;
};
```

`head` points at the first node. The last node's `next` is `NULL`. An empty list has `head == NULL`.

`addSource` does this:

1. `malloc(sizeof(struct Source))` asks for one node.
2. If `malloc` returns `NULL`, the function gives up. `main` frees what it already stored and returns 1.
3. The id, title, URL, and snippet are copied in. The score is calculated.
4. `next` is set to `NULL`.
5. If the list is empty, this node becomes the head.
6. Otherwise the function walks to the last node and attaches the new node there.

The list is not kept in score order. Bubble sort does the ordering later, on a separate array.

Inserting at the end is O(n) each time, so building the list is O(n^2). n is at most 10, so that is fine.

`freeSources` walks the list, saves `current->next` in a local variable, then calls `free(current)`. The save matters: after `free`, you must not read `current->next`.

The queue and the ranking array are local variables in `main`. They disappear when `main` returns. They do not need `free`.

**3. Linear search**

`sourceExists` starts at `head` and compares each node's URL with `strcmp`. A match means the page is a duplicate and is not added. Reaching `NULL` means the URL is new.

That is O(n). With at most 10 pages, a faster search is not useful.

`findIncoming` is the same idea on the input array: walk until the id matches.

**4. Bubble sort**

`copyScores` copies each node's id and score into a `struct Ranked` array.

The sort wants a higher score first:

```c
if (items[j].score < items[j + 1].score) {
    swap them
}
```

Adjacent items are compared. A smaller score moves right. After the loops, the largest score is at index 0. Equal scores are not swapped, so their old order stays.

Bubble sort is O(n^2).

After the sort, the program prints at most 5 lines. If the next score is 0 and 3 pages are already selected, it stops. A pasta page that shares no words with the question is dropped once three useful pages exist. If every score is 0, the first 3 are still printed so the website has something to show.

### The score, on a whiteboard

From the question, keep words that are at least 3 letters and are not stop words (`the`, `and`, `what`, `are`, and similar).

- The keyword is a whole word in the title: +2
- The same keyword is a whole word in the snippet: +1
- Each keyword counts once per field
- `art` does not count inside `start`, because the characters on both sides are checked

There is no machine learning in the ranker. A page scores high when the question words show up. The program does not know if a site is a journal or a forum.

### Worked example you can run offline

`c-backend/sample-input.txt` uses `sample.test` URLs so you can test C without the internet. The website itself uses real Firecrawl links.

```bash
./c-backend/scout < c-backend/sample-input.txt
```

Stdout matches `c-backend/sample-output.txt`:

```text
1 8
5 7
3 3
```

Question: `What are the advantages of solar energy?`

Keywords: `advantages`, `solar`, `energy`.

| Id | What happened | Score |
| --- | --- | --- |
| 1 | all 3 keywords in the title (+6), `solar` and `energy` in the snippet (+2) | 8 |
| 2 | a pasta page, no keywords | 0 |
| 3 | only `solar` matches | 3 |
| 4 | same URL as id 1, linear search skips it | not stored |
| 5 | `advantages` and `energy` in the title (+4), all 3 in the snippet (+3) | 7 |

Stderr shows the sort before the zero is dropped:

```text
Sorted: 1(8) 5(7) 3(3) 2(0)
```

Then only the first three are printed.

Empty stdin prints `Missing question` on stderr and exits with code 1. A count of 0 prints nothing and exits 0.

## What Next.js does with that output

`app/api/research/route.ts` is the only API route. It runs on the Node.js runtime so it can use `spawn`.

1. Read `{ "question": "..." }`. Reject an empty question or a body that is not JSON.
2. Require `FIRECRAWL_API_KEY` and `GROQ_API_KEY`.
3. `POST https://api.firecrawl.dev/v2/search` with the question, `limit: 8`, and web results. Keep `title`, `url`, and `description`. The description is the snippet C scores. Only `http` and `https` URLs are kept.
4. Number those pages 1, 2, 3, ... and write the stdin text.
5. Run `c-backend/scout`. If the file is missing, the error tells you the gcc command.
6. Read `id score` lines. Look up each id in the Firecrawl list. Keep that order. That order is rank order.
7. Renumber them 1..n for the screen. Send those pages to Groq.
8. `POST https://api.groq.com/openai/v1/chat/completions`. The prompt says: use only these sources, about 100 to 200 words, cite with `[1]`, `[2]`, `[3]`, and do not invent citations.
9. Return:

```json
{
  "answer": ".... [1] .... [2] ....",
  "sources": [
    { "id": 1, "title": "...", "url": "https://...", "score": 8 }
  ]
}
```

`score` is the number C printed. `id` is the citation number, so card 1 is `[1]`.

Errors you can mention: missing key, Firecrawl failure, Groq failure, no pages found, C program not compiled, C program failed. The message is a sentence. The key is not included.

## The screen

| File | What to say |
| --- | --- |
| `app/page.tsx` | The shell: SCOUT on the left, "C-Powered Research" on the right |
| `components/search-box.tsx` | The question, the Research button, the examples, loading, and the call to `/api/research` |
| `components/research-result.tsx` | The answer, the source list, and the five algorithm cards |
| `components/ui/` | shadcn/ui pieces: button, textarea, card, badge, label, skeleton, separator, collapsible |
| `app/globals.css` | Colors. Gray page, near-black button, blue `#1d5fbf` only on scores and citations |

shadcn draws the controls. It does not rank anything.

Hover behavior you can show: an example's arrow moves, an algorithm card lifts, a citation highlights its source row, and that row's link icon nudges.

## Time complexity, said simply

n is the number of pages, and n is at most 10.

| Step | Time |
| --- | --- |
| Enqueue, dequeue | O(1) |
| Linear search for a duplicate URL | O(n) |
| Add a node at the end of the list | O(n), so the whole list is O(n^2) |
| Bubble sort | O(n^2) |

O(n^2) is acceptable because the list never grows past 10. That is also why the lab can use bubble sort and linear search.

## Structures, pointers, malloc

A structure groups related values. `struct Source` is one webpage. `struct Queue` is the array plus `front` and `rear`. `struct Ranked` is only an id and a score, which is all the sort needs.

A pointer stores an address. `next` is the address of the following node. `NULL` means "there is no node here."

`malloc` is used because each accepted page needs its own node while the program is running. `free` gives that memory back. The viva point is: save `next`, then `free` the current node.

## Files

```text
scout/
├── app/
│   ├── api/research/route.ts    Firecrawl, spawn C, Groq
│   ├── page.tsx                 Page shell
│   ├── layout.tsx               Font and page title
│   └── globals.css              Colors
├── components/
│   ├── search-box.tsx           Question form and loading
│   ├── research-result.tsx      Answer, sources, algorithm cards
│   └── ui/                      shadcn components
├── c-backend/
│   ├── scout.c                  The ranking engine
│   ├── sample-input.txt         Offline test input
│   └── sample-output.txt        Expected stdout
├── lib/utils.ts                 shadcn class helper
├── .env.example                 Key names, no secrets
├── VIVA.md                      Short viva questions
└── README.md                    This explanation
```

Do not commit `.env.local` or the compiled `c-backend/scout` binary. Both are gitignored. Anyone who clones the repo compiles C themselves and adds their own keys.

## Short answers if the examiner interrupts

**Why not only an array?** An array would hold 10 pages. The list is here so the program uses nodes, pointers, `malloc`, and `free`. The queue and the sort still use arrays, because those two topics are array topics.

**What are front and rear?** `rear` is where the next id is written. `front` is where the next id is read.

**Why is the queue not circular?** At most 10 ids are stored, and slots are not reused.

**How is a duplicate stopped?** `sourceExists` walks the linked list and compares URLs. Sample id 4 is the demo.

**Why does bubble sort use `<`?** A smaller score should move right, so the larger score stays on the left.

**Who picks the final 3 to 5 pages?** The C program. Next.js obeys the ids C prints. It does not sort.

**Why can the card number differ from the id C printed?** C ids follow the Firecrawl order, such as 5, then 1, then 3. The screen renumbers them 1, 2, 3 in rank order so `[1]` is always the first card. The route uses the C id only to find the right URL before it renumbers.

**Where are the keys?** In `.env.local` on the machine running Next.js.
