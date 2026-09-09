// TODO: Leave header always shown (when user scrolls) in popup.
// TODO: Fix /undefined/
// TODO: Add math rendering to definitions (require option from user).


/**
 * This function receives the popup div (with content already inside), 
 * adds CSS properties to it and embeds it in the document.
 * @param {number} Horizontal position of upper-left corner of popup.
 * @param {number} Vertical position of upper-left corner of popup.
 * @param {number} Width of popup.
 * @param {number} Height of popup.
 * @param {Object} Div HTML object which is to be added to the document's
 * body.
 */
function constructPopup(x, y, width, height, dfnDiv) {
    dfnDiv.style.left = x.toString() + 'px';
    dfnDiv.style.top = y.toString() + 'px';
    dfnDiv.style.width = width.toString() + 'px';
    dfnDiv.style.height = height.toString() + 'px';
    dfnDiv.style.zIndex = getMaxZIndex() + 3;
    document.body.appendChild(dfnDiv);
}

/**
 * This function "cleans" some aspects of the definitions taken from
 * Wiktionary where the parsing may not have gone so well. This function
 * should be deleted when the JSON files from Wiktionary are of better
 * quality.
 * @param {string} Content (usually definition) which is to be cleaned.
 * @return {string} Cleaned content.
 */
function processContent(content) {
    ret = "";
    const regex = /\s[^\s]+\|/gi;
    const regex2 = /^.*\|/gi;
    const regex3 = /singular(?=[a-z])/gi;
    ret = content.replace(regex, " ");
    ret = ret.replace(regex2, "");
    ret = ret.replace(regex3, "singular ");
    ret = ret.replace("{{", "");
    return ret;
}

/**
 * This method gets the dictionary, recursively (see structure in
 * comments inside) parses it and constructs a div element
 * containing the meaning of the word. CSS is added by a different method.
 * @param {Object} Dictionary JSON file containing word.
 * @param {string} Word whose meaning is to be written.
 * @return {Object} Div HTML object with definition to be embedded in popup.
 */
function constructDfn(dict, word) {
    // Use the words "draw", "acid", "head" and "hand" (triple indentation) to test stuff.
    const retDiv = document.createElement("div");
    const header = document.createElement("div");
    header.id = "minerva-header";
    retDiv.appendChild(header);
    function constructDfnAux(dfn) {
        const ret = document.createElement("div");
        if (dfn.length <= 0) {
            return null;
        }
        for (let i = 0; i < dfn.length; i++) {
            const dfnNode = document.createElement("div");
            const dfnNoNode = document.createElement("span");
            dfnNoNode.id = "minerva-definition-number";
            dfnNoNode.innerText = (i+1).toString();
            dfnNode.appendChild(dfnNoNode);
            const textNode = document.createElement("span");
            textNode.innerText = processContent(dfn[i]['ctnt']);
            dfnNode.style.marginTop = "2.5%";
            dfnNode.style.marginBottom = "2.5%";
            dfnNode.appendChild(textNode);
            ret.appendChild(dfnNode);
            dfnNode.id = "minerva-dfn-node";
            let child = constructDfnAux(dfn[i]['dfn']);
            if (child) {
                dfnNode.appendChild(child);
            }
        }
        ret.style.marginLeft = "5%";
        return ret;
    }
    /*
    dict[word] is an array.
    Structure of dict[word][i]:
        Returns {head, dfn}, where
                   dfn = (list of {ctnt, dfn, exs, qts}) or []
                  ctnt = contents (str)
                   exs = list of examples (str)
        and        qts = list of quotes (str)
        see definition of head. (ex: head(tested) = test)
    */
    if (!(word in dict)) {
        retDiv.innerText = "Word not found in dictionary.";
        return retDiv;
    }

    for (let i = 0; i < dict[word].length; i++) {
        if (i > 0) {
            let hrElement = document.createElement("hr");
            hrElement.className = "horizontalLine";
            retDiv.appendChild(hrElement);
        }
        retDiv.appendChild(constructDfnAux(dict[word][i]['dfn']));
    }

    return retDiv;
}

/**
 * This function takes a word and adds the word and its IPA transcription
 * to the header of the definition popup, if it exists.
 * @param {string} Word whose frequency is to be added.
 */
function addPronunciation(word) {
    pronAddress = './dictionary/ipa.json';
    const url = chrome.runtime.getURL(pronAddress);
    fetch(url)
        .then((response) => response.json())
        .then((pronMap) => { 
            if(!(word in pronMap))
                word = word.trim();
            let pron = '';
            if(!(word in pronMap))
                pron = pronMap[word.toLowerCase()];
            else
                pron = pronMap[word];
            let openPopup = document.getElementById("minerva-popup");
            let header = document.getElementById("minerva-header");
            if (openPopup != null && header != null) {
                let pronSpan = document.createElement("div");
                pronSpan.id = "minerva-pronunciation";
                pronSpan.innerText = word + " (/" + pron + "/)" ;
                if (header.childNodes.length > 0) {
                    header.insertBefore(pronSpan, header.childNodes[0]);
                } else {
                    header.appendChild(pronSpan)
                }
            }
        });
}

const addSuggestions = (word, allowedDiff, popup) => {
    trieAddress = './dictionary/trie.json';
    const url = chrome.runtime.getURL(trieAddress);
    fetch(url)
        .then((response) => response.json())
        .then((trie) => { 
            if (!popup.isConnected || popup.dataset.minervaLookup !== word) {
                return;
            }
            const stack   = [];
            const matches = [];
            const suggestionDiv = document.createElement('div');
            const search = (trie, remainingHealth, depth = 1) => {
                if (trie == '_end_' ) {
                    stackWord = stack.slice(0,-1).join('');
                    if (Math.abs(stackWord.length - word.length) < allowedDiff) {
                        matches.push(stackWord);
                    }
                    return;
                }
                if (depth > word.length || remainingHealth <= 0)
                    return;
                nextWordLetter = depth < word.length ? word[depth] : '';
                for (letter in trie) {
                    healthDelta = letter != nextWordLetter ? -1 : 0;
                    stack.push(letter);
                    search(trie[letter], remainingHealth + healthDelta, depth + 1);
                    stack.pop();
                }
            }
            for (key in trie) {
                stack.push(key);
                search(trie[key], allowedDiff);
                stack.pop();
            }
            const suggestions = matches.filter(w => w != word);
            suggestions.forEach((suggestion, index) => {
                if (index > 0) {
                    suggestionDiv.append(' ');
                }
                suggestionDiv.append(createLookupSuggestion(suggestion));
            });
            suggestionDiv.classList.add("minerva-suggestions");
            popup.append(suggestionDiv);
        });
}

/**
 * Creates a compact button which replaces the current popup with a lookup for
 * the suggested word or phrase.
 * @param {string} suggestion Dictionary headword to look up.
 * @return {Object} Clickable suggestion element.
 */
function createLookupSuggestion(suggestion) {
    const suggestionLink = document.createElement('button');
    suggestionLink.classList.add('minerva-lookup-suggestion');
    suggestionLink.innerText = suggestion;
    suggestionLink.addEventListener('click', function(event) {
        event.stopPropagation();
        processDefinition(suggestion, 0, 0, true);
    });
    return suggestionLink;
}

/**
 * Finds a candidate's spelling as it appears in the dictionary. This matters
 * for proper nouns, whose only headword may be capitalized (Houthi), while
 * the deconjugator works with lowercase text (houthi).
 * @param {Object} dictionary Dictionary entries keyed by headword.
 * @param {string} candidate Generated lowercase candidate.
 * @return {string|null} Dictionary headword, or null when absent.
 */
function getDictionaryHeadword(dictionary, candidate) {
    if (candidate in dictionary) {
        return candidate;
    }
    const titleCaseCandidate = candidate.charAt(0).toUpperCase() + candidate.slice(1);
    if (titleCaseCandidate in dictionary) {
        return titleCaseCandidate;
    }
    const normalizedCandidate = candidate.toLowerCase();
    return Object.keys(dictionary).find(headword =>
        headword.toLowerCase() === normalizedCandidate
    ) || null;
}

/**
 * Adds verified possible verb base forms below the definition. Candidate
 * generation lives in utils.js; this function checks the candidates against
 * the bundled dictionary so heuristic guesses are never shown as facts.
 * @param {string} word Word being looked up.
 * @param {Object} popup Popup to append the hint to.
 * @param {string} followingText Text immediately after the selected word.
 */
function addBaseFormSuggestions(word, popup, followingText = '') {
    const candidates = getEnglishBaseFormCandidates(word);
    const phrasalVerbCandidates = getEnglishPhrasalVerbCandidates(word, followingText);
    const allCandidates = [...new Set([...candidates, ...phrasalVerbCandidates])];
    const letters = [...new Set(allCandidates.map(getFirstLetter))]
        .filter(letter => letter !== 'other');

    if (letters.length === 0) {
        return;
    }

    const dictionaryRequests = letters.map(letter => {
        const url = chrome.runtime.getURL('./dictionary/' + letter + '.json');
        return fetch(url).then(response => response.json());
    });
    const frequencyUrl = chrome.runtime.getURL('./dictionary/freq.json');

    Promise.all([...dictionaryRequests, fetch(frequencyUrl).then(response => response.json())]).then(results => {
        if (!popup.isConnected || popup.dataset.minervaLookup !== word) {
            return;
        }
        const frequencyMap = results.pop();
        const dicts = results;
        const dictionaries = Object.assign({}, ...dicts);
        // Wiktionary includes historical and regional spellings (for example,
        // "mak"), which can be mechanically derived but are poor hints for a
        // reader. freq.json contains the extension's common-word list, so it
        // filters those false positives after the dictionary check.
        const verified = candidates.map(candidate => {
            const headword = getDictionaryHeadword(dictionaries, candidate);
            if (!headword) return null;
            // Proper nouns are often absent from the common-word frequency
            // list, but a capitalized dictionary headword is still useful.
            return headword in frequencyMap || headword !== headword.toLowerCase()
                ? headword
                : null;
        }).filter(headword => headword !== null);
        const verifiedPhrasalVerbs = phrasalVerbCandidates.map(candidate => {
            const headword = getDictionaryHeadword(dictionaries, candidate);
            if (!headword) return null;
            const base = candidate.split(' ')[0];
            return base in frequencyMap || headword !== headword.toLowerCase()
                ? headword
                : null;
        }).filter(headword => headword !== null);
        if (verified.length > 0) {
            const baseFormDiv = document.createElement('div');
            baseFormDiv.classList.add('minerva-base-forms');
            baseFormDiv.append('Possible base form' +
                (verified.length === 1 ? ': ' : 's: '));
            verified.forEach((baseForm, index) => {
                if (index > 0) {
                    baseFormDiv.append(' ');
                }
                baseFormDiv.append(createLookupSuggestion(baseForm));
            });
            popup.append(baseFormDiv);
        }
        for (const phrase of verifiedPhrasalVerbs) {
            const phraseDiv = document.createElement('div');
            phraseDiv.classList.add('minerva-base-forms');
            phraseDiv.append('Possible phrasal verb: ');
            phraseDiv.append(createLookupSuggestion(phrase));
            popup.append(phraseDiv);
        }
    });
}

/**
 * This function takes a word and adds its Frequency to the header of
 * the definition popup, if it exists.
 * @param {string} Word whose frequency is to be added.
 */
function addFrequency(word) {
    freqAdress = './dictionary/freq.json';
    const url = chrome.runtime.getURL(freqAdress);
    fetch(url)
        .then((response) => response.json())
        .then((freqMap) => { 
            let freq = freqMap[word];
            let openPopup = document.getElementById("minerva-popup");
            let header = document.getElementById("minerva-header");
            if (openPopup != null && header != null && freq !== undefined) {
                let freqSpan = document.createElement("div");
                freqSpan.id = "minerva-frequency";
                freqSpan.innerText = "Freq: " + freq.replace("\n", "");
                header.appendChild(freqSpan)
            }
        });
}

/**
 * Gets the displayed frequency rank for storing on an Anki card.
 * @param {string} word Word whose frequency is requested.
 * @return {Promise<string>} Frequency rank, or an empty string when absent.
 */
function getFrequencyForCard(word) {
    const url = chrome.runtime.getURL('./dictionary/freq.json');
    return fetch(url)
        .then(response => response.json())
        .then(freqMap => {
            const normalized = word.trim().toLowerCase();
            return (freqMap[word] || freqMap[normalized] || '').replace(/\n/g, '');
        })
        .catch(() => '');
}

/**
 * @return {string} Today's local date in ISO-8601 calendar-date form.
 */
function getCardCreationDate() {
    const date = new Date();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return date.getFullYear() + '-' + month + '-' + day;
}

/** 
 * In this function, we have to consider the case where the cursor is in the
 * right-lower corner of the screen and the case where it is elsewhere.
 * @param {number} Width of the popup.
 * @param {number} Height of the popup.
 * @param {number} Horizontal position of mouse when double click happened.
 * @param {number} Vertical position of mouse when double click happened.
 * @return {Array[number]} Position (x0,y0,x1,y1) of upperleft corner and bottomright corner of the popup.
 */
function getPopupPosition(popupW, popupH, mouseX, mouseY) {
    //screenW = window.screen.availWidth;
    //screenH = window.screen.availHeight;
    const screenW = window.innerWidth;
    const screenH = window.innerHeight;
    const offset = 15;
    let retX0 = mouseX + offset;
    let retY0 = mouseY + offset;

    let retX1 = retX0 + popupW;
    let retY1 = retY0 + popupH;

    if (retX1 > screenW) {
        retX0 = Math.max(mouseX - popupW - 2*offset); // offset goes in opposite direction
    }
    if (retY1 > screenH) {
        retY0 = Math.max(mouseY - popupH - 2*offset, 0);
    }

    retX1 = retX0 + popupW;
    retY1 = retY0 + popupH;

    return [retX0, retY0, retX1, retY1];
}


/**
 * This function takes a word and shows its definition popup. If `replace` is
 * true and a popup is already open, its contents are swapped in place instead
 * of creating a new popup.
 * @param {string} Word to be searched in dictionary.
 * @param {number} Horizontal position of mouse when double click happened.
 * @param {number} Vertical position of mouse when double click happened.
 * @param {boolean} Whether to reuse the currently open popup.
 */
function processDefinition(word, mouseX, mouseY, replace = false, followingText = '') {
    //let phrase = getExamplePhrase();
    //addCard(word, word, phrase);
    let firstLetter = getFirstLetter(word);
    let dictAdress = './dictionary/' + firstLetter + '.json';
    const url = chrome.runtime.getURL(dictAdress);
    fetch(url)
        .then((response) => response.json())
        .then((dict) => { 
            if(!(word in dict))
                word = word.trim();
            if(!(word in dict))
                word = word.toLowerCase();
            let dfnDiv = constructDfn(dict, word);
            const openPopup = document.getElementById("minerva-popup");
            if (replace && openPopup != null) {
                openPopup.textContent = "";
                while (dfnDiv.firstChild) {
                    openPopup.appendChild(dfnDiv.firstChild);
                }
                openPopup.scrollTop = 0;
            } else {
                dfnDiv.id = "minerva-popup";
                const [popUpWidth, popUpHeight] = getPopupDimensions();
                pos = getPopupPosition(popUpWidth, popUpHeight, mouseX, mouseY);
                constructPopup(pos[0], pos[1], pos[2]-pos[0], pos[3]-pos[1], dfnDiv);
            }
            const popup = document.getElementById('minerva-popup');
            popup.dataset.minervaLookup = word;
            addPronunciation(word);
            addFrequency(word);
            addBaseFormSuggestions(word, popup, followingText);
            addSuggestions(word, 1, popup);
            addAnkiButton(dict, word);
        });
}

/**
 * Flattens the recursive definition structure of a word into a single string
 * (using the same cleaning as the popup rendering).
 * @param {Object} dict Dictionary JSON file containing the word.
 * @param {string} word Word whose full definition text is to be extracted.
 * @return {string} Concatenated definition contents.
 */
function getFullDefinitionText(dict, word) {
    const parts = [];
    const collect = (dfn) => {
        if (!dfn) return;
        for (const node of dfn) {
            if (node['ctnt']) {
                parts.push(processContent(node['ctnt']));
            }
            if (node['dfn'] && node['dfn'].length > 0) {
                collect(node['dfn']);
            }
        }
    };
    for (const entry of dict[word]) {
        collect(entry['dfn']);
    }
    return parts.join(" ");
}

/**
 * Adds an "Add to Anki" button to the popup header, but only if Anki is
 * reachable through Anki-connect.
 * @param {Object} dict Dictionary JSON file containing the word.
 * @param {string} word Word whose definition is to be exported.
 */
function addAnkiButton(dict, word) {
    if (!(word in dict)) return;
    const phrase = getExamplePhrase(word);
    checkAnkiAvailability(function(available) {
        if (!available) return;
        checkWordExists(word, function(exists) {
            if (exists) return;
            const header = document.getElementById("minerva-header");
            if (!header) return;
            const btn = document.createElement("button");
            btn.id = "minerva-anki-button";
            btn.innerText = "Add to Anki";
            btn.addEventListener("click", function() {
                const dfn = getFullDefinitionText(dict, word);
                const pageTitle = document.title.trim();
                const dateCreated = getCardCreationDate();
                getFrequencyForCard(word).then(frequency => {
                    addCard(word, word, phrase, dfn, pageTitle, dateCreated, frequency, function(success) {
                        if (success) btn.remove();
                    });
                });
            });
            header.appendChild(btn);
        });
    });
}

function getPopupDimensions() {
    const fixedRatio                = false;
    const initialWidth              = 350;
    const initialHeight             = 300;
    const assumedWidthAvailable     = 1366;
    const assumedHeightAvailable    = 768;
    const widthAvailable            = window.visualViewport.width;
    const heightAvailable           = window.visualViewport.height;
    const widthZoomRate             = assumedWidthAvailable / widthAvailable;
    const heightZoomRate            = assumedHeightAvailable / heightAvailable;
    const zoomRate                  = Math.max(widthZoomRate, heightZoomRate);
    if (fixedRatio) {
        widthZoomRate   = zoomRate;
        heightZoomRate  = zoomRate;
    }
    return [Math.floor(initialWidth/widthZoomRate), Math.floor(initialHeight/heightZoomRate)];
}

/**
 * This functions returns true if (x,y) is inside the definition popup,
 * and false otherwise.
 * @param {number} x-position of mouse.
 * @param {number} y-position of mouse.
 * @param {Object} HTML object of the popup.
 */
function isInsidePopup(x, y, popup) {
    //dfnDiv.style.left = x.toString() + 'px';
    //dfnDiv.style.top = y.toString() + 'px';
    //dfnDiv.style.width = width.toString() + 'px';
    //dfnDiv.style.height = height.toString() + 'px';
    let popupX = parseInt(popup.style.left.substring(0, popup.style.left.length-2));
    let popupY = parseInt(popup.style.top.substring(0, popup.style.top.length-2));
    let width = parseInt(popup.style.width.substring(0, popup.style.width.length-2));
    let height = parseInt(popup.style.height.substring(0, popup.style.height.length-2));

    //alert([x, y, popupX, popupY, width, height]); 
    if (x >= popupX && x <= popupX + width) {
        if(y >= popupY && y <= popupY+height) {
            return true;
        }
    }
    return false;
}
