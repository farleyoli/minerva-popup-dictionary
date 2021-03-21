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
 * This function gets the position of selected word inside inner text of body.
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

/**
 * This function gets the position of selected phrase inside inner text of body.
 * It can optionally include phrases that come before or after the phrase in which
 * the original word is found.
 * @param {Number} Number of phrases before the original phrase to include.
 * @param {Number} Number of phrases after the original phrase to include.
 * @return {Array<number>} Beginning and ending position of selection.
 */
function getExamplePhrase(word = "", noPhrasesBefore = 1, noPhrasesAfter = 1) {
    const allText = document.body.textContent || document.body.innerText;
    const [wordStartPos, wordEndPos] = getSelectedPosition();

    let beg = wordStartPos;
    for (; beg > 0 && noPhrasesBefore >= 0; beg--) {
        if (allText[beg] == ".") {
            noPhrasesBefore--;
        }
    }
    beg += 2
    while (allText[beg] == " ") {
        beg++;
    }

    let end = wordEndPos;
    for (; end < allText.length && noPhrasesAfter >= 0; end++) {
        if (allText[end] == ".") {
            noPhrasesAfter--;
        }
    }

    //console.log(allText.slice(beg, end));
    let ret = allText.slice(beg,end);
    if (word.length > 0) {
        ret = ret.replaceAll(word, "<u>" + word + "</u>");
    }
    return ret;
}
