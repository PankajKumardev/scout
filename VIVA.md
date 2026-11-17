# SCOUT viva notes

These notes are for a Data Structures lab viva. The explanations match the code in `c-backend/`.

## What SCOUT does

SCOUT is a small research assistant.

1. You type a question in the website.
2. Firecrawl searches the web and returns up to 8 pages (title, URL, and a short snippet).
3. A C program ranks those pages.
4. Groq writes a short answer from the best 3 to 5 pages.
5. The website shows the answer and the source links. `[1]` in the answer is source card 1.

There is no login and no database. Each question is handled once and then forgotten.

## Why C is used

The lab is about data structures in C. The linked list, queue, linear search, and bubble sort all live in `structures.c`, where you can point at them.

Next.js does not rank the pages. It only:

- talks to Firecrawl and Groq
- starts the compiled C program
- shows the result

Search and answer-writing need web APIs. Those calls stay in the Next.js route because C in this project has no extra libraries.

## How the website talks to C

The browser sends:

```json
{ "question": "What are the advantages of solar energy?" }
```

to `POST /api/research`.

The route searches with Firecrawl, then starts the binary `c-backend/scout` with `spawn()`. The question is not pasted into a shell command. The route writes plain text into the program's **stdin** and reads **stdout**.

Stdin looks like this, one field per line:

```text
What are the advantages of solar energy?
2
1
Solar Energy Advantages
https://sample.test/solar
Solar energy is renewable.
2
Cooking tips
https://sample.test/pasta
Boil water.
```

Stdout looks like this:

```text
1 8
```

That means "source id 1, score 8". The route matches the id to the page it sent in. Debug text goes to **stderr**, so it does not break that format.

```text
Browser
  |
  |  POST /api/research
  v
Next.js route
  |
  |  Firecrawl: up to 8 pages
  v
C program scout
  |  queue
  |  linked list
  |  linear search
  |  keyword score
  |  bubble sort
  v
Best 3 to 5 ids and scores
  |
  |  Groq writes the answer
  v
Browser shows the answer and source cards
```

## What a structure is

A structure groups related values under one name.

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

One `struct Source` is one webpage. `title`, `url`, and `snippet` are fixed character arrays. `score` is the rank we calculate. `next` links this page to the following page.

`struct Queue` is another structure. It holds the array of input positions plus `front` and `rear`, so the queue data stays together.

`struct Ranked` is smaller. It holds only an id and a score for sorting.

## What a pointer is

A pointer stores the address of something in memory.

`struct Source *next` means "the address of the next Source". If this is the last page, `next` is `NULL`.

`struct Source *head` is the address of the first node. When the list is empty, `head` is `NULL`.

`struct Queue *queue` in `enqueue` means the function receives the address of the queue and can change `front` and `rear` for the caller.

We do not do pointer arithmetic. We only follow `next` and pass addresses into functions.

## What a linked list is, and where SCOUT uses it

A linked list is a chain of nodes. Each node knows only the next node.

```text
head
 |
 v
[id 1 | score 8 | next] -> [id 3 | score 3 | next] -> [id 5 | score 7 | next] -> NULL
```

SCOUT uses the list as the store of unique webpages.

`addSource()` does this:

1. `malloc` a new `struct Source`.
2. Copy the id, title, URL, and snippet into it.
3. Calculate its score.
4. Set `next` to `NULL`.
5. If the list is empty, this node becomes the head.
6. Otherwise, walk to the last node and attach the new node there.

`freeSources()` walks the same chain and frees every node.

The list is not kept in score order. Order does not matter yet. Bubble sort handles order later, using a separate array.

## Why malloc() and free() are used

The program does not know, at compile time, how many unique pages will remain after duplicates are removed. Each accepted page needs its own node at run time.

`malloc(sizeof(struct Source))` asks the heap for enough bytes for one node. If `malloc` returns `NULL`, the program stops instead of using a bad address.

Memory from `malloc` stays reserved until `free`. `freeSources()` saves `current->next` in a local variable, then calls `free(current)`. That order matters: after `free`, you must not read `current->next`.

When `main` finishes, every node has been freed. The queue and the ranking array are local variables, so they disappear automatically when `main` returns. They do not need `free`.

## What a queue is, and where SCOUT uses it

The first array index to enter is the first to leave (FIFO: first in, first out).

SCOUT's queue is a fixed integer array of size 10, plus two indexes:

- `rear` is the next empty slot. `enqueue` writes `items[rear]`, then adds 1 to `rear`.
- `front` is the next position to serve. `dequeue` reads `items[front]`, then adds 1 to `front`.
- The queue is empty when `front >= rear`.

It is not circular. With at most 10 pages, the indexes never need to wrap.

Flow:

1. Read every page into a plain array called `incoming`. This array is only a waiting area.
2. Enqueue each complete row’s array index.
3. Dequeue one index at a time.
4. Use that index to read the page, reject a duplicate URL, and add a new page to the linked list.

The queue is how we force "one page at a time" instead of dumping every page straight into the list inside the read loop.

## What linear search is, and where SCOUT uses it

Linear search checks items one by one until it finds a match or reaches the end.

`sourceExists()` starts at `head` and compares `current->url` with the new URL using `strcmp`. If they are equal, the URL is already stored and the page is skipped. If `current` becomes `NULL`, the URL is new.

That is enough because the list never holds more than 10 pages. There is no need for a faster search.


## How bubble sort ranks sources

After scoring, `copyScores()` copies each node's id and score into a `struct Ranked` array.

Bubble sort then makes adjacent items trade places when they are in the wrong order. We want a **higher** score first, so the test is:

```c
if (items[j].score < items[j + 1].score) {
    swap them
}
```

The inner loop walks the unsorted part of the array. After one outer pass, the smallest score among the items it touched has moved toward the end. The next pass looks at one fewer item. When the loops finish, the largest score is at index 0.

Equal scores are not swapped, so their original order stays.

Worked example from `c-backend/sample-input.txt`:

Question keywords: `advantages`, `solar`, `energy`.

| Id | Score | What happened |
| --- | --- | --- |
| 1 | 8 | keywords in the title and snippet |
| 2 | 0 | a pasta page, no keywords |
| 3 | 3 | only `solar` matches |
| 4 | skipped | same URL as id 1 |
| 5 | 7 | strong title and snippet match |

After sorting, stderr shows:

```text
Sorted: 1(8) 5(7) 3(3) 2(0)
```

SCOUT prints at most 5 lines. If the next score is 0 and 3 pages are already selected, it stops. So the sample prints:

```text
1 8
5 7
3 3
```

The website then calls those citation 1, citation 2, and citation 3, in that same order. The C id is how the route finds the original page. The number on the card is the citation number.

Scoring rule, which you can write on a whiteboard:

- ignore empty words, words shorter than 3 letters, and a small stop-word list (`the`, `and`, `what`, ...)
- a keyword in the title: +2
- the same keyword in the snippet: +1
- count each keyword once per field
- a match must be a whole word, so `art` is not found inside `start`

There is no machine learning in the ranker. A page scores high when the question words show up. The program does not know if a site is a journal, a news page, or a forum. That is why the formula is easy to explain, and also why a keyword match is not the same thing as a trusted source.

## Time complexity

`n` is the number of pages. Here `n <= 10`.

| Algorithm | Where | Time |
| --- | --- | --- |
| Enqueue / dequeue | array queue | O(1) |
| Linear search | `sourceExists` | O(n) |
| Insert at the end of the list | `addSource` | O(n) per insert, so building the list is O(n^2) |
| Bubble sort | `bubbleSort` | O(n^2) |

O(n^2) is fine in this program because n is tiny. That is also why the lab can use bubble sort and linear search instead of faster algorithms.

Space: one node per unique page, plus two small arrays (the queue and the ranking array).

## Firecrawl and Groq

**Firecrawl** searches the web. SCOUT calls `POST https://api.firecrawl.dev/v2/search` and reads `data.web[]`. Each hit gives `title`, `url`, and `description`. The description is the snippet the C program scores. The route keeps at most 8 http or https pages.

**Groq** writes the answer. SCOUT calls `POST https://api.groq.com/openai/v1/chat/completions` with the model in `GROQ_MODEL` (default `openai/gpt-oss-20b`). The prompt includes only the pages C selected, numbered `[1]`, `[2]`, and so on. Groq is told to use those sources, stay around 100 to 200 words, and not invent citations.

Firecrawl does not rank. Groq does not rank. C ranks.

## Full path of one question

1. The user submits a question.
2. The route checks that the question is non-empty text, within 400 characters, and that both API keys exist.
3. Firecrawl returns pages.
4. The route turns them into the line-based stdin format and runs `c-backend/scout`.
5. C queues the row indexes, filters duplicate URLs, builds the linked list, scores, bubble-sorts, and prints `id score`.
6. The route keeps those pages in the printed order and sends them to Groq.
7. The browser shows the answer. Citation `[1]` links to source card 1, which is the highest-scoring page C kept.

If a key is missing, Firecrawl fails, Groq fails, nothing is found, or `scout` is not compiled, the page shows an error instead of a fake answer.

## Easy questions and answers

**Q: Why not store the pages only in an array?**
A: An array would work for 10 pages. The list is here so the program actually uses nodes, pointers, `malloc`, and `free`. The queue and the sort still use arrays, because those two topics are array topics.

**Q: What do front and rear mean?**
A: `rear` is where the next index is written. `front` is where the next index is read. New indexes go in at the rear. Serving an index happens at the front.

**Q: Why is the queue not circular?**
A: We never store more than 10 indexes, and we do not reuse slots. A circular queue would add extra index math for no benefit here.

**Q: How do you stop a duplicate page?**
A: Before `addSource`, `sourceExists` walks the linked list and compares URLs with `strcmp`. A match means the page is skipped. You can see this with id 4 in `sample-input.txt`.

**Q: Why does bubble sort use `<` and not `>`?**
A: We want descending order. If the left score is smaller than the right score, the larger score should move left, so we swap.

**Q: What is NULL?**
A: NULL means "this pointer does not point at a node." The empty list has `head == NULL`. The last node's `next` is `NULL`. The dequeue of an empty queue is the integer `-1`, not NULL, because the queue stores ints.

**Q: What happens if malloc fails?**
A: `addSource` prints `malloc failed` to stderr and returns NULL. `main` frees the nodes it already created and returns 1. The website then says the C program failed.

**Q: What is the time complexity of linear search and bubble sort?**
A: Linear search is O(n). Bubble sort is O(n^2). Enqueue and dequeue are O(1).

**Q: Which program chooses the final 3 to 5 pages?**
A: The C program. Next.js does not sort the scores. It only obeys the ids C prints.

**Q: Why can citation numbers differ from the original C ids?**
A: C ids are the order Firecrawl results were numbered, such as 5, 1, and 3. The cards are renumbered 1, 2, and 3 in rank order so `[1]` always means the first card. The route uses the C id to pick the right URL before it renumbers.

**Q: Where are the API keys?**
A: In `.env.local` on the server. The browser never receives them. The C program never sees them either. C only sees the question and the page text.
