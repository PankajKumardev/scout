# Scout — team roles

| Feature | Team member | Implementation |
| --- | --- | --- |
| Question form | Pankaj | Accept the question, submit it to the research route, and show loading and error states. [search-box.tsx](components/search-box.tsx) |
| C input and processing order | Pankaj | Read the question and page records, enqueue each page’s array index, and process pages in arrival order. [scout.c](c-backend/scout.c) |
| Queue and linked list | Pankaj | Implement `enqueue` and `dequeue`. Search the list for duplicate URLs with `sourceExists`, append unique pages with `addSource`, and release nodes with `freeSources`. [structures.c](c-backend/structures.c) |
| Keyword scoring | Shivam | Extract distinct question keywords and score whole-word matches. Each matching keyword earns two points in the title and one in the snippet. [scoring.c](c-backend/scoring.c) |
| Ranking | Shivam | Copy each page’s ID and score into an array with `copyScores`, then order the pairs by descending score with `bubbleSort`. [structures.c](c-backend/structures.c) |
| Web integration and results | Shivam | Fetch candidate pages, run the C executable, send selected sources to the answer service, and display the answer with its source cards. [route.ts](app/api/research/route.ts) · [research-result.tsx](components/research-result.tsx) |

**Shared file boundary.** In `structures.c`, Pankaj owns the queue and the lifetime of each list node. Shivam owns the conversion from the list to ranking pairs and the sort. Both parts use the record definitions in [scout.h](c-backend/scout.h).
