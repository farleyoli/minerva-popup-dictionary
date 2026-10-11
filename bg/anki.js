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

// Description of an Anki note model ("card type") managed by Minerva. The
// lifecycle helpers below are generic over these descriptors so additional
// models can be added without duplicating the reconciliation logic.
const MINERVA_MODEL = {
    name: "minerva-popup-dictionary",
    fields: MINERVA_MODEL_FIELDS,
    template: MINERVA_CARD_TEMPLATE,
    css: MINERVA_MODEL_CSS,
    isCloze: true
};

// Model used for cards whose example phrase is generated by the DeepSeek API.
// It shares the Minerva card design but adds an answer-side "original-phrase"
// field holding the context captured from the page and a "japanese-definition"
// field holding a simple Japanese gloss. New fields are appended at the end so
// models created by earlier versions can be migrated in place without touching
// their existing notes.
const AI_MODEL_FIELDS = [
    "id", "word", "example-phrase", "original-phrase", "definition",
    "page-title", "date-created", "frequency", "ipa", "japanese-definition"
];
const AI_CARD_TEMPLATE = {
    Name: "Minerva AI Card",
    Front: "{{#page-title}}<div class=\"source\">{{page-title}}{{#date-created}} · {{date-created}}{{/date-created}}</div>{{/page-title}}{{cloze:example-phrase}}" + MINERVA_CLOZE_SCROLL_SCRIPT,
    Back: "{{#page-title}}<div class=\"source\">{{page-title}}{{#date-created}} · {{date-created}}{{/date-created}}</div>{{/page-title}}{{cloze:example-phrase}}{{#frequency}}<div class=\"frequency\">Freq: {{frequency}}</div>{{/frequency}}<hr id=\"answer\"><div class=\"answer-word\">{{word}}{{#ipa}} <span class=\"ipa\">/{{ipa}}/</span>{{/ipa}}</div><div class=\"definition\">{{definition}}</div>{{#japanese-definition}}<div class=\"japanese-definition\">{{japanese-definition}}</div>{{/japanese-definition}}{{#original-phrase}}<div class=\"original-phrase\"><div class=\"original-phrase-label\">Original context</div>{{original-phrase}}</div>{{/original-phrase}}" + MINERVA_CLOZE_SCROLL_SCRIPT
};
const AI_MODEL_EXTRA_CSS = `
.japanese-definition {
    margin-top: 14px;
    font-family: "Hiragino Kaku Gothic ProN", "Yu Gothic", "Meiryo", sans-serif;
    font-size: 26px;
    font-weight: 700;
    color: #3f342c;
    line-height: 1.5;
    letter-spacing: 0.02em;
    padding-left: 15px;
}

.card.nightMode .japanese-definition {
    color: #eee8e1;
}

.original-phrase {
    margin-top: 28px;
    padding-top: 16px;
    border-top: 1px dashed #d9d2c5;
    font-size: 15px;
    color: #807a71;
    line-height: 1.6;
}

.original-phrase-label {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #a39b90;
    margin-bottom: 6px;
}

.card.nightMode .original-phrase {
    border-top-color: #4a443c;
    color: #aaa39a;
}

.card.nightMode .original-phrase-label {
    color: #807a71;
}
`;
const AI_MODEL_CSS = MINERVA_MODEL_CSS + AI_MODEL_EXTRA_CSS;
const AI_MODEL = {
    name: "minerva-popup-dictionary-ai",
    fields: AI_MODEL_FIELDS,
    template: AI_CARD_TEMPLATE,
    css: AI_MODEL_CSS,
    isCloze: true
};

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
 * Updates the CSS of an existing model to match the desired styling.
 * It updates in place when supported. Styling is best-effort: a styling API
 * failure must never recreate a model or discard existing notes.
 * @param {Object} model Model descriptor whose styling is to be updated.
 * @return {Object} Promise resolving once the styling is up to date.
 */
async function updateModelStyling(model) {
    try {
        await reconcileModelStyling(model);
    } catch (e) {
        // Styling reconciliation is best-effort; never block card creation.
    }
}

/**
 * @param {Object} model Model descriptor whose styling is to be reconciled.
 * @return {Object} Promise resolving once reconciliation has been attempted.
 */
async function reconcileModelStyling(model) {
    let currentCss;
    try {
        const styling = await getModelStyling(model.name);
        currentCss = styling && styling.css != null ? styling.css : "";
    } catch (e) {
        // modelStyling is unavailable (older Anki-connect). Give up rather than
        // recreate, since a blind recreation would delete notes on every lookup.
        return;
    }
    if (currentCss.trim() === model.css.trim()) {
        return;
    }
    try {
        await invoke('updateModelStyling', 6, {
            model: {name: model.name, css: model.css}
        });
    } catch (e) {
        // Styling remains unchanged when Anki-connect cannot update it.
    }
    // Leave the existing CSS in place if Anki-connect cannot update it. The
    // fields and templates—and, crucially, the user's notes—remain intact.
}

/**
 * Creates the given note model ("card type"): a cloze model whose example
 * phrase is the cloze field.
 * @param {Object} model Model descriptor to create.
 * @return {Object} Promise resolving once the model has been created.
 */
function createModel(model) {
    return invoke('createModel', 6, {
        modelName: model.name,
        inOrderFields: model.fields,
        css: model.css,
        isCloze: model.isCloze,
        cardTemplates: [model.template]
    });
}

/**
 * @param {Object} model Model descriptor to compare against.
 * @param {Array} fields Ordered field names of an existing model.
 * @param {Object} templates Mapping returned by getModelTemplates.
 * @return {boolean} True iff the existing model matches the descriptor's
 * configuration (fields and card template).
 */
function isDesiredModel(model, fields, templates) {
    if (JSON.stringify(fields) !== JSON.stringify(model.fields)) {
        return false;
    }
    const card = templates[model.template.Name];
    if (!card) {
        return false;
    }
    return card.Front === model.template.Front &&
           card.Back === model.template.Back;
}

/**
 * Appends newly introduced model fields and updates the card template in
 * place. This preserves existing cards, whose new fields remain blank.
 * @param {Object} model Model descriptor to migrate.
 * @param {Array<string>} fields Existing ordered model fields.
 * @return {Promise<boolean>} Whether the model was migrated successfully.
 */
async function migrateModel(model, fields) {
    const isKnownPrefix = fields.every((field, index) =>
        model.fields[index] === field
    );
    if (!isKnownPrefix || fields.length > model.fields.length) {
        return false;
    }
    try {
        for (let index = fields.length; index < model.fields.length; index++) {
            await invoke('modelFieldAdd', 6, {
                modelName: model.name,
                fieldName: model.fields[index]
            });
        }
        await invoke('updateModelTemplates', 6, {
            model: {
                name: model.name,
                templates: {[model.template.Name]: model.template}
            }
        });
        const updatedFields = await getModelFieldNames(model.name);
        const updatedTemplates = await getModelTemplates(model.name);
        return isDesiredModel(model, updatedFields, updatedTemplates);
    } catch (e) {
        return false;
    }
}

/**
 * Removes any notes using the given model and then the (now empty) model
 * itself, so it can be recreated. Anki-connect offers no direct way to delete
 * or convert a model, so removeEmptyNotes is used to drop it once its notes
 * are gone (this also prunes any other unused models).
 * @param {Object} model Model descriptor to remove.
 * @return {Object} Promise resolving once the model has been removed.
 */
async function removeModel(model) {
    const noteIds = await invoke('findNotes', 6, {query: 'note:"' + model.name + '"'});
    if (noteIds.length > 0) {
        await invoke('deleteNotes', 6, {notes: noteIds});
    }
    await invoke('removeEmptyNotes', 6);
}

/**
 * Ensures the given note model exists with exactly the desired
 * configuration, creating it if missing and migrating known older versions
 * in place. A model with an unknown schema is left untouched to avoid
 * deleting user cards.
 * @param {Object} model Model descriptor to ensure exists.
 * @return {Object} Promise resolving once the model is guaranteed correct.
 */
async function ensureModel(model) {
    const models = await getModelNames();
    if (!models.includes(model.name)) {
        await createModel(model);
        return;
    }
    const fields = await getModelFieldNames(model.name);
    const templates = await getModelTemplates(model.name);
    if (!isDesiredModel(model, fields, templates)) {
        const migrated = await migrateModel(model, fields);
        if (!migrated) {
            throw new Error('Existing Minerva model could not be migrated safely.');
        }
    }
    await updateModelStyling(model);
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
 * @param {Object} model Model descriptor to check against.
 * @return {Promise<boolean>} True iff a card for the word already exists.
 */
async function wordExistsInDeck(word, model = MINERVA_MODEL) {
    await ensureModel(model);
    const deckName = await getDeckName();
    await ensureDeck(deckName);
    const fields = {};
    for (const field of model.fields) {
        fields[field] = field === "id" || field === "word" ? word : "";
    }
    const canAdd = await invoke('canAddNote', 6, {
        note: {
            deckName: deckName,
            modelName: model.name,
            fields: fields,
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
 * Adds a note built from the given fields to the given model, ensuring both
 * the model and the deck exist first.
 * @param {Object} model Model descriptor to add the note to.
 * @param {Object} fields Field values keyed by model field name.
 * @return {Object} Promise containing status of request to add card.
 */
async function addNoteToModel(model, fields) {
    await ensureModel(model);
    const deckName = await getDeckName();
    await ensureDeck(deckName);
    const params = {
        "note": {
            "deckName": deckName,
            "modelName": model.name,
            "fields": fields,
            "options": {
                "allowDuplicate": false,
                "duplicateScope": "deck",
                "duplicateScopeOptions": {
                    "deckName": deckName,
                    "checkChildren": false
                }
            }
        }
    };
    return invoke('addNote', 6, params);
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
    return addNoteToModel(MINERVA_MODEL, {
        "id": id,
        "word": word,
        "example-phrase": phrase,
        "definition": dfn,
        "page-title": pageTitle,
        "date-created": dateCreated,
        "frequency": frequency,
        "ipa": ipa
    });
}

/**
 * Adds an AI-phrase card to Anki through anki-connect. The generated phrase
 * is stored as the cloze field and the original page context is kept in the
 * answer-side "original-phrase" field.
 * @param {string} ID of the word dfn to be added (which uniquely identifies it).
 * @param {string} Word to be added.
 * @param {string} Example phrase generated by DeepSeek (cloze markup included).
 * @param {string} originalPhrase Page context shown at the bottom of the answer.
 * @param {string} Definition relative to ID to be added.
 * @param {string} pageTitle Title of the source page.
 * @param {string} dateCreated Date on which the card was created.
 * @param {string} frequency Word frequency rank.
 * @param {string} ipa Word IPA transcription.
 * @param {string} japaneseDefinition Simple Japanese definition of the word.
 * @return {Object} Promise containing status of request to add card.
 */
async function addAiCard(id, word, phrase, originalPhrase, dfn, pageTitle, dateCreated, frequency, ipa, japaneseDefinition = "") {
    return addNoteToModel(AI_MODEL, {
        "id": id,
        "word": word,
        "example-phrase": phrase,
        "original-phrase": originalPhrase,
        "definition": dfn,
        "page-title": pageTitle,
        "date-created": dateCreated,
        "frequency": frequency,
        "ipa": ipa,
        "japanese-definition": japaneseDefinition
    });
}
