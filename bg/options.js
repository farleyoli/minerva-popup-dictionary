const DECK_NAME_KEY = "deckName";
const DEFAULT_DECK_NAME = "Minerva Extension";
const EXAMPLE_PHRASES_BEFORE_KEY = "examplePhrasesBefore";
const EXAMPLE_PHRASES_AFTER_KEY = "examplePhrasesAfter";
const DEFAULT_EXAMPLE_PHRASES_BEFORE = 2;
const DEFAULT_EXAMPLE_PHRASES_AFTER = 1;
const CARD_TYPE_KEY = "cardType";
const DEFAULT_CARD_TYPE = "page";
const DEEPSEEK_API_KEY_KEY = "deepseekApiKey";
const DEEPSEEK_DAILY_TOKEN_LIMIT_KEY = "deepseekDailyTokenLimit";
const DEFAULT_DAILY_TOKEN_LIMIT = 30000;

function normalizePhraseCount(value, fallback) {
    const count = Number(value);
    return value !== '' && Number.isInteger(count) && count >= 0 ? count : fallback;
}

function normalizeCardType(value) {
    return value === "deepseek" ? "deepseek" : DEFAULT_CARD_TYPE;
}

function normalizeTokenLimit(value, fallback) {
    const limit = Number(value);
    return value !== '' && Number.isInteger(limit) && limit >= 0 ? limit : fallback;
}

document.addEventListener("DOMContentLoaded", function() {
    const deckNameInput = document.getElementById("deckName");
    const cardTypeInput = document.getElementById("cardType");
    const apiKeyInput = document.getElementById("deepseekApiKey");
    const tokenLimitInput = document.getElementById("deepseekDailyTokenLimit");
    const phrasesBeforeInput = document.getElementById("examplePhrasesBefore");
    const phrasesAfterInput = document.getElementById("examplePhrasesAfter");
    const saveButton = document.getElementById("save");
    const status = document.getElementById("status");

    chrome.storage.sync.get({
        [DECK_NAME_KEY]: DEFAULT_DECK_NAME,
        [EXAMPLE_PHRASES_BEFORE_KEY]: DEFAULT_EXAMPLE_PHRASES_BEFORE,
        [EXAMPLE_PHRASES_AFTER_KEY]: DEFAULT_EXAMPLE_PHRASES_AFTER,
        [CARD_TYPE_KEY]: DEFAULT_CARD_TYPE,
        [DEEPSEEK_DAILY_TOKEN_LIMIT_KEY]: DEFAULT_DAILY_TOKEN_LIMIT
    }, function(items) {
        deckNameInput.value = items[DECK_NAME_KEY];
        cardTypeInput.value = normalizeCardType(items[CARD_TYPE_KEY]);
        tokenLimitInput.value = normalizeTokenLimit(
            items[DEEPSEEK_DAILY_TOKEN_LIMIT_KEY], DEFAULT_DAILY_TOKEN_LIMIT
        );
        phrasesBeforeInput.value = normalizePhraseCount(
            items[EXAMPLE_PHRASES_BEFORE_KEY], DEFAULT_EXAMPLE_PHRASES_BEFORE
        );
        phrasesAfterInput.value = normalizePhraseCount(
            items[EXAMPLE_PHRASES_AFTER_KEY], DEFAULT_EXAMPLE_PHRASES_AFTER);
    });

    chrome.storage.local.get({[DEEPSEEK_API_KEY_KEY]: ""}, function(items) {
        apiKeyInput.value = items[DEEPSEEK_API_KEY_KEY] || "";
    });

    saveButton.addEventListener("click", function() {
        const deckName = deckNameInput.value.trim() || DEFAULT_DECK_NAME;
        const cardType = normalizeCardType(cardTypeInput.value);
        const tokenLimit = normalizeTokenLimit(
            tokenLimitInput.value, DEFAULT_DAILY_TOKEN_LIMIT
        );
        const phrasesBefore = normalizePhraseCount(
            phrasesBeforeInput.value, DEFAULT_EXAMPLE_PHRASES_BEFORE
        );
        const phrasesAfter = normalizePhraseCount(
            phrasesAfterInput.value, DEFAULT_EXAMPLE_PHRASES_AFTER
        );
        tokenLimitInput.value = tokenLimit;
        phrasesBeforeInput.value = phrasesBefore;
        phrasesAfterInput.value = phrasesAfter;
        chrome.storage.sync.set({
            [DECK_NAME_KEY]: deckName,
            [CARD_TYPE_KEY]: cardType,
            [DEEPSEEK_DAILY_TOKEN_LIMIT_KEY]: tokenLimit,
            [EXAMPLE_PHRASES_BEFORE_KEY]: phrasesBefore,
            [EXAMPLE_PHRASES_AFTER_KEY]: phrasesAfter
        }, function() {
            chrome.storage.local.set({
                [DEEPSEEK_API_KEY_KEY]: apiKeyInput.value.trim()
            }, function() {
                status.textContent = "Saved.";
                setTimeout(function() { status.textContent = ""; }, 2000);
            });
        });
    });
});
