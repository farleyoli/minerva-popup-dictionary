const DECK_NAME_KEY = "deckName";
const DEFAULT_DECK_NAME = "Minerva Extension";
const EXAMPLE_PHRASES_BEFORE_KEY = "examplePhrasesBefore";
const EXAMPLE_PHRASES_AFTER_KEY = "examplePhrasesAfter";
const DEFAULT_EXAMPLE_PHRASES_BEFORE = 1;
const DEFAULT_EXAMPLE_PHRASES_AFTER = 1;

function normalizePhraseCount(value, fallback) {
    const count = Number(value);
    return value !== '' && Number.isInteger(count) && count >= 0 ? count : fallback;
}

document.addEventListener("DOMContentLoaded", function() {
    const deckNameInput = document.getElementById("deckName");
    const phrasesBeforeInput = document.getElementById("examplePhrasesBefore");
    const phrasesAfterInput = document.getElementById("examplePhrasesAfter");
    const saveButton = document.getElementById("save");
    const status = document.getElementById("status");

    chrome.storage.sync.get({
        [DECK_NAME_KEY]: DEFAULT_DECK_NAME,
        [EXAMPLE_PHRASES_BEFORE_KEY]: DEFAULT_EXAMPLE_PHRASES_BEFORE,
        [EXAMPLE_PHRASES_AFTER_KEY]: DEFAULT_EXAMPLE_PHRASES_AFTER
    }, function(items) {
        deckNameInput.value = items[DECK_NAME_KEY];
        phrasesBeforeInput.value = normalizePhraseCount(
            items[EXAMPLE_PHRASES_BEFORE_KEY], DEFAULT_EXAMPLE_PHRASES_BEFORE
        );
        phrasesAfterInput.value = normalizePhraseCount(
            items[EXAMPLE_PHRASES_AFTER_KEY], DEFAULT_EXAMPLE_PHRASES_AFTER);
    });

    saveButton.addEventListener("click", function() {
        const deckName = deckNameInput.value.trim() || DEFAULT_DECK_NAME;
        const phrasesBefore = normalizePhraseCount(
            phrasesBeforeInput.value, DEFAULT_EXAMPLE_PHRASES_BEFORE
        );
        const phrasesAfter = normalizePhraseCount(
            phrasesAfterInput.value, DEFAULT_EXAMPLE_PHRASES_AFTER
        );
        phrasesBeforeInput.value = phrasesBefore;
        phrasesAfterInput.value = phrasesAfter;
        chrome.storage.sync.set({
            [DECK_NAME_KEY]: deckName,
            [EXAMPLE_PHRASES_BEFORE_KEY]: phrasesBefore,
            [EXAMPLE_PHRASES_AFTER_KEY]: phrasesAfter
        }, function() {
            status.textContent = "Saved.";
            setTimeout(function() { status.textContent = ""; }, 2000);
        });
    });
});
