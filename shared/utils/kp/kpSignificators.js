/**
 * Krishnamurti Paddhati (KP) 4-Fold House Significator Engine
 *
 * Implements the standard Krishnamurti 4-level significator hierarchy:
 * - Level 1 (Grade A - Strongest): Planets in the Star (Nakshatra) of an occupant of the house
 * - Level 2 (Grade B - Strong):    Planets occupying the house
 * - Level 3 (Grade C - Moderate):  Planets in the Star (Nakshatra) of the lord of the house
 * - Level 4 (Grade D - Baseline):  The lord of the house itself
 *
 * Provides two-way matrices:
 * 1. House -> Significator Planets (with level breakdown)
 * 2. Planet -> Houses Signified (with grade breakdown)
 */

/**
 * Calculates 4-fold KP House Significators
 *
 * @param {Array<Object>} planets - 9 grahas with house, starLord, subLord
 * @param {Array<Object>} cusps - 12 Placidus house cusps with signLord, starLord, subLord
 * @returns {Object} { houseSignificators, planetSignifications }
 */
export function calculateKPSignificators(planets, cusps) {
    const houseSignificators = [];
    const planetSignificationsMap = {};

    // Initialize planet records
    const PLANET_KEYS = ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn', 'Rahu', 'Ketu'];
    for (const key of PLANET_KEYS) {
        planetSignificationsMap[key] = {
            planetKey: key,
            level1Houses: [],
            level2Houses: [],
            level3Houses: [],
            level4Houses: [],
            allHouses: []
        };
    }

// Process each house 1 to 12
    for (let h = 1; h <= 12; h++) {
        const cusp = cusps[h - 1];
        const houseLord = cusp.signLord;

        // Level 2: Occupants of House H
        const occupants = planets.filter(p => p.house === h);
        const level2Planets = occupants.map(p => p.key);

        // Level 1: Planets in the Star of an occupant of House H
        const level1Planets = [];
        for (const occ of occupants) {
            const inStar = planets.filter(p => p.starLord === occ.key).map(p => p.key);
            for (const pKey of inStar) {
                if (!level1Planets.includes(pKey)) {
                    level1Planets.push(pKey);
                }
            }
        }

        // Level 3: Planets in the Star of the Lord of House H
        const level3Planets = [];
        if (houseLord) {
            const inLordStar = planets.filter(p => p.starLord === houseLord).map(p => p.key);
            for (const pKey of inLordStar) {
                if (!level3Planets.includes(pKey)) {
                    level3Planets.push(pKey);
                }
            }
        }

        // Level 4: The Lord of House H
        const level4Planets = houseLord ? [houseLord] : [];

        // Combine unique significators in order of strength (Levels 1 to 4)
        const allUnique = [];
        const addUnique = (list) => {
            for (const p of list) {
                if (!allUnique.includes(p)) allUnique.push(p);
            }
        };
        addUnique(level1Planets);
        addUnique(level2Planets);
        addUnique(level3Planets);
        addUnique(level4Planets);

        // KP Planetary Aspects (Graha Drishti) on House H:
        // Identify which planets cast aspect on house H based on project rules
        const aspectingPlanets = [];
        const aspectedByDetails = [];
        for (const p of planets) {
            if (typeof p.house === 'number' && p.house >= 1 && p.house <= 12) {
                const aspects = getPlanetAspectHouses(p.key, p.house);
                const matchingAspect = aspects.find(asp => asp.house === h);
                if (matchingAspect) {
                    if (!aspectingPlanets.includes(p.key)) {
                        aspectingPlanets.push(p.key);
                    }
                    aspectedByDetails.push({
                        planetKey: p.key,
                        planetName: p.name || p.key,
                        span: matchingAspect.span,
                        aspectNameEn: matchingAspect.aspectNameEn,
                        aspectNameTe: matchingAspect.aspectNameTe,
                        castingHouse: p.house
                    });
                }
            }
        }

        // Add aspecting planets to allSignificators deduplicated
        const primarySignificators = [...allUnique];
        addUnique(aspectingPlanets);

        houseSignificators.push({
            houseNumber: h,
            cuspLongitude: cusp.siderealLongitude,
            sign: cusp.sign,
            signLord: cusp.signLord,
            starLord: cusp.starLord,
            subLord: cusp.subLord,
            occupants: level2Planets,
            level1: level1Planets,
            level2: level2Planets,
            level3: level3Planets,
            level4: level4Planets,
            primarySignificators,
            allSignificators: allUnique, // Levels 1-4 + Aspecting Planets (Drishti), strictly unique
            allSignificatorsWithAspects: allUnique,
            // Aspect (Drishti) indications
            aspectedByPlanets: aspectingPlanets,
            aspectedByDetails
        });

        // Record in reverse mapping (Planet -> Houses)
        for (const pKey of level1Planets) {
            if (planetSignificationsMap[pKey] && !planetSignificationsMap[pKey].level1Houses.includes(h)) {
                planetSignificationsMap[pKey].level1Houses.push(h);
            }
        }
        for (const pKey of level2Planets) {
            if (planetSignificationsMap[pKey] && !planetSignificationsMap[pKey].level2Houses.includes(h)) {
                planetSignificationsMap[pKey].level2Houses.push(h);
            }
        }
        for (const pKey of level3Planets) {
            if (planetSignificationsMap[pKey] && !planetSignificationsMap[pKey].level3Houses.includes(h)) {
                planetSignificationsMap[pKey].level3Houses.push(h);
            }
        }
        for (const pKey of level4Planets) {
            if (planetSignificationsMap[pKey] && !planetSignificationsMap[pKey].level4Houses.includes(h)) {
                planetSignificationsMap[pKey].level4Houses.push(h);
            }
        }
    }

    // Consolidate unique houses for each planet & attach aspected houses
    const planetSignifications = Object.values(planetSignificationsMap).map(record => {
        // Core Level 1-4 unique houses
        const primaryHouses = Array.from(new Set([
            ...record.level1Houses,
            ...record.level2Houses,
            ...record.level3Houses,
            ...record.level4Houses
        ])).sort((a, b) => a - b);

        const planetObj = planets.find(p => p.key === record.planetKey);
        const occupiedHouse = planetObj?.house || 0;

        // Aspect indications for this planet
        const aspectDetails = getPlanetAspectHouses(record.planetKey, occupiedHouse);
        const aspectedHouses = Array.from(new Set(aspectDetails.map(a => a.house))).sort((a, b) => a - b);

        // Combined set of primary + aspect-influenced houses without duplicates
        const allHousesWithAspects = Array.from(new Set([...primaryHouses, ...aspectedHouses])).sort((a, b) => a - b);

        return {
            ...record,
            planetName: planetObj?.name || record.planetKey,
            starLord: planetObj?.starLord || '',
            subLord: planetObj?.subLord || '',
            house: occupiedHouse,
            primaryHouses,
            allHouses: allHousesWithAspects, // Levels 1-4 + Aspected Houses (Drishti), strictly unique
            aspectedHouses,          // Houses aspected by this planet
            aspectedHousesDetails: aspectDetails,
            allHousesWithAspects     // Union of primary + aspected houses
        };
    });

    const aspectSignifications = calculateKPAspectSignifications(planets, cusps);

    return {
        houseSignificators,
        planetSignifications,
        aspectSignifications,
        planetaryLordshipMatrix: calculatePlanetaryLordshipMatrix(planets, cusps)
    };
}

/**
 * Classical Parashari Graha Drishti rules utilized in KP house analysis
 */
export const KP_VEDIC_DRISHTI_RULES = {
    Sun: [7],
    Moon: [7],
    Mars: [4, 7, 8],
    Mercury: [7],
    Jupiter: [5, 7, 9],
    Venus: [7],
    Saturn: [3, 7, 10],
    Rahu: [5, 7, 9],
    Ketu: [5, 7, 9]
};

export const DRISHTI_SPAN_NAMES = {
    3: { en: '3rd Drishti', te: '3వ దృష్టి' },
    4: { en: '4th Drishti', te: '4వ దృష్టి' },
    5: { en: '5th Drishti', te: '5వ దృష్టి' },
    7: { en: '7th Drishti', te: '7వ దృష్టి' },
    8: { en: '8th Drishti', te: '8వ దృష్టి' },
    9: { en: '9th Drishti', te: '9వ దృష్టి' },
    10: { en: '10th Drishti', te: '10వ దృష్టి' }
};

/**
 * Computes which houses a planet aspects based on its occupied house and Graha Drishti rules
 *
 * @param {string} planetKey - Planet key (e.g. 'Mars')
 * @param {number} occupiedHouse - 1-indexed house number (1 to 12)
 * @returns {Array<Object>} List of { house, span, aspectNameEn, aspectNameTe }
 */
export function getPlanetAspectHouses(planetKey, occupiedHouse) {
    if (!planetKey || typeof occupiedHouse !== 'number' || occupiedHouse < 1 || occupiedHouse > 12) {
        return [];
    }
    const spans = KP_VEDIC_DRISHTI_RULES[planetKey] || [7];
    return spans.map(span => {
        const targetHouse = ((occupiedHouse - 1 + (span - 1)) % 12) + 1;
        const nameObj = DRISHTI_SPAN_NAMES[span] || { en: `${span}th Drishti`, te: `${span}వ దృష్టి` };
        return {
            house: targetHouse,
            span,
            aspectNameEn: nameObj.en,
            aspectNameTe: nameObj.te
        };
    });
}

/**
 * Master Aspect-Signification Mapper for KP Horoscope
 *
 * @param {Array<Object>} planets
 * @param {Array<Object>} cusps
 * @returns {Object} Comprehensive two-way aspect mappings
 */
export function calculateKPAspectSignifications(planets = [], cusps = []) {
    const PLANET_KEYS = ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn', 'Rahu', 'Ketu'];
    const planetAspects = [];
    const houseAspects = [];

    // Map each planet to its aspected houses
    for (const key of PLANET_KEYS) {
        const pl = planets.find(p => p.key === key);
        const house = pl ? pl.house : 0;
        const details = getPlanetAspectHouses(key, house);
        const houses = Array.from(new Set(details.map(d => d.house))).sort((a, b) => a - b);
        planetAspects.push({
            planetKey: key,
            planetName: pl?.name || key,
            occupiedHouse: house,
            aspectedHouses: houses,
            aspectedHousesDetails: details
        });
    }

    // Map each house to its aspecting planets
    for (let h = 1; h <= 12; h++) {
        const aspecting = [];
        const details = [];
        for (const plRec of planetAspects) {
            const match = plRec.aspectedHousesDetails.find(d => d.house === h);
            if (match) {
                aspecting.push(plRec.planetKey);
                details.push({
                    planetKey: plRec.planetKey,
                    planetName: plRec.planetName,
                    castingHouse: plRec.occupiedHouse,
                    span: match.span,
                    aspectNameEn: match.aspectNameEn,
                    aspectNameTe: match.aspectNameTe
                });
            }
        }
        houseAspects.push({
            houseNumber: h,
            aspectingPlanets: aspecting,
            aspectDetails: details
        });
    }

    return {
        planetAspects,
        houseAspects,
        totalAspectLinks: houseAspects.reduce((sum, h) => sum + h.aspectingPlanets.length, 0)
    };
}

/**
 * Calculates the classical KP Planetary Lordship Matrix: PL(h) - (owns) (stl of) (sub of)
 *
 * Implements standard Krishnamurti Paddhati rules:
 * - PL(h): House occupied by the planet (marked with ® for retrograde)
 * - (owns): Houses owned by the planet based on cusp sign lord (Rahu and Ketu represent their dispositor)
 * - (stl of): Star Lord Significators (houses occupied and owned by the planet's Star Lord)
 * - (sub of): Sub-Lord Significators (houses occupied and owned by the planet's Sub Lord)
 * - (aspects): Houses aspected by this planet via Graha Drishti
 *
 * @param {Array<Object>} planets - 9 grahas with house, starLord, subLord, signLord, isRetrograde
 * @param {Array<Object>} cusps - 12 Placidus house cusps with signLord
 * @returns {Array<Object>} 9 planet lordship matrix rows
 */
export function calculatePlanetaryLordshipMatrix(planets = [], cusps = []) {
    const SIGN_LORDS = {
        aries: 'Mars', taurus: 'Venus', gemini: 'Mercury', cancer: 'Moon',
        leo: 'Sun', virgo: 'Mercury', libra: 'Venus', scorpio: 'Mars',
        sagittarius: 'Jupiter', capricorn: 'Saturn', aquarius: 'Saturn', pisces: 'Jupiter'
    };

    // Helper: resolve houses owned by a planet (including Rahu/Ketu representing their sign dispositors)
    const getPlanetOwnership = (pKey) => {
        if (!pKey) return [];
        if (pKey === 'Rahu' || pKey === 'Ketu') {
            const node = planets.find(p => p.key === pKey);
            const dispKey = node?.signLord || (node?.sign?.en ? SIGN_LORDS[node.sign.en.toLowerCase()] : null);
            if (!dispKey) return [];
            return cusps.filter(c => c.signLord === dispKey).map(c => c.houseNumber);
        }
        return cusps.filter(c => c.signLord === pKey).map(c => c.houseNumber);
    };

    // Helper: resolve complete house significators of any planet (occupancy + ownership + dispositor occupancy for nodes)
    const getPlanetSignificators = (pKey) => {
        if (!pKey) return [];
        const pl = planets.find(p => p.key === pKey);
        if (!pl) return [];
        const occ = pl.house;
        const owns = getPlanetOwnership(pKey);
        let houses = (typeof occ === 'number' && occ >= 1 && occ <= 12) ? [occ, ...owns] : [...owns];

        // For Rahu and Ketu, include their dispositor's occupancy in addition to ownership
        if (pKey === 'Rahu' || pKey === 'Ketu') {
            const dispKey = pl.signLord || (pl.sign?.en ? SIGN_LORDS[pl.sign.en.toLowerCase()] : null);
            const dispPl = planets.find(p => p.key === dispKey);
            if (dispPl && typeof dispPl.house === 'number' && dispPl.house >= 1 && dispPl.house <= 12) {
                houses.push(dispPl.house);
            }
        }

        return Array.from(new Set(houses)).sort((a, b) => a - b);
    };

    const PLANET_ORDER = ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn', 'Rahu', 'Ketu'];
    const formatList = (arr) => (arr && arr.length > 0 ? `(${arr.join(',')})` : '(..)');

    return PLANET_ORDER.map(pKey => {
        const planet = planets.find(p => p.key === pKey);
        const house = planet ? planet.house : '-';
        const isRetro = Boolean(planet?.isRetrograde);

        const owns = getPlanetOwnership(pKey);
        const stlLord = planet?.starLord;
        const stlOf = stlLord ? getPlanetSignificators(stlLord) : [];
        const subLord = planet?.subLord;
        const subOf = subLord ? getPlanetSignificators(subLord) : [];

        // Aspects (Graha Drishti on houses)
        const aspectDetails = (typeof house === 'number' && house >= 1 && house <= 12)
            ? getPlanetAspectHouses(pKey, house)
            : [];
        const aspectedHouses = Array.from(new Set(aspectDetails.map(a => a.house))).sort((a, b) => a - b);

        return {
            key: pKey,
            planetKey: pKey,
            code: pKey.slice(0, 2).toUpperCase(),
            house,
            occupiedHouse: house,
            isRetro,
            isRetrograde: isRetro,
            starLord: stlLord || '',
            subLord: subLord || '',
            owns,
            stlOf,
            subOf,
            aspectedHouses,
            aspects: aspectedHouses,
            aspectsDetails: aspectDetails,
            ownsStr: formatList(owns),
            ownsFormatted: formatList(owns),
            stlOfStr: formatList(stlOf),
            stlOfFormatted: formatList(stlOf),
            subOfStr: formatList(subOf),
            subOfFormatted: formatList(subOf),
            aspectsStr: formatList(aspectedHouses),
            aspectsFormatted: formatList(aspectedHouses)
        };
    });
}
