/**
 * DeepSeek API client used by the background page to generate example
 * phrases for AI cards. The API key is stored in chrome.storage.local and is
 * only ever read here, so it never reaches content scripts or web pages.
 * Daily token usage is tracked in chrome.storage.local and compared against
 * a user-configurable limit.
 */
const DEEPSEEK_API_URL = "https://api.deepseek.com/chat/completions";
const DEEPSEEK_CHAT_MODEL = "deepseek-chat";
const DEEPSEEK_API_KEY_STORAGE_KEY = "deepseekApiKey";
const DEEPSEEK_DAILY_TOKEN_LIMIT_KEY = "deepseekDailyTokenLimit";
const DEEPSEEK_USAGE_STORAGE_KEY = "deepseekUsage";
// Roughly 50 generated phrases at ~600 tokens each.
const DEFAULT_DAILY_TOKEN_LIMIT = 30000;
const DEEPSEEK_TIMEOUT_MS = 30000;
const DEEPSEEK_SYSTEM_PROMPT =
    "You write example passages for English vocabulary learners. Given a " +
    "word, its definition, and the context where it appeared, you write a " +
    "short GRE-style passage that uses the word in the same sense. You also " +
    "give a short, simple Japanese definition of the word. You always reply " +
    "with a json object holding the passage and the Japanese definition.";

/**
 * Builds an Error carrying a machine-readable reason so callers can tell a
 * spent daily budget apart from other failures.
 * @param {string} message Human-readable error message.
 * @param {string} reason "config", "limit", or "api".
 * @return {Error} Error with a reason property.
 */
function createDeepSeekError(message, reason) {
    const error = new Error(message);
    error.reason = reason;
    return error;
}

/**
 * @return {string} Today's local date in ISO-8601 calendar-date form.
 */
function getUsageDate() {
    const date = new Date();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return date.getFullYear() + "-" + month + "-" + day;
}

/**
 * Reads the configured DeepSeek API key.
 * @return {Promise<string>} The trimmed key, or "" when unset.
 */
function getDeepSeekApiKey() {
    return new Promise((resolve) => {
        chrome.storage.local.get({[DEEPSEEK_API_KEY_STORAGE_KEY]: ""}, (items) => {
            resolve(String(items[DEEPSEEK_API_KEY_STORAGE_KEY] || "").trim());
        });
    });
}

/**
 * Reads the configured daily token limit. A limit of 0 disables the limit.
 * @return {Promise<number>} Non-negative token limit.
 */
function getDeepSeekDailyTokenLimit() {
    return new Promise((resolve) => {
        chrome.storage.sync.get(
            {[DEEPSEEK_DAILY_TOKEN_LIMIT_KEY]: DEFAULT_DAILY_TOKEN_LIMIT},
            (items) => {
                const limit = Number(items[DEEPSEEK_DAILY_TOKEN_LIMIT_KEY]);
                resolve(Number.isInteger(limit) && limit >= 0 ? limit : DEFAULT_DAILY_TOKEN_LIMIT);
            }
        );
    });
}

/**
 * Reads the tokens spent today, resetting to zero when the stored usage is
 * from an earlier day.
 * @return {Promise<Object>} {date, tokens} for the current day.
 */
function getDeepSeekUsage() {
    return new Promise((resolve) => {
        chrome.storage.local.get(
            {[DEEPSEEK_USAGE_STORAGE_KEY]: {date: "", tokens: 0}},
            (items) => {
                const stored = items[DEEPSEEK_USAGE_STORAGE_KEY] || {};
                const today = getUsageDate();
                const tokens = stored.date === today && typeof stored.tokens === "number"
                    ? stored.tokens
                    : 0;
                resolve({date: today, tokens: tokens});
            }
        );
    });
}

/**
 * Adds to today's token usage, discarding usage recorded on earlier days.
 * @param {number} tokens Tokens spent by the latest request.
 * @return {Promise} Resolving once the usage has been stored.
 */
async function recordDeepSeekUsage(tokens) {
    const usage = await getDeepSeekUsage();
    const updated = {
        date: usage.date,
        tokens: usage.tokens + Math.max(0, Number(tokens) || 0)
    };
    await new Promise((resolve) => {
        chrome.storage.local.set({[DEEPSEEK_USAGE_STORAGE_KEY]: updated}, resolve);
    });
}

/**
 * Approximates the token count of a string when the API omits usage data.
 * @param {string} text Text to estimate.
 * @return {number} Estimated token count.
 */
function estimateTokens(text) {
    return Math.ceil(String(text).length / 4);
}

/**
 * Builds the chat messages sent to DeepSeek.
 * @param {string} word Word being studied.
 * @param {string} definitionText Plain-text definition of the word.
 * @param {string} originalPhrase Context from the page where the word appeared.
 * @return {Array<Object>} Chat messages.
 */
function buildDeepSeekMessages(word, definitionText, originalPhrase) {
    const lines = [
        "Target word: " + word,
        "Definition: " + definitionText
    ];
    if (originalPhrase) {
        lines.push("Original context: " + originalPhrase);
    }
    lines.push(
        "",
        "Write a passage of 2 to 3 sentences for a vocabulary learner.",
        "Requirements:",
        "- Use the target word exactly as written, without changing its form.",
        "- Use the same sense of the word as the definition.",
        "- Match the meaning of the original context, but make the passage easier to study than a newspaper article.",
        "- Use clear, textbook-style vocabulary and avoid other rare words.",
        "- Write plain text only: no quotes, titles, bullet points, or cloze markup.",
        "",
        "Also write a short, simple Japanese definition of the target word " +
            "matching the sense used above, for a learner of English. Use " +
            "everyday Japanese only: no romaji, no English words.",
        "Return a json object with exactly these keys:",
        "{\"passage\": \"<the passage>\", \"japaneseDefinition\": \"<the simple Japanese definition>\"}"
    );
    return [
        {role: "system", content: DEEPSEEK_SYSTEM_PROMPT},
        {role: "user", content: lines.join("\n")}
    ];
}

/**
 * Parses the model's JSON response into the generated passage and its simple
 * Japanese definition. A response that is not valid JSON is treated as the
 * passage with no Japanese definition, so the card can still be created.
 * @param {string} content Raw model response.
 * @return {Object} {passage, japaneseDefinition} strings.
 */
function parseAiCardContent(content) {
    let text = String(content).trim().replace(/^["']+|["']+$/g, "").trim();
    const fenced = text.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
    if (fenced) {
        text = fenced[1].trim();
    }
    let data = null;
    try {
        data = JSON.parse(text);
    } catch (e) {
        data = null;
    }
    if (!data || typeof data !== "object") {
        return {passage: text, japaneseDefinition: ""};
    }
    return {
        passage: typeof data.passage === "string" ? data.passage.trim() : "",
        japaneseDefinition: typeof data.japaneseDefinition === "string"
            ? data.japaneseDefinition.trim()
            : ""
    };
}

/**
 * Calls the DeepSeek chat completions API and returns the generated passage
 * together with a simple Japanese definition of the word. Requests are
 * rejected once the daily token limit has been reached, and the tokens
 * reported by the API are added to today's usage after a successful call.
 * @param {string} word Word being studied.
 * @param {string} definitionText Plain-text definition of the word.
 * @param {string} originalPhrase Context from the page where the word appeared.
 * @return {Promise<Object>} {passage, japaneseDefinition}.
 */
async function generateExamplePhrase(word, definitionText, originalPhrase) {
    const apiKey = await getDeepSeekApiKey();
    if (!apiKey) {
        throw createDeepSeekError("DeepSeek API key is not configured.", "config");
    }
    const limit = await getDeepSeekDailyTokenLimit();
    if (limit > 0) {
        const usage = await getDeepSeekUsage();
        if (usage.tokens >= limit) {
            throw createDeepSeekError("Daily DeepSeek token limit reached.", "limit");
        }
    }
    const messages = buildDeepSeekMessages(word, definitionText, originalPhrase);
    const controller = typeof AbortController === "function" ? new AbortController() : null;
    const timeoutId = controller && typeof setTimeout === "function"
        ? setTimeout(() => controller.abort(), DEEPSEEK_TIMEOUT_MS)
        : null;
    let response;
    try {
        response = await fetch(DEEPSEEK_API_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": "Bearer " + apiKey
            },
            body: JSON.stringify({
                model: DEEPSEEK_CHAT_MODEL,
                messages: messages,
                response_format: {type: "json_object"},
                stream: false
            }),
            signal: controller ? controller.signal : undefined
        });
    } finally {
        if (timeoutId !== null && typeof clearTimeout === "function") {
            clearTimeout(timeoutId);
        }
    }
    if (!response.ok) {
        throw createDeepSeekError("DeepSeek request failed with status " + response.status + ".", "api");
    }
    const data = await response.json();
    const content = data && data.choices && data.choices[0] &&
        data.choices[0].message && data.choices[0].message.content;
    if (typeof content !== "string" || !content.trim()) {
        throw createDeepSeekError("DeepSeek returned an empty response.", "api");
    }
    const parsed = parseAiCardContent(content);
    if (!parsed.passage) {
        throw createDeepSeekError("DeepSeek returned an empty response.", "api");
    }
    const tokensUsed = data.usage && typeof data.usage.total_tokens === "number"
        ? data.usage.total_tokens
        : estimateTokens(messages.map(message => message.content).join(" ")) +
            estimateTokens(content);
    await recordDeepSeekUsage(tokensUsed);
    return parsed;
}
