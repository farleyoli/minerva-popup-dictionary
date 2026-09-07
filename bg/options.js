const DECK_NAME_KEY = "deckName";
const DEFAULT_DECK_NAME = "Minerva Extension";

document.addEventListener("DOMContentLoaded", function() {
    const deckNameInput = document.getElementById("deckName");
    const saveButton = document.getElementById("save");
    const status = document.getElementById("status");

    chrome.storage.sync.get({[DECK_NAME_KEY]: DEFAULT_DECK_NAME}, function(items) {
        deckNameInput.value = items[DECK_NAME_KEY];
    });

    saveButton.addEventListener("click", function() {
        const deckName = deckNameInput.value.trim() || DEFAULT_DECK_NAME;
        chrome.storage.sync.set({[DECK_NAME_KEY]: deckName}, function() {
            status.textContent = "Saved.";
            setTimeout(function() { status.textContent = ""; }, 2000);
        });
    });
});
