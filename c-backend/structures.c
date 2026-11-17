#include "scout.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

void enqueue(struct Queue *queue, int index) {
    if (queue->rear >= MAX_SOURCES) {
        fprintf(stderr, "Queue is full\n");
        return;
    }
    queue->items[queue->rear] = index;
    queue->rear = queue->rear + 1;
}

int dequeue(struct Queue *queue) {
    int index;

    if (queue->front >= queue->rear) {
        return -1;
    }
    index = queue->items[queue->front];
    queue->front = queue->front + 1;
    return index;
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

struct Source *addSource(struct Source *head, const struct Incoming *item) {
    struct Source *node = malloc(sizeof *node);
    struct Source *current;

    if (node == NULL) {
        fprintf(stderr, "malloc failed\n");
        return NULL;
    }

    node->id = item->id;
    strcpy(node->title, item->title);
    strcpy(node->url, item->url);
    strcpy(node->snippet, item->snippet);
    node->score = calculateScore(item->title, item->snippet);
    node->next = NULL;
    fprintf(stderr, "Added id %d with score %d\n", item->id, node->score);

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
