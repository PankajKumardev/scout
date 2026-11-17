#include "scout.h"
#include <ctype.h>
#include <stdio.h>
#include <string.h>

static char keywords[MAX_KEYWORDS][MAX_WORD];
static int keywordCount;

static int isStopWord(const char *word) {
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

static int keywordSeen(const char *word) {
    int i;

    for (i = 0; i < keywordCount; i++) {
        if (strcmp(keywords[i], word) == 0) {
            return 1;
        }
    }
    return 0;
}

void collectKeywords(char *buffer) {
    char *token;
    int i;

    keywordCount = 0;
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
            snprintf(keywords[keywordCount], MAX_WORD, "%s", token);
            keywordCount = keywordCount + 1;
        }
        token = strtok(NULL, " ");
    }
}

static void toLowerCopy(const char *src, char *dest, int destSize) {
    int i;

    for (i = 0; src[i] != '\0' && i < destSize - 1; i++) {
        dest[i] = (char)tolower((unsigned char)src[i]);
    }
    dest[i] = '\0';
}

/* A keyword counts only as a whole word, not inside a longer word. */
static int containsWord(const char *text, const char *word) {
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
