'use strict';

/**
 * Pre-TTS text normalization for Hindi/Hinglish.
 *
 * Problem: ElevenLabs reads Roman-script Hindi words through its English phoneme engine,
 * causing mispronunciation. For example:
 *   "main" → pronounced as English "mane" (not Hindi "मैं")
 *   "mein" → pronounced as English "mine" (not Hindi "में")
 *   "hun"  → pronounced as "hun" (English slang, not Hindi "हूँ")
 *
 * Solution: Convert these words to phonetic Roman approximations that ElevenLabs
 * pronounces closer to the intended Hindi sound before sending text to TTS.
 *
 * Note: Devanagari text is NOT modified — ElevenLabs handles Devanagari correctly
 * when language_code='hi'. This function only targets Roman-script Hindi words
 * that slip through despite our Devanagari-first prompt rules.
 *
 * @param {string} text     The text to normalize
 * @param {string} language 'hindi' | 'hinglish' | 'english'
 * @returns {string}        Normalized text safe to send to ElevenLabs TTS
 */
function normalizeTTSText(text, language = 'hinglish') {
    // English mode: no changes needed — Roman script is correct
    if (language === 'english') return text;
    if (!text) return text;

    // Each entry: [regex, replacement]
    // Ordered longest/most-specific patterns first to avoid partial matches
    const rules = [

        // ── Common Hindi words written in Roman ───────────────────
        // Prefer direct Devanagari for safer Hindi pronunciation
        [/\bmain\b/gi, 'मैं'],
        [/\bmai\b/gi, 'मैं'],
        [/\baap\b/gi, 'आप'],
        [/\bkya\b/gi, 'क्या'],
        [/\bkaise\b/gi, 'कैसे'],
        [/\btheek\b/gi, 'ठीक'],
        [/\bsahi\b/gi, 'सही'],
        [/\bdhanyavaad\b/gi, 'धन्यवाद'],
        [/\bnamaste\b/gi, 'नमस्ते'],

        // ── Locative particle ─────────────────────────────────────
        // "mein" (in/inside) → "mei"
        // ElevenLabs reads "mein" as "mine"; "mei" sounds like में
        [/\bmein\b/gi, 'में'],
        [/\bmei\b/gi, 'में'],

        // ── To-be auxiliary (am/is) ───────────────────────────────
        // "hoon" / "hun" (I am) → "hu"
        // ElevenLabs gives these an English mispronunciation; "hu" approximates हूँ
        [/\bhoon\b/gi, 'हूँ'],
        [/\bhun\b/gi,  'हूँ'],
        [/\bhu\b/gi,   'हूँ'],
        [/\bhai\b/gi,  'है'],
        [/\bhain\b/gi, 'हैं'],

        // ── Future first-person verb endings ─────────────────────
        // -oongi / -oonge → -ungi / -unge  (e.g. "karoongi" → "karungi")
        // ElevenLabs handles -ungi better than -oongi
        [/oongi\b/gi, 'ungi'],
        [/oonga\b/gi, 'unga'],

        // ── Subjunctive first-person (-oon endings) ───────────────
        // "karoon" (let me do) → "karu"
        [/\bkaroon\b/gi, 'karu'],
        [/\bboloon\b/gi, 'bolu'],
        [/\bdekhoon\b/gi, 'dekhu'],
        [/\bsunoon\b/gi,  'sunu'],

        // ── Negation ─────────────────────────────────────────────
        // "nahin" → "nahi"  (ElevenLabs gives "nahin" an incorrect English /n/ ending)
        [/\bnahin\b/gi, 'नहीं'],
        [/\bnahi\b/gi, 'नहीं'],

        // ── Brand and appliance words → Devanagari ───────────────
        // ElevenLabs Hindi TTS (language_code='hi') reads Roman brand names with English
        // phonemes, causing wrong accent. Devanagari versions are pronounced correctly.
        // ElevenLabs occasionally uses hard 'D' (ड) for 'Godrej' even when written as 'गोदरेज'.
        // Replacing with 'Go-the-rej' ensures a soft 'the' / 'द' sound across engines.
        [/\bGodrej\b/gi,      'Go-the-rej'],
        [/\bRefrigerator\b/gi, 'रेफ्रिजरेटर'],
        [/\bMicrowave\b/gi,    'माइक्रोवेव'],
        [/\bWashing Machine\b/gi, 'वॉशिंग मशीन'],
        [/\bAir Conditioner\b/gi, 'एयर कंडीशनर'],
    ];

    let result = text;
    for (const [pattern, replacement] of rules) {
        result = result.replace(pattern, replacement);
    }

    // ── Date conversion (BEFORE digit expansion) ──────────────────
    // Dates must be read naturally: "15 March 2025" → "पंद्रह March दो हज़ार पच्चीस"
    // NOT digit-by-digit: "एक पाँच March दो शून्य दो पाँच"
    // This must run first so the digit expansion below doesn't break date numbers.

    // Hindi/Hinglish cardinal day words 1-31
    const HI_DAY = [
        '',
        'एक','दो','तीन','चार','पाँच','छह','सात','आठ','नौ','दस',
        'ग्यारह','बारह','तेरह','चौदह','पंद्रह','सोलह','सत्रह','अठारह','उन्नीस','बीस',
        'इक्कीस','बाईस','तेईस','चौबीस','पच्चीस','छब्बीस','सत्ताईस','अट्ठाईस','उनतीस','तीस','इकतीस',
    ];

    // Year suffix for 2000+n where n = 1..50 (index matches n)
    const HI_YEAR_SUFFIX = [
        '',
        'एक','दो','तीन','चार','पाँच','छह','सात','आठ','नौ','दस',
        'ग्यारह','बारह','तेरह','चौदह','पंद्रह','सोलह','सत्रह','अठारह','उन्नीस','बीस',
        'इक्कीस','बाईस','तेईस','चौबीस','पच्चीस','छब्बीस','सत्ताईस','अट्ठाईस','उनतीस','तीस',
        'इकतीस','बत्तीस','तैंतीस','चौंतीस','पैंतीस','छत्तीस','सैंतीस','अड़तीस','उनतालीस','चालीस',
        'इकतालीस','बयालीस','तैंतालीस','चौवन','पैंतालीस','छियालीस','सैंतालीस','अड़तालीस','उनचास','पचास',
    ];

    const MONTH_PAT = 'January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Oct|Nov|Dec';

    result = result.replace(
        new RegExp(`\\b(\\d{1,2})\\s+(${MONTH_PAT})\\s+(\\d{4})\\b`, 'gi'),
        (_, day, month, year) => {
            const d = parseInt(day, 10);
            const y = parseInt(year, 10);
            const dayWord = (d >= 1 && d <= 31) ? HI_DAY[d] : day;
            let yearWord;
            if (y >= 2000 && y <= 2050) {
                const n = y - 2000;
                yearWord = n === 0 ? 'दो हज़ार' : `दो हज़ार ${HI_YEAR_SUFFIX[n]}`;
            } else {
                yearWord = year; // outside range — digit expansion will handle it
            }
            return `${dayWord} ${month} ${yearWord}`;
        }
    );

    // ── Digit-by-digit number expansion ──────────────────────────
    // Convert Arabic numeral sequences (2+ digits) to individual digit words
    // so ElevenLabs reads "2022" as "two zero two two" instead of "two thousand twenty two".
    // Single digits (0-9) are left alone — they're already spoken as single digits by the TTS engine.

    const DIGIT_WORDS_EN = ['zero','one','two','three','four','five','six','seven','eight','nine'];
    const DIGIT_WORDS_HI = ['शून्य','एक','दो','तीन','चार','पाँच','छह','सात','आठ','नौ'];

    result = result.replace(/\b\d{2,}\b/g, (match) => {
        const words = language === 'hindi' || language === 'hinglish'
            ? [...match].map(d => DIGIT_WORDS_HI[parseInt(d, 10)])
            : [...match].map(d => DIGIT_WORDS_EN[parseInt(d, 10)]);
        return words.join(' ');
    });

    return result;
}

module.exports = normalizeTTSText;
