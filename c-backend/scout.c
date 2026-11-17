#include "scout.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

static int readLine(char *buffer, int size) {
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

int main(void) {
    struct Incoming incoming[MAX_SOURCES];
    struct Ranked ranked[MAX_SOURCES];
    struct Queue queue = {0};
    struct Source *head = NULL;
    char question[MAX_QUESTION];
    char line[MAX_LINE];
    int count;
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
        struct Incoming *item = &incoming[i];

        if (!readLine(idLine, sizeof idLine) || !readLine(item->title, sizeof item->title) ||
            !readLine(item->url, sizeof item->url) || !readLine(item->snippet, sizeof item->snippet)) {
            fprintf(stderr, "Stopped early: incomplete source\n");
            break;
        }

        item->id = atoi(idLine);
        enqueue(&queue, i);
    }

    collectKeywords(question);

    while (queue.front < queue.rear) {
        int index = dequeue(&queue);
        struct Incoming *item = &incoming[index];
        int id = item->id;
        struct Source *updated;

        fprintf(stderr, "Dequeued id %d\n", id);
        if (item->url[0] == '\0') {
            fprintf(stderr, "Skipped id %d\n", id);
            continue;
        }
        if (sourceExists(head, item->url)) {
            fprintf(stderr, "Duplicate URL, skipped id %d\n", id);
            continue;
        }

        updated = addSource(head, item);
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
