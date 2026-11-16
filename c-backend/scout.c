/*
 * SCOUT source ranker
 *
 * A small C program for a data-structures lab. It reads a question and
 * up to 10 webpages from stdin, then:
 *   1. Puts webpage ids in a queue
 *   2. Stores unique pages in a linked list
 *   3. Uses linear search to skip duplicate URLs
 *   4. Scores pages from the question keywords
 *   5. Bubble-sorts those scores and prints the best 3 to 5
 *
 * Input, one field per line:
 *   question
 *   count
 *   id
 *   title
 *   url
 *   snippet
 *   (id, title, url, and snippet repeat count times)
 *
 * Stdout is machine-readable. Each selected page is one line:
 *   id score
 *
 * Notes for humans go to stderr.
 */

#include <ctype.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#define MAX_SOURCES 10
#define MAX_TITLE 200
#define MAX_URL 500
#define MAX_SNIPPET 1000
#define MAX_QUESTION 500
#define MAX_LINE 1200
#define MAX_KEYWORDS 20
#define MAX_WORD 40
#define MAX_PICK 5
#define MIN_PICK 3

struct Source {
    int id;
    char title[MAX_TITLE];
    char url[MAX_URL];
    char snippet[MAX_SNIPPET];
    int score;
    struct Source *next;
};

struct Incoming {
    int id;
    char title[MAX_TITLE];
    char url[MAX_URL];
    char snippet[MAX_SNIPPET];
};

struct Queue {
    int items[MAX_SOURCES];
    int front;
    int rear;
};

struct Ranked {
    int id;
    int score;
};

char keywords[MAX_KEYWORDS][MAX_WORD];
int keywordCount = 0;

void copyText(char *dest, const char *src, int destSize) {
    int i;

    for (i = 0; i < destSize - 1 && src[i] != '\0'; i++) {
        dest[i] = src[i];
    }
    dest[i] = '\0';
}

int readLine(char *buffer, int size) {
    int extra;
    size_t length;

    if (fgets(buffer, size, stdin) == NULL) {
        return 0;
    }

    length = strlen(buffer);
    if (length == 0 || buffer[length - 1] != '\n') {
        while ((extra = getchar()) != '\n' && extra != EOF) {
        }
    }

    if (length > 0 && buffer[length - 1] == '\n') {
        buffer[length - 1] = '\0';
        length--;
    }
    if (length > 0 && buffer[length - 1] == '\r') {
        buffer[length - 1] = '\0';
    }
    return 1;
}

void enqueue(struct Queue *queue, int id) {
    if (queue->rear >= MAX_SOURCES) {
        fprintf(stderr, "Queue is full\n");
        return;
    }
    queue->items[queue->rear] = id;
    queue->rear = queue->rear + 1;
    fprintf(stderr, "Enqueued id %d\n", id);
}

int dequeue(struct Queue *queue) {
    int id;

    if (queue->front >= queue->rear) {
        return -1;
    }
    id = queue->items[queue->front];
    queue->front = queue->front + 1;
    return id;
}

/* Linear search: walk every node and compare the URL. */
int sourceExists(struct Source *head, const char *url) {
    struct Source *current = head;

    while (current != NULL) {
        if (strcmp(current->url, url) == 0) {
            return 1;
        }
        current = current->next;
    }
    return 0;
}

int isStopWord(const char *word) {
    const char *stops[] = {
        "the", "and", "for", "are", "what", "how", "why", "when",
        "who", "which", "with", "from", "that", "this", "into",
        "about", "does", "have", "has", "was", "were", "can",
        "you", "your", "any", "all", "not", "but", "its", "our",
        "their", "they", "them", "been", "will", "would", "should",
        "could", "than", "then", "also", "just", "more", "most",
        "some", "such", "only", "other", "over", "where", "there",
        "here", NULL
    };
    int i;

    for (i = 0; stops[i] != NULL; i++) {
        if (strcmp(word, stops[i]) == 0) {
            return 1;
        }
    }
    return 0;
}

int keywordSeen(const char *word) {
    int i;

    for (i = 0; i < keywordCount; i++) {
        if (strcmp(keywords[i], word) == 0) {
            return 1;
        }
    }
    return 0;
}

void collectKeywords(const char *question) {
    char buffer[MAX_QUESTION];
    char *token;
    int i;

    copyText(buffer, question, MAX_QUESTION);
    for (i = 0; buffer[i] != '\0'; i++) {
        if (isalpha((unsigned char)buffer[i])) {
            buffer[i] = (char)tolower((unsigned char)buffer[i]);
        } else {
            buffer[i] = ' ';
        }
    }

    token = strtok(buffer, " ");
    while (token != NULL && keywordCount < MAX_KEYWORDS) {
        if (strlen(token) >= 3 && !isStopWord(token) && !keywordSeen(token)) {
            copyText(keywords[keywordCount], token, MAX_WORD);
            keywordCount = keywordCount + 1;
        }
        token = strtok(NULL, " ");
    }
}

void toLowerCopy(const char *src, char *dest, int destSize) {
    int i;

    for (i = 0; src[i] != '\0' && i < destSize - 1; i++) {
        dest[i] = (char)tolower((unsigned char)src[i]);
    }
    dest[i] = '\0';
}

/* A keyword counts only as a whole word, not inside a longer word. */
int containsWord(const char *text, const char *word) {
    int wordLength = (int)strlen(word);
    const char *found = text;

    if (wordLength == 0) {
        return 0;
    }

    while ((found = strstr(found, word)) != NULL) {
        int atStart = (found == text) || !isalpha((unsigned char)found[-1]);
        int atEnd = !isalpha((unsigned char)found[wordLength]);
        if (atStart && atEnd) {
            return 1;
        }
        found = found + 1;
    }
    return 0;
}

/* Title match: +2. Snippet match: +1. Each keyword is counted once per field. */
int calculateScore(const char *title, const char *snippet) {
    char lowerTitle[MAX_TITLE];
    char lowerSnippet[MAX_SNIPPET];
    int score = 0;
    int i;

    toLowerCopy(title, lowerTitle, MAX_TITLE);
    toLowerCopy(snippet, lowerSnippet, MAX_SNIPPET);

    for (i = 0; i < keywordCount; i++) {
        if (containsWord(lowerTitle, keywords[i])) {
            score = score + 2;
        }
        if (containsWord(lowerSnippet, keywords[i])) {
            score = score + 1;
        }
    }
    return score;
}

struct Source *addSource(struct Source *head, int id, const char *title, const char *url, const char *snippet) {
    struct Source *node = (struct Source *)malloc(sizeof(struct Source));
    struct Source *current;

    if (node == NULL) {
        fprintf(stderr, "malloc failed\n");
        return NULL;
    }

    node->id = id;
    copyText(node->title, title, MAX_TITLE);
    copyText(node->url, url, MAX_URL);
    copyText(node->snippet, snippet, MAX_SNIPPET);
    node->score = calculateScore(title, snippet);
    node->next = NULL;
    fprintf(stderr, "Added id %d with score %d\n", id, node->score);

    if (head == NULL) {
        return node;
    }

    current = head;
    while (current->next != NULL) {
        current = current->next;
    }
    current->next = node;
    return head;
}

void freeSources(struct Source *head) {
    struct Source *current = head;

    while (current != NULL) {
        struct Source *next = current->next;
        free(current);
        current = next;
    }
}

void bubbleSort(struct Ranked items[], int n) {
    int i;
    int j;

    for (i = 0; i < n - 1; i++) {
        for (j = 0; j < n - 1 - i; j++) {
            if (items[j].score < items[j + 1].score) {
                struct Ranked temp = items[j];
                items[j] = items[j + 1];
                items[j + 1] = temp;
            }
        }
    }
}

int copyScores(struct Source *head, struct Ranked items[]) {
    struct Source *current = head;
    int n = 0;

    while (current != NULL && n < MAX_SOURCES) {
        items[n].id = current->id;
        items[n].score = current->score;
        n = n + 1;
        current = current->next;
    }
    return n;
}

struct Incoming *findIncoming(struct Incoming incoming[], int count, int id) {
    int i;

    for (i = 0; i < count; i++) {
        if (incoming[i].id == id) {
            return &incoming[i];
        }
    }
    return NULL;
}

int main(void) {
    struct Incoming incoming[MAX_SOURCES];
    struct Ranked ranked[MAX_SOURCES];
    struct Queue queue;
    struct Source *head = NULL;
    char question[MAX_QUESTION];
    char line[MAX_LINE];
    int count;
    int loaded = 0;
    int rankedCount;
    int picked = 0;
    int i;

    if (!readLine(question, MAX_QUESTION)) {
        fprintf(stderr, "Missing question\n");
        return 1;
    }
    if (!readLine(line, MAX_LINE)) {
        fprintf(stderr, "Missing source count\n");
        return 1;
    }

    count = atoi(line);
    if (count < 0) {
        count = 0;
    }
    if (count > MAX_SOURCES) {
        fprintf(stderr, "Count capped at %d\n", MAX_SOURCES);
        count = MAX_SOURCES;
    }

    for (i = 0; i < count; i++) {
        char idLine[32];
        char title[MAX_TITLE];
        char url[MAX_URL];
        char snippet[MAX_SNIPPET];

        if (!readLine(idLine, 32) || !readLine(title, MAX_TITLE) ||
            !readLine(url, MAX_URL) || !readLine(snippet, MAX_SNIPPET)) {
            fprintf(stderr, "Stopped early: incomplete source\n");
            break;
        }

        incoming[loaded].id = atoi(idLine);
        copyText(incoming[loaded].title, title, MAX_TITLE);
        copyText(incoming[loaded].url, url, MAX_URL);
        copyText(incoming[loaded].snippet, snippet, MAX_SNIPPET);
        loaded = loaded + 1;
    }

    collectKeywords(question);
    fprintf(stderr, "Keywords:");
    for (i = 0; i < keywordCount; i++) {
        fprintf(stderr, " %s", keywords[i]);
    }
    fprintf(stderr, "\n");

    queue.front = 0;
    queue.rear = 0;
    for (i = 0; i < loaded; i++) {
        enqueue(&queue, incoming[i].id);
    }

    while (1) {
        int id = dequeue(&queue);
        struct Incoming *item;
        struct Source *updated;

        if (id == -1) {
            break;
        }

        fprintf(stderr, "Dequeued id %d\n", id);
        item = findIncoming(incoming, loaded, id);
        if (item == NULL || item->url[0] == '\0') {
            fprintf(stderr, "Skipped id %d\n", id);
            continue;
        }
        if (sourceExists(head, item->url)) {
            fprintf(stderr, "Duplicate URL, skipped id %d\n", id);
            continue;
        }

        updated = addSource(head, item->id, item->title, item->url, item->snippet);
        if (updated == NULL) {
            freeSources(head);
            return 1;
        }
        head = updated;
    }

    rankedCount = copyScores(head, ranked);
    bubbleSort(ranked, rankedCount);

    fprintf(stderr, "Sorted:");
    for (i = 0; i < rankedCount; i++) {
        fprintf(stderr, " %d(%d)", ranked[i].id, ranked[i].score);
    }
    fprintf(stderr, "\n");

    for (i = 0; i < rankedCount && picked < MAX_PICK; i++) {
        if (ranked[i].score == 0 && picked >= MIN_PICK) {
            break;
        }
        printf("%d %d\n", ranked[i].id, ranked[i].score);
        fprintf(stderr, "Selected id %d score %d\n", ranked[i].id, ranked[i].score);
        picked = picked + 1;
    }

    freeSources(head);
    fflush(stdout);
    return 0;
}
