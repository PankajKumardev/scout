# Scout code walkthrough

[c-backend/scout.h](#c-backendscouth) · [c-backend/scout.c](#c-backendscoutc) · [c-backend/structures.c](#c-backendstructuresc) · [c-backend/scoring.c](#c-backendscoringc) · [Website handoff](#website-handoff)

**Start with the sample solar-energy question.** Pankaj traces page 4 until it is rejected as a duplicate. Shivam traces page 1 until it is printed with score 8.

The numbers beside the source are the line numbers in the repository. Read each short passage and trace the values in the numbered code below it.

## [c-backend/scout.h](c-backend/scout.h)

One shared definition of every record used across the three C files.

Check the guard, then define it. Including the header twice in one translation unit skips the second copy.

```text
   1  #ifndef SCOUT_H
   2  #define SCOUT_H
```

Set the ten-page capacity. The next five limits size the title, URL, snippet, question and input buffers in bytes. Each string needs space for its final zero byte.

```text
   4  #define MAX_SOURCES 10
   5  #define MAX_TITLE 200
   6  #define MAX_URL 500
   7  #define MAX_SNIPPET 1000
   8  #define MAX_QUESTION 500
   9  #define MAX_LINE 1200
```

Reserve twenty keyword slots of forty bytes each. Five is the output ceiling. Three is the number of available pages we may fill using zero scores.

```text
  10  #define MAX_KEYWORDS 20
  11  #define MAX_WORD 40
  12  #define MAX_PICK 5
  13  #define MIN_PICK 3
```

A list node owns its page ID, three strings and computed score. The last field points to the following node.

```text
  15  struct Source {
  16      int id;
  17      char title[MAX_TITLE];
  18      char url[MAX_URL];
  19      char snippet[MAX_SNIPPET];
  20      int score;
  21      struct Source *next;
  22  };
```

An incoming row holds the four fields supplied by the route. Scoring occurs after duplicate checking.

```text
  24  struct Incoming {
  25      int id;
  26      char title[MAX_TITLE];
  27      char url[MAX_URL];
  28      char snippet[MAX_SNIPPET];
  29  };
```

The array stores incoming positions. Front marks the next item to take and rear the next slot to fill.

```text
  31  struct Queue {
  32      int items[MAX_SOURCES];
  33      int front;
  34      int rear;
  35  };
```

Sort a small pair containing the original ID and its score.

```text
  37  struct Ranked {
  38      int id;
  39      int score;
  40  };
```

Declare the two scoring functions so another file can call them with the right argument types.

```text
  42  void collectKeywords(char *question);
  43  int calculateScore(const char *title, const char *snippet);
```

Declare how to put an index into the queue and take the oldest one out.

```text
  44  void enqueue(struct Queue *queue, int index);
  45  int dequeue(struct Queue *queue);
```

Declare the exact URL search, insertion and cleanup functions. A const input pointer lets insertion read the page.

```text
  46  int sourceExists(struct Source *head, const char *url);
  47  struct Source *addSource(struct Source *head, const struct Incoming *item);
  48  void freeSources(struct Source *head);
```

Publish the copy and sorting functions. The final directive closes the guard.

```text
  49  int copyScores(struct Source *head, struct Ranked items[]);
  50  void bubbleSort(struct Ranked items[], int n);
  52  #endif
```

## [c-backend/scout.c](c-backend/scout.c)

The entry point turns a question and page records on standard input into ranked ID–score pairs on standard output.

Import shared types, streams, integer conversion and string length.

```text
   1  #include "scout.h"
   2  #include <stdio.h>
   3  #include <stdlib.h>
   4  #include <string.h>
```

A file-private helper receives the destination and its capacity. An int holds a character or EOF. A size_t holds the measured length.

```text
   6  static int readLine(char *buffer, int size) {
   7      int extra;
   8      size_t length;
```

Read at most size minus one bytes. A failed read returns zero to the caller.

```text
  10      if (fgets(buffer, size, stdin) == NULL) {
  11          return 0;
  12      }
```

Measure the stored text. If the newline did not fit, consume the rest of that field so the next read starts at the correct field.

```text
  14      length = strlen(buffer);
  15      if (length == 0 || buffer[length - 1] != '\n') {
  16          while ((extra = getchar()) != '\n' && extra != EOF) {
  17          }
  18      }
```

Replace a trailing newline with the C string terminator and shorten the measured length. Remove a remaining carriage return for Windows input. Return one for success.

```text
  20      if (length > 0 && buffer[length - 1] == '\n') {
  21          buffer[length - 1] = '\0';
  22          length--;
  23      }
  24      if (length > 0 && buffer[length - 1] == '\r') {
  25          buffer[length - 1] = '\0';
  26      }
  27      return 1;
  28  }
```

Allocate input rows and ranking pairs locally. Start the queue at zero and the head at NULL. Reserve text buffers and counters. Picked counts rows already printed.

```text
  30  int main(void) {
  31      struct Incoming incoming[MAX_SOURCES];
  32      struct Ranked ranked[MAX_SOURCES];
  33      struct Queue queue = {0};
  34      struct Source *head = NULL;
  35      char question[MAX_QUESTION];
  36      char line[MAX_LINE];
  37      int count;
  38      int rankedCount;
  39      int picked = 0;
  40      int i;
```

Read the question, then the count. Each failed read writes a diagnostic to stderr and returns exit code one.

```text
  42      if (!readLine(question, MAX_QUESTION)) {
  43          fprintf(stderr, "Missing question\n");
  44          return 1;
  45      }
  46      if (!readLine(line, MAX_LINE)) {
  47          fprintf(stderr, "Missing source count\n");
  48          return 1;
  49      }
```

Convert the count to an integer. Clamp negative counts to zero and large counts to ten.

```text
  51      count = atoi(line);
  52      if (count < 0) {
  53          count = 0;
  54      }
  55      if (count > MAX_SOURCES) {
  56          fprintf(stderr, "Count capped at %d\n", MAX_SOURCES);
  57          count = MAX_SOURCES;
  58      }
```

For each row, reserve a short ID buffer and point item at the current array slot.

```text
  60      for (i = 0; i < count; i++) {
  61          char idLine[32];
  62          struct Incoming *item = &incoming[i];
```

Read the four fields directly into their destinations. A missing field stops loading before the partial row reaches the queue.

```text
  64          if (!readLine(idLine, sizeof idLine) || !readLine(item->title, sizeof item->title) ||
  65              !readLine(item->url, sizeof item->url) || !readLine(item->snippet, sizeof item->snippet)) {
  66              fprintf(stderr, "Stopped early: incomplete source\n");
  67              break;
  68          }
```

Convert the ID for later output. Enqueue the array index for direct access when processing begins.

```text
  70          item->id = atoi(idLine);
  71          enqueue(&queue, i);
  72      }
```

Tokenize the question once. While there are queued positions, remove the oldest, address its row and save its external ID for diagnostics.

```text
  74      collectKeywords(question);
  76      while (queue.front < queue.rear) {
  77          int index = dequeue(&queue);
  78          struct Incoming *item = &incoming[index];
  79          int id = item->id;
  80          struct Source *updated;
```

Print a trace. An empty URL skips the rest of this iteration.

```text
  82          fprintf(stderr, "Dequeued id %d\n", id);
  83          if (item->url[0] == '\0') {
  84              fprintf(stderr, "Skipped id %d\n", id);
  85              continue;
  86          }
```

Search previously accepted nodes. If a URL matches, log the duplicate and continue with the next row.

```text
  87          if (sourceExists(head, item->url)) {
  88              fprintf(stderr, "Duplicate URL, skipped id %d\n", id);
  89              continue;
  90          }
```

Append the page. Keep the old head available until allocation succeeds. On failure release the existing list and exit. On success record the returned head.

```text
  92          updated = addSource(head, item);
  93          if (updated == NULL) {
  94              freeSources(head);
  95              return 1;
  96          }
  97          head = updated;
  98      }
```

Copy ID–score pairs to the array and sort its populated prefix.

```text
 100      rankedCount = copyScores(head, ranked);
 101      bubbleSort(ranked, rankedCount);
```

Write the sorted trace to stderr. The route reads ranked pairs from a different stream.

```text
 103      fprintf(stderr, "Sorted:");
 104      for (i = 0; i < rankedCount; i++) {
 105          fprintf(stderr, " %d(%d)", ranked[i].id, ranked[i].score);
 106      }
 107      fprintf(stderr, "\n");
```

Stop at the array end or five picks. With a zero score, stop as soon as three pages have already been printed.

```text
 109      for (i = 0; i < rankedCount && picked < MAX_PICK; i++) {
 110          if (ranked[i].score == 0 && picked >= MIN_PICK) {
 111              break;
 112          }
```

Print an ID and score to stdout, trace the selection separately and increment the count.

```text
 113          printf("%d %d\n", ranked[i].id, ranked[i].score);
 114          fprintf(stderr, "Selected id %d score %d\n", ranked[i].id, ranked[i].score);
 115          picked = picked + 1;
 116      }
```

Release every allocated node, flush the output stream and signal success.

```text
 118      freeSources(head);
 119      fflush(stdout);
 120      return 0;
 121  }
```

## [c-backend/structures.c](c-backend/structures.c)

Keep input order, reject repeated URLs, store accepted pages and sort small ranking records.

Import the declarations, trace output, heap operations and string functions.

```text
   1  #include "scout.h"
   2  #include <stdio.h>
   3  #include <stdlib.h>
   4  #include <string.h>
```

Receive the queue by address. If rear reaches capacity, report the full queue and return.

```text
   6  void enqueue(struct Queue *queue, int index) {
   7      if (queue->rear >= MAX_SOURCES) {
   8          fprintf(stderr, "Queue is full\n");
   9          return;
  10      }
```

Write the index into the next free slot and move rear forward one place.

```text
  11      queue->items[queue->rear] = index;
  12      queue->rear = queue->rear + 1;
  13  }
```

Reserve a local return value. An empty queue returns the sentinel −1.

```text
  15  int dequeue(struct Queue *queue) {
  16      int index;
  18      if (queue->front >= queue->rear) {
  19          return -1;
  20      }
```

Read the oldest index before advancing front. Return that saved value.

```text
  21      index = queue->items[queue->front];
  22      queue->front = queue->front + 1;
  23      return index;
  24  }
```

Start the exact URL search at the head. Current is a cursor so the caller keeps its starting pointer.

```text
  26  /* Linear search: walk every node and compare the URL. */
  27  int sourceExists(struct Source *head, const char *url) {
  28      struct Source *current = head;
```

For each real node compare the two strings. strcmp returns zero on equality, so return one immediately on a match.

```text
  30      while (current != NULL) {
  31          if (strcmp(current->url, url) == 0) {
  32              return 1;
  33          }
```

Follow the link. Reaching the end without a match returns zero.

```text
  34          current = current->next;
  35      }
  36      return 0;
  37  }
```

Allocate one node of the correct size. If allocation fails, report it and return NULL.

```text
  39  struct Source *addSource(struct Source *head, const struct Incoming *item) {
  40      struct Source *node = malloc(sizeof *node);
  41      struct Source *current;
  43      if (node == NULL) {
  44          fprintf(stderr, "malloc failed\n");
  45          return NULL;
  46      }
```

Copy the ID and three terminated strings. Each source field has the same declared capacity as its destination.

```text
  48      node->id = item->id;
  49      strcpy(node->title, item->title);
  50      strcpy(node->url, item->url);
  51      strcpy(node->snippet, item->snippet);
```

Compute the score, mark the new node as the last one with NULL, then trace the result.

```text
  52      node->score = calculateScore(item->title, item->snippet);
  53      node->next = NULL;
  54      fprintf(stderr, "Added id %d with score %d\n", item->id, node->score);
```

If this is the first page, the new node becomes the head.

```text
  56      if (head == NULL) {
  57          return node;
  58      }
```

Otherwise start at the head and follow next until the last node. Attach the new node there and return the original head.

```text
  60      current = head;
  61      while (current->next != NULL) {
  62          current = current->next;
  63      }
  64      current->next = node;
  65      return head;
  66  }
```

Start at the head. Save the next address before releasing the current node. Continue at the saved address until the list is empty.

```text
  68  void freeSources(struct Source *head) {
  69      struct Source *current = head;
  71      while (current != NULL) {
  72          struct Source *next = current->next;
  73          free(current);
  74          current = next;
  75      }
  76  }
```

Declare two loop counters. Each pass moves the smallest remaining score rightward, so each inner loop ends one position earlier.

```text
  78  void bubbleSort(struct Ranked items[], int n) {
  79      int i;
  80      int j;
  82      for (i = 0; i < n - 1; i++) {
  83          for (j = 0; j < n - 1 - i; j++) {
```

When the left score is smaller, save the entire left pair, move the right pair left, then restore the saved pair on the right. Equal scores keep their order.

```text
  84              if (items[j].score < items[j + 1].score) {
  85                  struct Ranked temp = items[j];
  86                  items[j] = items[j + 1];
  87                  items[j + 1] = temp;
  88              }
  89          }
  90      }
  91  }
```

Start at the first node with zero pairs copied. Stop at the list end or capacity. Copy ID, copy score, increment the output count and follow next. Return the count for sorting.

```text
  93  int copyScores(struct Source *head, struct Ranked items[]) {
  94      struct Source *current = head;
  95      int n = 0;
  97      while (current != NULL && n < MAX_SOURCES) {
  98          items[n].id = current->id;
  99          items[n].score = current->score;
 100          n = n + 1;
 101          current = current->next;
 102      }
 103      return n;
 104  }
```

## [c-backend/scoring.c](c-backend/scoring.c)

Turn a question into keywords and assign a deterministic relevance score to each accepted page.

Import shared limits, character classification, bounded formatting and string operations.

```text
   1  #include "scout.h"
   2  #include <ctype.h>
   3  #include <stdio.h>
   4  #include <string.h>
```

Keep keyword text and the active count private to this file.

```text
   6  static char keywords[MAX_KEYWORDS][MAX_WORD];
   7  static int keywordCount;
```

Define the common words to skip. The final NULL tells the search where the list ends.

```text
   9  static int isStopWord(const char *word) {
  10      const char *stops[] = {
  11          "the", "and", "for", "are", "what", "how", "why", "when",
  12          "who", "which", "with", "from", "that", "this", "into",
  13          "about", "does", "have", "has", "was", "were", "can",
  14          "you", "your", "any", "all", "not", "but", "its", "our",
  15          "their", "they", "them", "been", "will", "would", "should",
  16          "could", "than", "then", "also", "just", "more", "most",
  17          "some", "such", "only", "other", "over", "where", "there",
  18          "here", NULL
  19      };
```

Scan each stop word. strcmp returning zero means skip this word. Exhausting the list returns false.

```text
  20      int i;
  22      for (i = 0; stops[i] != NULL; i++) {
  23          if (strcmp(word, stops[i]) == 0) {
  24              return 1;
  25          }
  26      }
  27      return 0;
  28  }
```

Scan the populated keyword slots the same way. Return one on the first match, zero if the word is new.

```text
  30  static int keywordSeen(const char *word) {
  31      int i;
  33      for (i = 0; i < keywordCount; i++) {
  34          if (strcmp(keywords[i], word) == 0) {
  35              return 1;
  36          }
  37      }
  38      return 0;
  39  }
```

Use a pointer for the current token and an index for characters. Reset the count before reading this question.

```text
  41  void collectKeywords(char *buffer) {
  42      char *token;
  43      int i;
  45      keywordCount = 0;
```

Walk characters until the string terminator. Lowercase letters and replace other characters with spaces. The unsigned cast supplies a valid character value to the library functions.

```text
  46      for (i = 0; buffer[i] != '\0'; i++) {
  47          if (isalpha((unsigned char)buffer[i])) {
  48              buffer[i] = (char)tolower((unsigned char)buffer[i]);
  49          } else {
  50              buffer[i] = ' ';
  51          }
  52      }
```

Split at the first space-delimited word. Continue while a token exists and storage remains.

```text
  54      token = strtok(buffer, " ");
  55      while (token != NULL && keywordCount < MAX_KEYWORDS) {
```

Require length at least three, exclude stop words and duplicates, then copy at most 39 characters plus the terminator. Increment the populated count.

```text
  56          if (strlen(token) >= 3 && !isStopWord(token) && !keywordSeen(token)) {
  57              snprintf(keywords[keywordCount], MAX_WORD, "%s", token);
  58              keywordCount = keywordCount + 1;
  59          }
```

Ask strtok for the next token in the same modified buffer.

```text
  60          token = strtok(NULL, " ");
  61      }
  62  }
```

Copy a string one lowercased character at a time. Stop before the last destination slot and use that slot for the terminator when needed.

```text
  64  static void toLowerCopy(const char *src, char *dest, int destSize) {
  65      int i;
  67      for (i = 0; src[i] != '\0' && i < destSize - 1; i++) {
  68          dest[i] = (char)tolower((unsigned char)src[i]);
  69      }
  70      dest[i] = '\0';
  71  }
```

Save the length of the sought word and the starting search address. An empty word earns no match.

```text
  73  /* A keyword counts only as a whole word, not inside a longer word. */
  74  static int containsWord(const char *text, const char *word) {
  75      int wordLength = (int)strlen(word);
  76      const char *found = text;
  78      if (wordLength == 0) {
  79          return 0;
  80      }
```

Locate the next candidate substring. Check its left edge and right edge. Both must touch the text boundary or a nonletter.

```text
  82      while ((found = strstr(found, word)) != NULL) {
  83          int atStart = (found == text) || !isalpha((unsigned char)found[-1]);
  84          int atEnd = !isalpha((unsigned char)found[wordLength]);
```

Return one for the first whole-word match. Otherwise advance one character and search again. Return zero when candidates run out.

```text
  85          if (atStart && atEnd) {
  86              return 1;
  87          }
  88          found = found + 1;
  89      }
  90      return 0;
  91  }
```

Allocate lowercase buffers and start the score at zero. Make lowercase copies of the title and snippet.

```text
  93  /* Title match: +2. Snippet match: +1. Each keyword is counted once per field. */
  94  int calculateScore(const char *title, const char *snippet) {
  95      char lowerTitle[MAX_TITLE];
  96      char lowerSnippet[MAX_SNIPPET];
  97      int score = 0;
  98      int i;
 100      toLowerCopy(title, lowerTitle, MAX_TITLE);
 101      toLowerCopy(snippet, lowerSnippet, MAX_SNIPPET);
```

Test each keyword once per field. A title hit adds two. A snippet hit adds one. Return the sum.

```text
 103      for (i = 0; i < keywordCount; i++) {
 104          if (containsWord(lowerTitle, keywords[i])) {
 105              score = score + 2;
 106          }
 107          if (containsWord(lowerSnippet, keywords[i])) {
 108              score = score + 1;
 109          }
 110      }
 111      return score;
 112  }
```

## Website handoff

| File | What to demonstrate |
| --- | --- |
| `app/page.tsx` | Opens the home page and mounts the question interface. |
| `components/search-box.tsx` | Pankaj submits a question. The component sends JSON to the research route, then updates loading, error or result state. |
| `app/api/research/route.ts` | POST reads the question and calls searchWeb, rankPages and writeAnswer in order. It returns the answer and numbered sources. |
| `app/api/research/providers.ts` | searchWeb calls Firecrawl. writeAnswer passes only ranked excerpts to Groq. Both use postJson for HTTP requests. |
| `app/api/research/rank.ts` | scoutInput writes one field per line. runScout calls the C executable. selectPages matches its output IDs to the original pages. |
| `app/api/research/shared.ts` | Defines page records, request errors and the one-line text limits used by C. |
| `components/research-result.tsx` | Shivam follows a numbered citation from the answer to its source card. The process panel describes the C operations. |
