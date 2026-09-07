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
const MINERVA_MODEL_FIELDS = ["id", "word", "example-phrase", "definition"];
const MINERVA_CARD_TEMPLATE = {
    Name: "Minerva Card",
    Front: "{{cloze:example-phrase}}",
    Back: "{{cloze:example-phrase}}<hr id=\"answer\"><div class=\"definition\">{{definition}}</div>"
};
const MINERVA_MODEL_CSS = `
.card {
    font-family: "Georgia", "Times New Roman", serif;
    font-size: 24px;
    text-align: center;
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
    margin: 36px auto;
    width: 70%;
}

.definition {
    font-size: 19px;
    text-align: left;
    color: #55524c;
    line-height: 1.65;
    padding-left: 12px;
    border-left: 3px solid #d8b49a;
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
 * configuration, creating or recreating it if it is missing or different.
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
    if (isDesiredModel(fields, templates)) {
        return;
    }
    await removeMinervaModel();
    await createMinervaModel();
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
                "definition": ""
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
 * @return {Object} Promise containing status of request to add card.
 */
async function addCard(id, word, phrase, dfn) {
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
                "definition": dfn
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
