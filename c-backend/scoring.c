#include "scout.h"
#include <ctype.h>
#include <stdio.h>
#include <string.h>

static char keywords[MAX_KEYWORDS][MAX_WORD];
static int keywordCount;

// Check for common words like the and what
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

    for (int i = 0; stops[i] != NULL; i++) {
        if (strcmp(word, stops[i]) == 0) {
            return 1;
        }
    }
    return 0;
}

// Check if we already saved this keyword
static int keywordSeen(const char *word) {
    for (int i = 0; i < keywordCount; i++) {
        if (strcmp(keywords[i], word) == 0) {
            return 1;
        }
    }
    return 0;
}

// Pick useful words from the question
void collectKeywords(char *buffer) {
    keywordCount = 0;
    for (int i = 0; buffer[i] != '\0'; i++) {
        if (isalpha((unsigned char)buffer[i])) {
            buffer[i] = (char)tolower((unsigned char)buffer[i]);
        } else {
            buffer[i] = ' ';
        }
    }

    char *token = strtok(buffer, " ");
    while (token != NULL && keywordCount < MAX_KEYWORDS) {
        if (strlen(token) >= 3 && !isStopWord(token) && !keywordSeen(token)) {
            snprintf(keywords[keywordCount], MAX_WORD, "%s", token);
            keywordCount = keywordCount + 1;
        }
        token = strtok(NULL, " ");
    }
}

// Copy the text in lowercase
static void toLowerCopy(const char *src, char *dest, int destSize) {
    int i;
    for (i = 0; src[i] != '\0' && i < destSize - 1; i++) {
        dest[i] = (char)tolower((unsigned char)src[i]);
    }
    dest[i] = '\0';
}

// Match a full word, like solar in solar energy
static int containsWord(const char *text, const char *word) {
    int wordLength = (int)strlen(word);
    if (wordLength == 0) {
        return 0;
    }

    const char *found = strstr(text, word);
    while (found != NULL) {
        int atStart = (found == text) || !isalpha((unsigned char)found[-1]);
        int atEnd = !isalpha((unsigned char)found[wordLength]);
        if (atStart && atEnd) {
            return 1;
        }
        found = strstr(found + 1, word);
    }
    return 0;
}

// Add 2 for a title match and 1 for a description match
int calculateScore(const char *title, const char *snippet) {
    char lowerTitle[MAX_TITLE];
    char lowerSnippet[MAX_SNIPPET];
    int score = 0;

    toLowerCopy(title, lowerTitle, MAX_TITLE);
    toLowerCopy(snippet, lowerSnippet, MAX_SNIPPET);

    for (int i = 0; i < keywordCount; i++) {
        if (containsWord(lowerTitle, keywords[i])) {
            score = score + 2;
        }
        if (containsWord(lowerSnippet, keywords[i])) {
            score = score + 1;
        }
    }
    return score;
}
