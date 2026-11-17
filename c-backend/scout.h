#ifndef SCOUT_H
#define SCOUT_H

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

void collectKeywords(char *question);
int calculateScore(const char *title, const char *snippet);
void enqueue(struct Queue *queue, int index);
int dequeue(struct Queue *queue);
int sourceExists(struct Source *head, const char *url);
struct Source *addSource(struct Source *head, const struct Incoming *item);
void freeSources(struct Source *head);
int copyScores(struct Source *head, struct Ranked items[]);
void bubbleSort(struct Ranked items[], int n);

#endif
