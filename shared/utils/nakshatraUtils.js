/**
 * Vedic Nakshatra and Astronomical Degree Utilities
 */

export const NAKSHATRAS = [
    { id: 0, name: "Ashwini", lord: "Ketu", deity: "Ashwini Kumaras", te: "అశ్విని", hi: "अश्विनी", stone: "Cat's Eye" },
    { id: 1, name: "Bharani", lord: "Venus", deity: "Yama", te: "భరణి", hi: "भरणी", stone: "Diamond" },
    { id: 2, name: "Krittika", lord: "Sun", deity: "Agni", te: "కృత్తిక", hi: "कृत्तिका", stone: "Ruby" },
    { id: 3, name: "Rohini", lord: "Moon", deity: "Brahma", te: "రోహిణి", hi: "रोहिणी", stone: "Pearl" },
    { id: 4, name: "Mrigashira", lord: "Mars", deity: "Soma", te: "మృగశిర", hi: "मृगशिरा", stone: "Red Coral" },
    { id: 5, name: "Arudra", lord: "Rahu", deity: "Rudra", te: "ఆర్ద్ర", hi: "आर्द्रा", stone: "Gomed (Hessonite)" },
    { id: 6, name: "Punarvasu", lord: "Jupiter", deity: "Aditi", te: "పునర్వసు", hi: "पुनर्वसु", stone: "Yellow Sapphire" },
    { id: 7, name: "Pushyami", lord: "Saturn", deity: "Brihaspati", te: "పుష్యమి", hi: "पुष्य", stone: "Blue Sapphire" },
    { id: 8, name: "Ashlesha", lord: "Mercury", deity: "Sarpa", te: "ఆశ్లేష", hi: "अश्लेषा", stone: "Emerald" },
    { id: 9, name: "Makha", lord: "Ketu", deity: "Pitris", te: "మఖ", hi: "मघा", stone: "Cat's Eye" },
    { id: 10, name: "Purva Phalguni", lord: "Venus", deity: "Bhaga", te: "పుబ్బ", hi: "पूर्वा फाल्गुनी", stone: "Diamond" },
    { id: 11, name: "Uttara Phalguni", lord: "Sun", deity: "Aryaman", te: "ఉత్తర", hi: "उत्तरा फाल्गुनी", stone: "Ruby" },
    { id: 12, name: "Hasta", lord: "Moon", deity: "Savitar", te: "హస్త", hi: "हस्त", stone: "Pearl" },
    { id: 13, name: "Chitta", lord: "Mars", deity: "Tvashtar", te: "చిత్త", hi: "चित्रा", stone: "Red Coral" },
    { id: 14, name: "Swati", lord: "Rahu", deity: "Vayu", te: "స్వాతి", hi: "स्वाती", stone: "Gomed" },
    { id: 15, name: "Vishakha", lord: "Jupiter", deity: "Indra-Agni", te: "విశాఖ", hi: "विशाखा", stone: "Yellow Sapphire" },
    { id: 16, name: "Anuradha", lord: "Saturn", deity: "Mitra", te: "అనురాధ", hi: "अनुराधा", stone: "Blue Sapphire" },
    { id: 17, name: "Jyeshta", lord: "Mercury", deity: "Indra", te: "జ్యేష్ఠ", hi: "ज्येष्ठा", stone: "Emerald" },
    { id: 18, name: "Mula", lord: "Ketu", deity: "Nirriti", te: "మూల", hi: "मूल", stone: "Cat's Eye" },
    { id: 19, name: "Purva Ashadha", lord: "Venus", deity: "Apah", te: "పూర్వాషాఢ", hi: "पूर्वाषाढ़ा", stone: "Diamond" },
    { id: 20, name: "Uttara Ashadha", lord: "Sun", deity: "Vishvadevas", te: "ఉత్తరాషాఢ", hi: "उत्तराषाढ़ा", stone: "Ruby" },
    { id: 21, name: "Shravana", lord: "Moon", deity: "Vishnu", te: "శ్రవణం", hi: "श्रवण", stone: "Pearl" },
    { id: 22, name: "Dhanishta", lord: "Mars", deity: "Vasus", te: "ధనిష్ఠ", hi: "धनिष्ठा", stone: "Red Coral" },
    { id: 23, name: "Shatabhisha", lord: "Rahu", deity: "Varuna", te: "శతభిషం", hi: "शतభిషా", stone: "Gomed" },
    { id: 24, name: "Purva Bhadrapada", lord: "Jupiter", deity: "Aja Ekapada", te: "పూర్వాభాద్ర", hi: "पूर्वाभाद्रपद", stone: "Yellow Sapphire" },
    { id: 25, name: "Uttara Bhadrapada", lord: "Saturn", deity: "Ahirbudhnya", te: "ఉత్తరాభాద్ర", hi: "उत्तराभाद्रपद", stone: "Blue Sapphire" },
    { id: 26, name: "Revati", lord: "Mercury", deity: "Pushan", te: "రేవతి", hi: "रेवती", stone: "Emerald" }
];

export const ZODIAC_SIGNS = [
    { id: 0, en: "Aries", sa: "Mesha", te: "మేషం", hi: "मेष", lord: "Mars", element: "Fire", symbol: "♈" },
    { id: 1, en: "Taurus", sa: "Vrishabha", te: "వృషభం", hi: "वृषभ", lord: "Venus", element: "Earth", symbol: "♉" },
    { id: 2, en: "Gemini", sa: "Mithuna", te: "మిథునం", hi: "मिथुन", lord: "Mercury", element: "Air", symbol: "♊" },
    { id: 3, en: "Cancer", sa: "Karkataka", te: "కర్కాటకం", hi: "कर्क", lord: "Moon", element: "Water", symbol: "♋" },
    { id: 4, en: "Leo", sa: "Simha", te: "సింహం", hi: "सिंह", lord: "Sun", element: "Fire", symbol: "♌" },
    { id: 5, en: "Virgo", sa: "Kanya", te: "కన్య", hi: "कन्या", lord: "Mercury", element: "Earth", symbol: "♍" },
    { id: 6, en: "Libra", sa: "Tula", te: "తుల", hi: "तुला", lord: "Venus", element: "Air", symbol: "♎" },
    { id: 7, en: "Scorpio", sa: "Vrischika", te: "వృశ్చికం", hi: "वृश्चिक", lord: "Mars", element: "Water", symbol: "♏" },
    { id: 8, en: "Sagittarius", sa: "Dhanu", te: "ధనస్సు", hi: "धनु", lord: "Jupiter", element: "Fire", symbol: "♐" },
    { id: 9, en: "Capricorn", sa: "Makara", te: "మకరం", hi: "मकर", lord: "Saturn", element: "Earth", symbol: "♑" },
    { id: 10, en: "Aquarius", sa: "Kumbha", te: "కుంభం", hi: "कुम्भ", lord: "Saturn", element: "Air", symbol: "♒" },
    { id: 11, en: "Pisces", sa: "Meena", te: "మీనం", hi: "मीन", lord: "Jupiter", element: "Water", symbol: "♓" }
];

/**
 * Calculates Nakshatra and Pada for a given sidereal longitude (0° to 360°)
 * Guarded against boundary floating-point precision issues.
 */
export function getNakshatraAndPada(longitude) {
    const normalized = ((longitude % 360) + 360) % 360;
    const nakSpan = 360 / 27; // 13° 20' = 13.333333333333334°
    const padaSpan = nakSpan / 4; // 3° 20' = 3.3333333333333335°

    let nakIndex = Math.floor(normalized / nakSpan);
    if (nakIndex >= 27) nakIndex = 26;

    const degreeInNak = normalized - (nakIndex * nakSpan);
    let pada = Math.floor(degreeInNak / padaSpan) + 1;
    if (pada > 4) pada = 4;
    if (pada < 1) pada = 1;

    return {
        nakshatra: NAKSHATRAS[nakIndex],
        nakshatraIndex: nakIndex,
        pada,
        degreeInNakshatra: degreeInNak
    };
}

/**
 * Formats degrees into standard degree-minute-second representation
 */
export function formatDMS(deg) {
    const d = Math.floor(deg);
    const remMinutes = (deg - d) * 60;
    const m = Math.floor(remMinutes);
    const s = Math.round((remMinutes - m) * 60);
    return `${d}° ${String(m).padStart(2, '0')}' ${String(s === 60 ? 59 : s).padStart(2, '0')}"`;
}

/**
 * Formats degrees into standard compact degree-minute representation for Kundli charts (e.g. 14°25')
 */
export function formatChartDegree(deg) {
    if (deg === undefined || deg === null || isNaN(deg)) return '';
    const d = Math.floor(deg);
    const m = Math.floor((deg - d) * 60);
    return `${d}°${String(m).padStart(2, '0')}'`;
}

