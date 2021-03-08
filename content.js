//TODO: Create connection to anki-connect; get phrase, set parameters and construct
// TODO: Leave header always shown (when user scrolls) in popup.
// TODO: Fix /undefined/
// TODO: Add math rendering to definitions (require option).


/**
 * @param {string} A word.
 * @return {boolean} True iff first letter of word is Capital.
 */
function isFirstLetterCapital(word) {
    const letters = "abcdefghijklmnopqrstuvwxyz";
    if (word.length == 0) {
        return false;
    }
    if (letters.indexOf(word[0]) >= 0) {
        return true;
    }
    return false;
}

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
    //TODO: use CSS file to set this properties through a class
    dfnDiv.style.left = x.toString() + 'px';
    dfnDiv.style.top = y.toString() + 'px';
    dfnDiv.style.width = width.toString() + 'px';
    dfnDiv.style.height = height.toString() + 'px';
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
            return ret;
        }
        for (let i = 0; i < dfn.length; i++) {
            const dfnNode = document.createElement("div");
            const dfnNoNode = document.createElement("span");
            dfnNoNode.id = "minerva-definition-number";
            dfnNoNode.innerText = (i+1).toString();
            dfnNode.appendChild(dfnNoNode);
            const textNode = document.createElement("span");
            //textNode.innerText = (i+1).toString() + " " + processContent(dfn[i]['ctnt']);
            textNode.innerText = processContent(dfn[i]['ctnt']);
            dfnNode.style.marginTop = "2.5%";
            dfnNode.style.marginBottom = "2.5%";
            dfnNode.appendChild(textNode);
            ret.appendChild(dfnNode);
            ret.appendChild(constructDfnAux(dfn[i]['dfn']));
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
        retDiv.appendChild(constructDfnAux(dict[word][i]['dfn']));
    }

    return retDiv;
}

/**
 * @param {string} A string.
 * @return {string} First letter of word.
 */
function getFirstLetter(word) {
    const letters = "abcdefghijklmnopqrstuvwxyz";
    if (word.length == 0) {
        return "other"
    }
    if (letters.indexOf(word[0].toLowerCase()) >= 0) {
        return word[0].toLowerCase();
    }

    return "other";
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
            let pron = pronMap[word];
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
    let screenW = window.innerWidth-20;
    let screenH = window.innerHeight-50;
    let offset = 0;
    let offset_y = 10;
    let retX0 = mouseX + offset;
    let retY0 = mouseY + offset_y;

    let retX1 = retX0 + popupW;
    let retY1 = retY0 + popupH;

    if (retX1 > screenW) {
        retX0 = mouseX - popupW + offset;
    }
    if (retY1 > screenH) {
        retY0 = mouseY - popupH + offset_y;
    }

    /*
    if (retX1 > screenW) {
        if (retY1 > screenH) {
            retX0 = mouseX - popupW + offset;
            retY0 = mouseY - popupH + offset;
        } else {
            retX0 = mouseX - popupW + offset;
        }
    } else if (retY1 > screenW) {
        retY0 = mouseY - popupH + offset;
    }
    */

    retX1 = retX0 + popupW;
    retY1 = retY0 + popupH;

    return [retX0, retY0, retX1, retY1];
}


/**
 * This function takes a word and adds its popup to the DOM.
 * @param {string} Word to be searched in dictionary.
 * @param {number} Horizontal position of mouse when double click happened.
 * @param {number} Vertical position of mouse when double click happened.
 */
function processDefinition(word, mouseX, mouseY) {
    let firstLetter = getFirstLetter(word);
    let dictAdress = './dictionary/' + firstLetter + '.json';
    const url = chrome.runtime.getURL(dictAdress);
    fetch(url)
        .then((response) => response.json())
        .then((dict) => { 
            let dfnDiv = constructDfn(dict, word);
            dfnDiv.id = "minerva-popup";
            pos = getPopupPosition(350, 250, mouseX, mouseY);
            constructPopup(pos[0], pos[1], pos[2]-pos[0], pos[3]-pos[1], dfnDiv);
            addFrequency(word);
            addPronunciation(word);
        });
}

/**
 * @return {Array[number]} (width, height) of definition popup if it exists; [0,0] otherwise.
 */
function getPopupDimensions() {
    let popup = document.getElementById("minerva-popup");
    if (popup === null) {
        return [0,0];
    }
    let popupDimensions = popup.getBoundingClientRect();
    return [popupDimensions['width'], popupDimensions['height']];
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

/**
 * This function handles single-clicks from the user. It removes the popup
 * from the DOM if the user clicked outside it.
 */
function clickEventHandler() {
    let e = window.event;
    let mouseX = e.clientX;
    let mouseY = e.clientY;
    let openPopup = document.getElementById("minerva-popup");
    if (openPopup != null) {
        let isInside = isInsidePopup(mouseX, mouseY, openPopup);
        if (isInside) {
            return;
        }
        openPopup.remove();
    }
}

/**
 * This function handles double-clicks from the user. It adds the definition
 * of the selected word by the user to a popup and adds the popup to the
 * DOM.
 */
function doubleClickEventHandler() {
    let e = window.event;
    let mouseX = e.clientX;
    let mouseY = e.clientY;

    let pos = getSelectedPosition();
    let body = document.body;
    let allText = body.textContent || body.innerText;
    let word = allText.slice(pos[0], pos[1]); 
    let openPopup = document.getElementById("minerva-popup");
    if (openPopup != null) {
        openPopup.remove();
    }
    let dfnDiv = processDefinition(word.toLowerCase(), mouseX, mouseY);

    chrome.runtime.sendMessage({word: word});
}


/**
 * This function gets the position of selected text inside inner text of body.
 * @return {Array<number>} Beginning and ending position of selection.
 */
function getSelectedPosition() {
    let selection = "";
    if (window.getSelection) {
        selection = window.getSelection();
    } else if (document.getSelection) {
        selection = document.getSelection();
    } else if (document.selection) {
        selection = document.selection.createRange();
    } else {
        return [];
    }

    let range = selection.getRangeAt(0);
    let startOffset = range.startOffset;
    let endOffset = startOffset + range.toString().length;

    let node = selection.anchorNode;

    let body = document.body;
    let allText = body.textContent || body.innerText;

    startOffset += allText.indexOf(node.textContent);
    endOffset += allText.indexOf(node.textContent);

    return [startOffset, endOffset];
}

document.body.addEventListener("dblclick", doubleClickEventHandler);
document.body.addEventListener("click", clickEventHandler);
