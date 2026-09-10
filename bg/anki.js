/**
 * This function interacts with Anki through localhost. Example use:
 * invoke('createDeck', {deck: 'test1'})
 * @param {string} Action to be performed in Anki (ex: 'deckNames').
 * @param {number} Version of Anki-connect.
 * @param {Object} Parameters to be passed with action.
 * @return {Object} Promise with the result from action in Anki.
 */
function invoke(action, version, params = {}) {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.addEventListener('error', () => {
            reject('failed to issue request')
        });
        xhr.addEventListener('load', () => {
            try {
                const response = JSON.parse(xhr.responseText);
                if (Object.getOwnPropertyNames(response).length != 2) {
                    throw 'response has an unexpected number of fields';
                }
                if (!response.hasOwnProperty('error')) {
                    throw 'response is missing required error field';
                }
                if (!response.hasOwnProperty('result')) {
                    throw 'response is missing required result field';
                }
                if (response.error) {
                    throw response.error;
                }
                resolve(response.result);
            } catch (e) {
                reject(e);
            }
        });

        xhr.open('POST', 'http://127.0.0.1:8765');
        xhr.send(JSON.stringify({action, version, params}));
    });
}

/**
 * @return {Object} Promise containing name of all decks in Anki.
 */
function getDeckNames() {
    return invoke('deckNames', 6);
}

/**
 * Reads the configured Anki deck name from storage, falling back to
 * DEFAULT_DECK_NAME when unset.
 * @return {Promise<string>} The configured deck name.
 */
function getDeckName() {
    return new Promise((resolve) => {
        chrome.storage.sync.get({deckName: DEFAULT_DECK_NAME}, (items) => {
            resolve(items.deckName);
        });
    });
}

/**
 * Pings Anki-connect to check whether Anki is available. Returns the
 * Anki-connect API version when reachable, or rejects otherwise.
 * @return {Object} Promise resolving to the Anki-connect version number.
 */
function getAnkiVersion() {
    return invoke('version', 6);
}

const DEFAULT_DECK_NAME = "Minerva Extension";
const MINERVA_MODEL_NAME = "minerva-popup-dictionary";
const MINERVA_MODEL_FIELDS = [
    "id", "word", "example-phrase", "definition", "page-title",
    "date-created", "frequency", "ipa"
];
const MINERVA_CLOZE_SCROLL_SCRIPT = `<script>
(function () {
    function scrollToCloze() {
        var cloze = document.querySelector(".cloze");
        if (!cloze) return;
        var vh = window.innerHeight || document.documentElement.clientHeight || 800;
        try {
            cloze.scrollIntoView({ block: "center", inline: "nearest", behavior: "auto" });
        } catch (e) {
            try { cloze.scrollIntoView(true); } catch (e2) {}
        }
        var rect = cloze.getBoundingClientRect();
        var current = window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0;
        var y = rect.top + current - vh / 2 + rect.height / 2;
        if (y < 0) y = 0;
        try { window.scrollTo(0, y); } catch (e) {}
        if (document.documentElement) { document.documentElement.scrollTop = y; }
        if (document.body) { document.body.scrollTop = y; }
        var node = cloze.parentElement;
        while (node) {
            if (node.scrollHeight > node.clientHeight + 1) {
                var nr = node.getBoundingClientRect();
                node.scrollTop += rect.top - nr.top - node.clientHeight / 2 + rect.height / 2;
            }
            node = node.parentElement;
        }
    }
    var delays = [0, 100, 300, 600];
    delays.forEach(function (ms) { setTimeout(scrollToCloze, ms); });
    window.addEventListener("load", function () {
        delays.forEach(function (ms) { setTimeout(scrollToCloze, ms); });
    });
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", function () {
            delays.forEach(function (ms) { setTimeout(scrollToCloze, ms); });
        });
    }
})();
</script>`;
const MINERVA_CARD_TEMPLATE = {
    Name: "Minerva Card",
    Front: "{{#page-title}}<div class=\"source\">{{page-title}}{{#date-created}} · {{date-created}}{{/date-created}}</div>{{/page-title}}{{cloze:example-phrase}}" + MINERVA_CLOZE_SCROLL_SCRIPT,
    Back: "{{#page-title}}<div class=\"source\">{{page-title}}{{#date-created}} · {{date-created}}{{/date-created}}</div>{{/page-title}}{{cloze:example-phrase}}{{#frequency}}<div class=\"frequency\">Freq: {{frequency}}</div>{{/frequency}}<hr id=\"answer\"><div class=\"answer-word\">{{word}}{{#ipa}} <span class=\"ipa\">/{{ipa}}/</span>{{/ipa}}</div><div class=\"definition\">{{definition}}</div>" + MINERVA_CLOZE_SCROLL_SCRIPT
};
const MINERVA_MODEL_CSS = `
.card {
    font-family: "Georgia", "Times New Roman", serif;
    font-size: 24px;
    text-align: left;
    color: #2d2a26;
    background-color: #fdfcfb;
    line-height: 1.75;
    padding: 56px 64px;
    max-width: 760px;
    margin: 0 auto;
    box-sizing: border-box;
    -webkit-font-smoothing: antialiased;
}

.cloze {
    font-weight: 700;
    color: #a0522d;
    border-bottom: 3px solid #d8b49a;
    padding: 0 4px;
}

hr#answer {
    border: 0;
    height: 1px;
    background: linear-gradient(to right, transparent, #d9d2c5, transparent);
    margin: 36px 0;
    width: 100%;
}

.definition {
    font-size: 19px;
    text-align: left;
    color: #55524c;
    line-height: 1.65;
    padding-left: 12px;
    border-left: 3px solid #d8b49a;
}

.definition ol {
    margin: 0;
    padding-left: 1.6em;
}

.definition li {
    margin: 0 0 0.35em;
    padding-left: 0.2em;
}

.definition > ol {
    margin-bottom: 1.2em;
}

.definition > ol:last-child {
    margin-bottom: 0;
}

.source, .frequency {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    font-size: 12px;
    color: #807a71;
    line-height: 1.4;
}

.source {
    margin-bottom: 18px;
}

.answer-word {
    font-size: 30px;
    font-weight: 700;
    color: #3f342c;
    margin-bottom: 14px;
}

.ipa {
    font-size: 20px;
    font-weight: 400;
    color: #807a71;
}

.frequency {
    margin-top: 18px;
}

.card p {
    margin: 0 0 0.75em;
}

.card.nightMode {
    color: #d6d0c8;
    background-color: #1f1e1c;
}

.card.nightMode .cloze {
    color: #f2a65a;
    border-bottom-color: #8a6a4a;
}

.card.nightMode .definition {
    color: #b8b2a9;
    border-left-color: #8a6a4a;
}

.card.nightMode .source, .card.nightMode .frequency {
    color: #aaa39a;
}

.card.nightMode .answer-word {
    color: #eee8e1;
}

.card.nightMode .ipa {
    color: #aaa39a;
}

.card.nightMode hr#answer {
    background: linear-gradient(to right, transparent, #4a443c, transparent);
}
`;

/**
 * @return {Object} Promise containing the names of all note models in Anki.
 */
function getModelNames() {
    return invoke('modelNames', 6);
}

/**
 * @param {string} modelName Name of the model whose fields are to be listed.
 * @return {Object} Promise containing the ordered field names of the model.
 */
function getModelFieldNames(modelName) {
    return invoke('modelFieldNames', 6, {modelName: modelName});
}

/**
 * @param {string} modelName Name of the model whose templates are to be listed.
 * @return {Object} Promise mapping each card template name to {Front, Back}.
 */
function getModelTemplates(modelName) {
    return invoke('modelTemplates', 6, {modelName: modelName});
}

/**
 * @param {string} modelName Name of the model whose styling is to be read.
 * @return {Object} Promise resolving to {css: string}.
 */
function getModelStyling(modelName) {
    return invoke('modelStyling', 6, {modelName: modelName});
}

/**
 * Updates the CSS of an existing Minerva model to match the desired styling.
 * It updates in place when supported. Styling is best-effort: a styling API
 * failure must never recreate a model or discard existing Minerva notes.
 * @return {Object} Promise resolving once the styling is up to date.
 */
async function updateMinervaStyling() {
    try {
        await reconcileMinervaStyling();
    } catch (e) {
        // Styling reconciliation is best-effort; never block card creation.
    }
}

async function reconcileMinervaStyling() {
    let currentCss;
    try {
        const styling = await getModelStyling(MINERVA_MODEL_NAME);
        currentCss = styling && styling.css != null ? styling.css : "";
    } catch (e) {
        // modelStyling is unavailable (older Anki-connect). Give up rather than
        // recreate, since a blind recreation would delete notes on every lookup.
        return;
    }
    if (currentCss.trim() === MINERVA_MODEL_CSS.trim()) {
        return;
    }
    try {
        await invoke('updateModelStyling', 6, {
            model: {name: MINERVA_MODEL_NAME, css: MINERVA_MODEL_CSS}
        });
    } catch (e) {
        // Styling remains unchanged when Anki-connect cannot update it.
    }
    // Leave the existing CSS in place if Anki-connect cannot update it. The
    // fields and templates—and, crucially, the user's notes—remain intact.
}

/**
 * Creates the note model ("card type") that Minerva uses: a cloze model whose
 * example phrase is the cloze field.
 * @return {Object} Promise resolving once the model has been created.
 */
function createMinervaModel() {
    return invoke('createModel', 6, {
        modelName: MINERVA_MODEL_NAME,
        inOrderFields: MINERVA_MODEL_FIELDS,
        css: MINERVA_MODEL_CSS,
        isCloze: true,
        cardTemplates: [MINERVA_CARD_TEMPLATE]
    });
}

/**
 * @param {Array} fields Ordered field names of an existing model.
 * @param {Object} templates Mapping returned by getModelTemplates.
 * @return {boolean} True iff the existing model matches Minerva's desired
 * configuration (fields and card template).
 */
function isDesiredModel(fields, templates) {
    if (JSON.stringify(fields) !== JSON.stringify(MINERVA_MODEL_FIELDS)) {
        return false;
    }
    const card = templates[MINERVA_CARD_TEMPLATE.Name];
    if (!card) {
        return false;
    }
    return card.Front === MINERVA_CARD_TEMPLATE.Front &&
           card.Back === MINERVA_CARD_TEMPLATE.Back;
}

/**
 * Appends newly introduced Minerva fields and updates the card template in
 * place. This preserves existing cards, whose new fields remain blank.
 * @param {Array<string>} fields Existing ordered model fields.
 * @return {Promise<boolean>} Whether the model was migrated successfully.
 */
async function migrateMinervaModel(fields) {
    const isKnownPrefix = fields.every((field, index) =>
        MINERVA_MODEL_FIELDS[index] === field
    );
    if (!isKnownPrefix || fields.length > MINERVA_MODEL_FIELDS.length) {
        return false;
    }
    try {
        for (let index = fields.length; index < MINERVA_MODEL_FIELDS.length; index++) {
            await invoke('modelFieldAdd', 6, {
                modelName: MINERVA_MODEL_NAME,
                fieldName: MINERVA_MODEL_FIELDS[index]
            });
        }
        await invoke('updateModelTemplates', 6, {
            model: {
                name: MINERVA_MODEL_NAME,
                templates: {[MINERVA_CARD_TEMPLATE.Name]: MINERVA_CARD_TEMPLATE}
            }
        });
        const updatedFields = await getModelFieldNames(MINERVA_MODEL_NAME);
        const updatedTemplates = await getModelTemplates(MINERVA_MODEL_NAME);
        return isDesiredModel(updatedFields, updatedTemplates);
    } catch (e) {
        return false;
    }
}

/**
 * Removes any notes using the Minerva model and then the (now empty) model
 * itself, so it can be recreated. Anki-connect offers no direct way to delete
 * or convert a model, so removeEmptyNotes is used to drop it once its notes
 * are gone (this also prunes any other unused models).
 * @return {Object} Promise resolving once the model has been removed.
 */
async function removeMinervaModel() {
    const noteIds = await invoke('findNotes', 6, {query: 'note:"' + MINERVA_MODEL_NAME + '"'});
    if (noteIds.length > 0) {
        await invoke('deleteNotes', 6, {notes: noteIds});
    }
    await invoke('removeEmptyNotes', 6);
}

/**
 * Ensures the Minerva note model exists with exactly the desired
 * configuration, creating it if missing and migrating known older versions
 * in place. A model with an unknown schema is left untouched to avoid
 * deleting user cards.
 * @return {Object} Promise resolving once the model is guaranteed correct.
 */
async function ensureMinervaModel() {
    const models = await getModelNames();
    if (!models.includes(MINERVA_MODEL_NAME)) {
        await createMinervaModel();
        return;
    }
    const fields = await getModelFieldNames(MINERVA_MODEL_NAME);
    const templates = await getModelTemplates(MINERVA_MODEL_NAME);
    if (!isDesiredModel(fields, templates)) {
        const migrated = await migrateMinervaModel(fields);
        if (!migrated) {
            throw new Error('Existing Minerva model could not be migrated safely.');
        }
    }
    await updateMinervaStyling();
}

/**
 * Ensures the deck notes are added to exists, creating it if necessary.
 * @param {string} deckName Name of the deck to ensure exists.
 * @return {Object} Promise resolving once the deck is guaranteed to exist.
 */
async function ensureDeck(deckName) {
    const decks = await getDeckNames();
    if (!decks.includes(deckName)) {
        await invoke('createDeck', 6, {deck: deckName});
    }
}

/**
 * Checks whether a card for the given word already exists in the configured
 * deck. This relies on Anki-connect's canAddNote, which uses the same
 * duplicate detection as addNote (first field = "id").
 * @param {string} word Word whose existence is to be checked.
 * @return {Promise<boolean>} True iff a card for the word already exists.
 */
async function wordExistsInDeck(word) {
    await ensureMinervaModel();
    const deckName = await getDeckName();
    await ensureDeck(deckName);
    const canAdd = await invoke('canAddNote', 6, {
        note: {
            deckName: deckName,
            modelName: MINERVA_MODEL_NAME,
            fields: {
                "id": word,
                "word": word,
                "example-phrase": "",
                "definition": "",
                "page-title": "",
                "date-created": "",
                "frequency": "",
                "ipa": ""
            },
            options: {
                "allowDuplicate": false,
                "duplicateScope": "deck",
                "duplicateScopeOptions": {
                    "deckName": deckName,
                    "checkChildren": false
                }
            }
        }
    });
    return !canAdd;
}

/**
 * This function adds a card to Anki through anki-connect.
 * @param {string} ID of the word dfn to be added (which uniquely identifies it).
 * There can be many of these for each word.
 * @param {string} Word to be added.
 * @param {string} Example phrase to be added.
 * @param {string} Definition relative to ID to be added.
 * @param {string} pageTitle Title of the source page.
 * @param {string} dateCreated Date on which the card was created.
 * @param {string} frequency Word frequency rank.
 * @param {string} ipa Word IPA transcription.
 * @return {Object} Promise containing status of request to add card.
 */
async function addCard(id, word, phrase, dfn, pageTitle, dateCreated, frequency, ipa) {
    //deck = 'minerva-popup-dictionary';
    //return invoke('deckNames', 6);
    //return invoke('createDeck', 6, {deck: 'test1'});
    await ensureMinervaModel();
    const deckName = await getDeckName();
    await ensureDeck(deckName);
    params = {
        "note": {
            "deckName": deckName,
            "modelName": MINERVA_MODEL_NAME,
            "fields": {
                "id": id,
                "word": word,
                "example-phrase": phrase,
                "definition": dfn,
                "page-title": pageTitle,
                "date-created": dateCreated,
                "frequency": frequency,
                "ipa": ipa
            },
            "options": {
                "allowDuplicate": false,
                "duplicateScope": "deck",
                "duplicateScopeOptions": {
                    "deckName": deckName,
                    "checkChildren": false
                }
            }
        }
    }
    let ret =  invoke('addNote', 6, params);
    //alert(JSON.stringify(params));
    return ret;
}
