// Example phrase captured from the page when the popup is first opened. It is
// reused for any subword looked up inside the popup, so the phrase always
// comes from the original page rather than the popup's own text.
var currentExamplePhrase = null;

/**
 * @param {string} A word.
 * @return {boolean} True iff first letter of word is Capital.
 */
function isFirstLetterCapital(word) {    const letters = "abcdefghijklmnopqrstuvwxyz";
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
 * Returns plausible dictionary headwords for an English inflected verb.
 * This is deliberately heuristic: callers should verify each result against
 * the dictionary before presenting it to the user.
 * @param {string} word A selected word.
 * @return {Array<string>} Candidate base forms, in preference order.
 */
function getEnglishBaseFormCandidates(word) {
    const normalized = word.trim().toLowerCase();
    if (!/^[a-z]+$/.test(normalized)) {
        return [];
    }

    // These are common irregular verb forms which cannot be recovered from a
    // suffix rule. Multiple base forms are retained where English is genuinely
    // ambiguous (for example, "saw" can be a form of see or saw).
    const irregular = {
        'am': ['be'], 'are': ['be'], 'is': ['be'], 'was': ['be'],
        'were': ['be'], 'been': ['be'], 'being': ['be'],
        'has': ['have'], 'had': ['have'], 'having': ['have'],
        'does': ['do'], 'did': ['do'], 'doing': ['do'],
        'goes': ['go'], 'went': ['go'], 'gone': ['go'],
        'says': ['say'], 'said': ['say'], 'made': ['make'],
        'ate': ['eat'], 'eaten': ['eat'], 'became': ['become'],
        'bent': ['bend'], 'bound': ['bind'], 'bit': ['bite'],
        'bitten': ['bite'], 'bled': ['bleed'], 'blew': ['blow'],
        'blown': ['blow'], 'broke': ['break'], 'broken': ['break'],
        'brought': ['bring'], 'built': ['build'], 'bought': ['buy'],
        'caught': ['catch'], 'chose': ['choose'], 'chosen': ['choose'],
        'came': ['come'], 'cost': ['cost'], 'crept': ['creep'],
        'cut': ['cut'], 'dealt': ['deal'], 'dug': ['dig'],
        'dove': ['dive'], 'drew': ['draw'], 'drawn': ['draw'],
        'drank': ['drink'], 'drunk': ['drink'], 'drove': ['drive'],
        'driven': ['drive'], 'fed': ['feed'], 'fell': ['fall'],
        'fallen': ['fall'], 'felt': ['feel'], 'fought': ['fight'],
        'flew': ['fly'], 'flown': ['fly'], 'found': ['find'],
        'forgot': ['forget'], 'forgotten': ['forget'],
        'forgave': ['forgive'], 'forgiven': ['forgive'],
        'froze': ['freeze'], 'frozen': ['freeze'], 'gave': ['give'],
        'given': ['give'], 'got': ['get'], 'gotten': ['get'],
        'grew': ['grow'], 'grown': ['grow'], 'hung': ['hang'],
        'heard': ['hear'], 'held': ['hold'], 'hid': ['hide'],
        'hidden': ['hide'], 'hit': ['hit'], 'kept': ['keep'],
        'knew': ['know'], 'known': ['know'], 'laid': ['lay'],
        'lay': ['lie'], 'lain': ['lie'], 'led': ['lead'],
        'left': ['leave'], 'lent': ['lend'], 'lost': ['lose'],
        'meant': ['mean'], 'met': ['meet'], 'paid': ['pay'],
        'ran': ['run'], 'rode': ['ride'], 'ridden': ['ride'],
        'rang': ['ring'], 'rung': ['ring'], 'rose': ['rise'],
        'risen': ['rise'], 'sang': ['sing'], 'sung': ['sing'],
        'sat': ['sit'], 'saw': ['see'], 'seen': ['see'],
        'sold': ['sell'], 'sent': ['send'], 'shook': ['shake'],
        'shaken': ['shake'], 'shot': ['shoot'], 'shut': ['shut'],
        'slept': ['sleep'], 'spoke': ['speak'], 'spoken': ['speak'],
        'spent': ['spend'], 'split': ['split'], 'spread': ['spread'],
        'sprang': ['spring'], 'sprung': ['spring'], 'stood': ['stand'],
        'stole': ['steal'], 'stolen': ['steal'], 'stuck': ['stick'],
        'struck': ['strike'], 'swam': ['swim'], 'swum': ['swim'],
        'swept': ['sweep'], 'swung': ['swing'], 'taught': ['teach'],
        'took': ['take'], 'taken': ['take'],
        'told': ['tell'], 'thought': ['think'], 'threw': ['throw'],
        'thrown': ['throw'], 'understood': ['understand'],
        'woke': ['wake'], 'woken': ['wake'], 'wore': ['wear'],
        'worn': ['wear'], 'wept': ['weep'], 'went': ['go'],
        'won': ['win'], 'wound': ['wind'], 'wrote': ['write'],
        'written': ['write']
    };
    if (irregular[normalized]) {
        return irregular[normalized];
    }

    const candidates = [];
    const add = (candidate) => {
        if (candidate.length >= 2 && candidate !== normalized && !candidates.includes(candidate)) {
            candidates.push(candidate);
        }
    };

    if (normalized.endsWith('ies') && normalized.length > 3) {
        const stem = normalized.slice(0, -3);
        // ties/dies/lies retain "ie"; longer forms change y to i before -s.
        add(stem.length === 1 ? stem + 'ie' : stem + 'y');
    } else if (normalized.endsWith('ied') && normalized.length > 3) {
        const stem = normalized.slice(0, -3);
        // tied/died/lied retain "ie"; longer forms change y to i before -ed.
        add(stem.length === 1 ? stem + 'ie' : stem + 'y');
    } else if (normalized.endsWith('ying') && normalized.length > 4) {
        add(normalized.slice(0, -4) + 'ie'); // lying -> lie
    } else if (normalized.endsWith('ing') && normalized.length > 4) {
        const stem = normalized.slice(0, -3);
        add(stem);                         // walking -> walk
        add(stem + 'e');                   // making -> make
        if (stem.length >= 2 && stem.at(-1) === stem.at(-2)) {
            add(stem.slice(0, -1));        // running -> run
        }
        if (normalized.endsWith('icking')) {
            add(normalized.slice(0, -4));  // panicking -> panic
        }
    } else if (normalized.endsWith('ed') && normalized.length > 3) {
        const stem = normalized.slice(0, -2);
        add(stem);                         // agreed -> agree
        add(stem + 'e');                   // loved -> love
        if (stem.length >= 2 && stem.at(-1) === stem.at(-2)) {
            add(stem.slice(0, -1));        // stopped -> stop
        }
        if (normalized.endsWith('icked')) {
            add(normalized.slice(0, -3));  // panicked -> panic
        }
    } else if (normalized.endsWith('es') && normalized.length > 3) {
        add(normalized.slice(0, -1));      // loves -> love
        add(normalized.slice(0, -2));      // watches -> watch
    } else if (normalized.endsWith('s') && normalized.length > 2 && !normalized.endsWith('ss')) {
        add(normalized.slice(0, -1));      // walks -> walk
    }

    return candidates;
}

/**
 * Returns possible phrasal-verb lemmas when the text immediately following an
 * inflected verb begins with a common particle. The resulting phrases must
 * still be verified against the dictionary by the caller.
 * @param {string} word Selected word, normally a verb or verb inflection.
 * @param {string} followingText Text immediately after the selection.
 * @return {Array<string>} Candidate phrasal-verb headwords.
 */
function getEnglishPhrasalVerbCandidates(word, followingText) {
    const particles = new Set([
        'about', 'across', 'after', 'ahead', 'along', 'around', 'aside',
        'away', 'back', 'by', 'down', 'for', 'forward', 'in', 'into', 'off',
        'on', 'onto', 'out', 'over', 'round', 'through', 'to', 'together',
        'under', 'up', 'upon', 'with'
    ]);
    const selectedWords = word.trim().toLowerCase().match(/[a-z]+/g);
    if (!selectedWords || selectedWords.length > 3) {
        return [];
    }
    const verb = selectedWords[0];
    let phraseParticles = selectedWords.slice(1);
    if (phraseParticles.length === 0) {
        const particleMatch = followingText.match(/^[\s"'“‘([{]*([a-z]+)/i);
        if (!particleMatch) {
            return [];
        }
        phraseParticles = [particleMatch[1].toLowerCase()];
    }
    if (!phraseParticles.every(particle => particles.has(particle))) {
        return [];
    }

    const deconjugatedBases = getEnglishBaseFormCandidates(verb);
    // Preserve an already-base verb (take -> take up), but do not offer the
    // original inflection as a phrasal-verb lemma (taking -> taking off).
    const bases = deconjugatedBases.length > 0 ? deconjugatedBases : [verb];
    return [...new Set(bases.map(base => base + ' ' + phraseParticles.join(' ')))];
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

    const range = selection.getRangeAt(0);
    const beforeSelection = range.cloneRange();
    beforeSelection.selectNodeContents(document.body);
    beforeSelection.setEnd(range.startContainer, range.startOffset);

    // The previous implementation used indexOf(anchorNode.textContent), which
    // selected the first matching text node in the page. That made the text
    // following a selection unreliable on pages with repeated content, and in
    // turn prevented adjacent-particle phrasal verbs from being recognized.
    const startOffset = beforeSelection.toString().length;
    const endOffset = startOffset + range.toString().length;
    return [startOffset, endOffset];
}

function getMaxZIndex() {
    return Math.max(
      ...Array.from(document.querySelectorAll('body *'), el =>
        parseFloat(window.getComputedStyle(el).zIndex),
      ).filter(zIndex => !Number.isNaN(zIndex)),
      0,
    );
  }

/**
 * Wraps the given raw example text in HTML paragraphs: the word is cloze-
 * deleted and each sentence becomes its own <p>. Sentence boundaries are a
 * period followed (optionally by whitespace then) by a capital letter, since
 * textContent often omits the space between sentences.
 * @param {string} text Raw example text (sentence(s) from the page).
 * @param {string} word Word to be cloze-deleted, or "" to skip.
 * @return {string} HTML string with each sentence wrapped in a <p>.
 */
function wrapExamplePhraseInParagraphs(text, word = "") {
    if (word.length > 0) {
        text = text.replaceAll(word, "{{c1::" + word + "}}");
    }
    return "<p>" + text.replace(/\.\s*(?=[A-Z])/g, ".</p><p>") + "</p>";
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
    if (currentExamplePhrase != null) {
        return currentExamplePhrase;
    }
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
    return wrapExamplePhraseInParagraphs(allText.slice(beg,end), word);
}
