/**
 * Krishnamurti Paddhati (KP) Sub Lord & Sub-Sub Lord Calculation Engine
 *
 * Implements high-precision division of Nakshatras (800 arcminutes = 13°20')
 * into 9 Sub intervals and 81 Sub-Sub intervals according to the
 * 120-year Vimshottari Dasha planetary period proportions.
 */

import { ZODIAC_SIGNS } from '../nakshatraUtils.js';

export const VIMSHOTTARI_PLANETS = [
    { key: 'Ketu', name: 'Ketu', years: 7, short: 'Ke', te: 'కేతు' },
    { key: 'Venus', name: 'Venus', years: 20, short: 'Ve', te: 'శుక్ర' },
    { key: 'Sun', name: 'Sun', years: 6, short: 'Su', te: 'సూర్య' },
    { key: 'Moon', name: 'Moon', years: 10, short: 'Mo', te: 'చంద్ర' },
    { key: 'Mars', name: 'Mars', years: 7, short: 'Ma', te: 'కుజ' },
    { key: 'Rahu', name: 'Rahu', years: 18, short: 'Ra', te: 'రాహు' },
    { key: 'Jupiter', name: 'Jupiter', years: 16, short: 'Ju', te: 'గురు' },
    { key: 'Saturn', name: 'Saturn', years: 19, short: 'Sa', te: 'శని' },
    { key: 'Mercury', name: 'Mercury', years: 17, short: 'Me', te: 'బుధ' }
];

export const TOTAL_DASHA_YEARS = 120;
export const NAKSHATRA_SPAN_DEG = 360.0 / 27.0; // 13° 20' = 13.333333333333334°
export const NAKSHATRA_SPAN_MINUTES = 800.0; // 800 arcminutes

export const KP_NAKSHATRAS = [
    { id: 0, name: "Ashwini", starLord: "Ketu", te: "అశ్విని", hi: "अश्विनी" },
    { id: 1, name: "Bharani", starLord: "Venus", te: "భరణి", hi: "भरणी" },
    { id: 2, name: "Krittika", starLord: "Sun", te: "కృత్తిక", hi: "कृत्तिका" },
    { id: 3, name: "Rohini", starLord: "Moon", te: "రోహిణి", hi: "रोहिणी" },
    { id: 4, name: "Mrigashira", starLord: "Mars", te: "మృగశిర", hi: "मृगशिरा" },
    { id: 5, name: "Ardra", starLord: "Rahu", te: "ఆర్ద్ర", hi: "आर्द्रा" },
    { id: 6, name: "Punarvasu", starLord: "Jupiter", te: "పునర్వసు", hi: "पुनर्वसु" },
    { id: 7, name: "Pushya", starLord: "Saturn", te: "పుష్యమి", hi: "पुष्य" },
    { id: 8, name: "Ashlesha", starLord: "Mercury", te: "ఆశ్లేష", hi: "अश्लेषा" },
    { id: 9, name: "Magha", starLord: "Ketu", te: "మఖ", hi: "मघा" },
    { id: 10, name: "Purva Phalguni", starLord: "Venus", te: "పుబ్బ", hi: "पूर्वा फाल्गुनी" },
    { id: 11, name: "Uttara Phalguni", starLord: "Sun", te: "ఉత్తర", hi: "उत्तरा फाल्गुनी" },
    { id: 12, name: "Hasta", starLord: "Moon", te: "హస్త", hi: "हस्त" },
    { id: 13, name: "Chitra", starLord: "Mars", te: "చిత్త", hi: "चित्रा" },
    { id: 14, name: "Swati", starLord: "Rahu", te: "స్వాతి", hi: "स्वाती" },
    { id: 15, name: "Vishakha", starLord: "Jupiter", te: "విశాఖ", hi: "विशाखा" },
    { id: 16, name: "Anuradha", starLord: "Saturn", te: "అనురాధ", hi: "अनुराधा" },
    { id: 17, name: "Jyeshtha", starLord: "Mercury", te: "జ్యేష్ఠ", hi: "ज्येष्ठा" },
    { id: 18, name: "Mula", starLord: "Ketu", te: "మూల", hi: "मूल" },
    { id: 19, name: "Purva Ashadha", starLord: "Venus", te: "పూర్వాషాఢ", hi: "पूर्वाषाढ़ा" },
    { id: 20, name: "Uttara Ashadha", starLord: "Sun", te: "ఉత్తరాషాఢ", hi: "उत्तराषाढ़ा" },
    { id: 21, name: "Shravana", starLord: "Moon", te: "శ్రవణం", hi: "श्रवण" },
    { id: 22, name: "Dhanishta", starLord: "Mars", te: "ధనిష్ఠ", hi: "धनिष्ठा" },
    { id: 23, name: "Shatabhisha", starLord: "Rahu", te: "శతభిషం", hi: "शतభిషా" },
    { id: 24, name: "Purva Bhadrapada", starLord: "Jupiter", te: "పూర్వాభాద్ర", hi: "पूर्वाभाद्रपद" },
    { id: 25, name: "Uttara Bhadrapada", starLord: "Saturn", te: "ఉత్తరాభాద్ర", hi: "उत्तराभाद्रपद" },
    { id: 26, name: "Revati", starLord: "Mercury", te: "రేవతి", hi: "रेवती" }
];

export const SIGN_LORDS = [
    "Mars",    // 0: Aries
    "Venus",   // 1: Taurus
    "Mercury", // 2: Gemini
    "Moon",    // 3: Cancer
    "Sun",     // 4: Leo
    "Mercury", // 5: Virgo
    "Venus",   // 6: Libra
    "Mars",    // 7: Scorpio
    "Jupiter", // 8: Sagittarius
    "Saturn",  // 9: Capricorn
    "Saturn",  // 10: Aquarius
    "Jupiter"  // 11: Pisces
];

/**
 * Maps a planet key to its Vimshottari index (0 to 8)
 */
export function getVimshottariIndex(planetKey) {
    const idx = VIMSHOTTARI_PLANETS.findIndex(p => p.key.toLowerCase() === planetKey.toLowerCase());
    return idx >= 0 ? idx : 0;
}

/**
 * Builds the 9 Sub Lord intervals for a Nakshatra starting from its Star Lord.
 * Each Sub span is: (years / 120) * (360 / 27) degrees.
 *
 * @param {string} starLordKey - Ketu, Venus, etc.
 * @returns {Array<Object>} 9 sub intervals with startOffset, endOffset, span, and lord
 */
export function getSubLordIntervals(starLordKey) {
    const startIdx = getVimshottariIndex(starLordKey);
    const intervals = [];
    let currentOffset = 0.0;

    for (let i = 0; i < 9; i++) {
        const planet = VIMSHOTTARI_PLANETS[(startIdx + i) % 9];
        const span = (planet.years / TOTAL_DASHA_YEARS) * NAKSHATRA_SPAN_DEG;
        const startOffset = currentOffset;
        const endOffset = currentOffset + span;

        intervals.push({
            subIndex: i,
            planetKey: planet.key,
            planetName: planet.name,
            years: planet.years,
            spanDeg: span,
            spanMinutes: (planet.years / TOTAL_DASHA_YEARS) * NAKSHATRA_SPAN_MINUTES,
            startOffsetDeg: startOffset,
            endOffsetDeg: endOffset
        });

        currentOffset = endOffset;
    }

    return intervals;
}

/**
 * Builds the 9 Sub-Sub Lord intervals for a given Sub interval.
 *
 * @param {string} subLordKey - The lord of the parent sub
 * @param {number} subSpanDeg - The angular width of the parent sub in degrees
 * @param {number} subStartOffsetDeg - Starting angular offset of the parent sub
 * @returns {Array<Object>} 9 sub-sub intervals
 */
export function getSubSubLordIntervals(subLordKey, subSpanDeg, subStartOffsetDeg = 0) {
    const startIdx = getVimshottariIndex(subLordKey);
    const intervals = [];
    let currentOffset = subStartOffsetDeg;

    for (let i = 0; i < 9; i++) {
        const planet = VIMSHOTTARI_PLANETS[(startIdx + i) % 9];
        const span = subSpanDeg * (planet.years / TOTAL_DASHA_YEARS);
        const startOffset = currentOffset;
        const endOffset = currentOffset + span;

        intervals.push({
            subSubIndex: i,
            planetKey: planet.key,
            planetName: planet.name,
            years: planet.years,
            spanDeg: span,
            startOffsetDeg: startOffset,
            endOffsetDeg: endOffset
        });

        currentOffset = endOffset;
    }

    return intervals;
}

/**
 * Master KP Position Resolver
 * Resolves any sidereal longitude (0° to 360°) into:
 * - Sign, Sign Lord, Degree in sign
 * - Nakshatra, Star Lord
 * - Sub Lord
 * - Sub-Sub Lord
 *
 * Uses strict half-open interval conventions [start, end) and floating-point epsilon.
 *
 * @param {number} siderealLongitude - 0.0 to 360.0 degrees
 * @returns {Object} Complete KP positional hierarchy
 */
export function resolveKPLongitude(siderealLongitude) {
    // Normalization to [0, 360)
    let lon = ((siderealLongitude % 360.0) + 360.0) % 360.0;
    // Boundary guard for 360.0
    if (lon >= 360.0) lon = 0.0;

    // 1. Sign & Sign Lord
    const signIndex = Math.min(11, Math.floor(lon / 30.0));
    const degreeInSign = lon - (signIndex * 30.0);
    const sign = ZODIAC_SIGNS[signIndex];
    const signLord = SIGN_LORDS[signIndex];

    // 2. Nakshatra & Star Lord
    // Guard against floating point division boundary imprecision (e.g. 13.333333333333334 / NAKSHATRA_SPAN_DEG yielding 0.9999999999999999)
    let nakIndex = Math.floor((lon + 1e-11) / NAKSHATRA_SPAN_DEG);
    if (nakIndex >= 27) nakIndex = 26;
    if (nakIndex < 0) nakIndex = 0;

    const nakshatra = KP_NAKSHATRAS[nakIndex];
    const starLord = nakshatra.starLord;
    const nakshatraStartDeg = nakIndex * NAKSHATRA_SPAN_DEG;
    const offsetInNak = Math.max(0.0, lon - nakshatraStartDeg);

    // 3. Sub Lord
    const subIntervals = getSubLordIntervals(starLord);
    const EPSILON = 1e-11;

    let matchedSub = null;
    for (let i = 0; i < subIntervals.length; i++) {
        const sub = subIntervals[i];
        // Half-open interval: start <= offset < end (with last sub closing at exactly the end)
        const isLast = i === subIntervals.length - 1;
        if (offsetInNak >= sub.startOffsetDeg - EPSILON && (isLast ? offsetInNak <= sub.endOffsetDeg + EPSILON : offsetInNak < sub.endOffsetDeg - EPSILON)) {
            matchedSub = sub;
            break;
        }
    }
    if (!matchedSub) {
        matchedSub = subIntervals[subIntervals.length - 1];
    }
    const subLord = matchedSub.planetKey;

    // 4. Sub-Sub Lord
    const subSubIntervals = getSubSubLordIntervals(subLord, matchedSub.spanDeg, matchedSub.startOffsetDeg);
    let matchedSubSub = null;
    for (let j = 0; j < subSubIntervals.length; j++) {
        const ss = subSubIntervals[j];
        const isLast = j === subSubIntervals.length - 1;
        if (offsetInNak >= ss.startOffsetDeg - EPSILON && (isLast ? offsetInNak <= ss.endOffsetDeg + EPSILON : offsetInNak < ss.endOffsetDeg - EPSILON)) {
            matchedSubSub = ss;
            break;
        }
    }
    if (!matchedSubSub) {
        matchedSubSub = subSubIntervals[subSubIntervals.length - 1];
    }
    const subSubLord = matchedSubSub.planetKey;

    return {
        longitude: lon,
        signIndex,
        sign,
        signLord,
        degreeInSign,
        nakshatra,
        nakshatraIndex: nakIndex,
        starLord,
        offsetInNakshatra: offsetInNak,
        subLord,
        subInterval: matchedSub,
        subSubLord,
        subSubInterval: matchedSubSub
    };
}
