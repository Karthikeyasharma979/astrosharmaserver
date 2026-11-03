/**
 * Krishnamurti Paddhati (KP) Planetary Aspects (Drishti) Engine
 *
 * Supported Conventions:
 * 1. 'kp_western' (Default KP Standard):
 *    Western longitudinal degree aspects as advocated by Prof. K.S. Krishnamurti in KP Readers:
 *    - Conjunction (0°), Semi-Sextile (30°), Semi-Square (45°), Sextile (60°),
 *      Square (90°), Trine (120°), Sesquiquadrate (135°), Quincunx/Inconjunct (150°), Opposition (180°)
 *    - Evaluated to both Planets and 12 Placidus House Cusps
 *    - Exact orbs, Applying vs Separating motion detection (closed-form analytical derivative),
 *      Benefic/Adverse classification
 *
 * 2. 'vedic_special' (Classical Parashari Graha Drishti):
 *    - All 7 planets cast 100% full drishti on the 7th house and planets in it.
 *    - Mars special drishti: 4th, 7th, 8th houses.
 *    - Jupiter special drishti: 5th, 7th, 9th houses.
 *    - Saturn special drishti: 3rd, 7th, 10th houses.
 *    - Rahu & Ketu: Configurable 5th/7th/9th or 7th only or none.
 *
 * 3. 'all': Combined view of both KP Western degree aspects and Classical Vedic Drishti.
 */

import { formatDMS } from '../nakshatraUtils.js';

export const ASPECT_CONVENTIONS = {
    KP_WESTERN: 'kp_western',
    VEDIC_SPECIAL: 'vedic_special',
    ALL: 'all'
};

export const RAHU_KETU_ASPECT_MODES = {
    WESTERN_ASPECTS: 'western_aspects', // Standard in KP: Nodes participate in degree aspects
    TRINE_5_9: 'trine_5_9',             // Vedic: Rahu/Ketu cast 5th, 7th, 9th drishti
    SEVENTH_ONLY: 'seventh_only',       // Vedic: Rahu/Ketu cast 7th drishti only
    NONE: 'none'                        // Exclude Rahu/Ketu from casting aspects
};

export const ORB_MODES = {
    STANDARD: 'standard', // KP Standard: 8° for Sun/Moon major, 6° for planets major, 3°20' for minor
    TIGHT: 'tight',       // Tight: 3°20' for major (1 Navamsha), 1°30' for minor
    WIDE: 'wide'          // Wide: 10° for Sun/Moon, 8° for planets, 5° for minor
};

export const CUSP_ORB_MODES = {
    STANDARD_5_00: 'standard_5_00',   // KP practical standard: 5°00' major, 2°30' minor
    NAVAMSHA_3_20: 'navamsha_3_20',   // Strict KP Navamsha: 3°20' major, 1°40' minor
    FULL_PLANETARY: 'full_planetary'  // Wide: Uses full planetary/luminary orbs (6°/8°)
};

export const WESTERN_ASPECT_DEFINITIONS = [
    {
        name: 'Conjunction',
        symbol: '☌',
        te: 'సంయోగం (యుతి)',
        angle: 0,
        isMajor: true,
        nature: 'neutral', // Depends on planets
        defaultOrbPlanet: 6.0,
        defaultOrbLuminary: 8.0,
        tightOrb: 3.333333,
        wideOrb: 10.0,
        descriptionEn: 'Planets conjoin at the same degree, blending their cosmic energy and house significations.',
        descriptionTe: 'గ్రహాలు ఒకే డిగ్రీ వద్ద కలవడం (యుతి). వీటి కారకత్వాలు పరస్పరం కలిసి పనిచేస్తాయి.'
    },
    {
        name: 'Semi-Sextile',
        symbol: '⚺',
        te: 'ద్వి-ద్వాదశ దృష్టి (30°)',
        angle: 30,
        isMajor: false,
        nature: 'benefic',
        defaultOrbPlanet: 3.333333, // 3°20' (One Navamsha span)
        defaultOrbLuminary: 3.333333,
        tightOrb: 1.5,
        wideOrb: 4.5,
        descriptionEn: 'Mildly benefic 30° growth aspect facilitating steady support between adjacent energies.',
        descriptionTe: '30° సౌమ్య శుభ దృష్టి. క్రమబద్ధమైన పురోగతిని, అనుకూలతను అందిస్తుంది.'
    },
    {
        name: 'Semi-Square',
        symbol: '∠',
        te: 'అర్ధ-కేంద్ర దృష్టి (45°)',
        angle: 45,
        isMajor: false,
        nature: 'malefic',
        defaultOrbPlanet: 2.5,
        defaultOrbLuminary: 3.0,
        tightOrb: 1.5,
        wideOrb: 4.0,
        descriptionEn: 'Mildly adverse 45° aspect indicating subtle friction, restlessness or inner hesitation.',
        descriptionTe: '45° అడ్డంకి లేదా ఘర్షణ కలిగించే సూక్ష్మ అశుభ దృష్టి.'
    },
    {
        name: 'Sextile',
        symbol: '⚹',
        te: 'లాభ దృష్టి (60°)',
        angle: 60,
        isMajor: true,
        nature: 'benefic',
        defaultOrbPlanet: 6.0,
        defaultOrbLuminary: 8.0,
        tightOrb: 3.333333,
        wideOrb: 9.0,
        descriptionEn: 'Harmonious 60° aspect indicating favorable opportunities, intellectual cooperation and assistance.',
        descriptionTe: '60° అనుకూల శుభ దృష్టి. స్నేహపూర్వక సహకారాన్ని, నూతన అవకాశాలను సూచిస్తుంది.'
    },
    {
        name: 'Square',
        symbol: '□',
        te: 'కేంద్ర దృష్టి (90°)',
        angle: 90,
        isMajor: true,
        nature: 'malefic',
        defaultOrbPlanet: 6.0,
        defaultOrbLuminary: 8.0,
        tightOrb: 3.333333,
        wideOrb: 9.0,
        descriptionEn: 'Dynamic challenging 90° aspect indicating obstacle, tension or test requiring conscious effort.',
        descriptionTe: '90° ప్రతికూల కేంద్ర దృష్టి. ఆటంకాలు, సవాళ్లు మరియు కష్టంతో కూడిన విజయాన్ని సూచిస్తుంది.'
    },
    {
        name: 'Trine',
        symbol: '△',
        te: 'త్రికోణ దృష్టి (120°)',
        angle: 120,
        isMajor: true,
        nature: 'benefic',
        defaultOrbPlanet: 6.0,
        defaultOrbLuminary: 8.0,
        tightOrb: 3.333333,
        wideOrb: 9.0,
        descriptionEn: 'Highly auspicious 120° aspect signifying natural harmony, luck, spiritual grace and effortless fruition.',
        descriptionTe: '120° అత్యంత పవిత్రమైన త్రికోణ శుభ దృష్టి. సహజ అదృష్టం, సాఫల్యత మరియు దైవకృపను అందిస్తుంది.'
    },
    {
        name: 'Sesquiquadrate',
        symbol: '⚼',
        te: 'పావు-త్రిభుజ ప్రతికూల దృష్టి (135°)',
        angle: 135,
        isMajor: false,
        nature: 'malefic',
        defaultOrbPlanet: 2.5,
        defaultOrbLuminary: 3.0,
        tightOrb: 1.5,
        wideOrb: 4.0,
        descriptionEn: 'Challenging 135° aspect indicating persistent irritations and stubborn obstacles.',
        descriptionTe: '135° మొండి అడ్డంకులను, చిరాకులను కలిగించే ప్రతికూల దృష్టి.'
    },
    {
        name: 'Quincunx',
        symbol: '⚻',
        te: 'షడష్టక దృష్టి (150°)',
        angle: 150,
        isMajor: false,
        nature: 'malefic',
        defaultOrbPlanet: 3.333333,
        defaultOrbLuminary: 4.0,
        tightOrb: 2.0,
        wideOrb: 5.0,
        descriptionEn: 'Inconjunct 150° aspect requiring constant adjustment, reorganization, or attention to health/debts.',
        descriptionTe: '150° షడష్టక దృష్టి. సర్దుబాటు, శ్రమ మరియు ఆరోగ్య/రుణ సమస్యల పట్ల జాగ్రత్తను కోరుతుంది.'
    },
    {
        name: 'Opposition',
        symbol: '☍',
        te: 'సప్తమ దృష్టి (180° సమసప్తకం)',
        angle: 180,
        isMajor: true,
        nature: 'malefic', // In Western/KP, 180° is a challenging opposition
        defaultOrbPlanet: 6.0,
        defaultOrbLuminary: 8.0,
        tightOrb: 3.333333,
        wideOrb: 9.0,
        descriptionEn: 'Polarizing 180° aspect representing direct confrontation, relational awareness or balancing opposing forces.',
        descriptionTe: '180° సమసప్తక దృష్టి. ముఖాముఖి సంబంధాలు, వివాదాలు లేదా సమతుల్యత సాధించాల్సిన పరిస్థితిని చూపుతుంది.'
    }
];

export const VEDIC_SPECIAL_ASPECTS = {
    Mars: [4, 7, 8],
    Jupiter: [5, 7, 9],
    Saturn: [3, 7, 10],
    Sun: [7],
    Moon: [7],
    Mercury: [7],
    Venus: [7],
    Rahu: [5, 7, 9],
    Ketu: [5, 7, 9]
};

/**
 * Calculates absolute circular difference between two longitudes (0 to 180 degrees)
 * Safely handles 0°/360° boundary wraparound and unnormalized inputs.
 *
 * @param {number} deg1
 * @param {number} deg2
 * @returns {number} Shortest angular distance in degrees [0, 180]
 */
export function getShortestAngle(deg1, deg2) {
    const norm1 = ((Number(deg1) % 360) + 360) % 360;
    const norm2 = ((Number(deg2) % 360) + 360) % 360;
    const diff = Math.abs(norm1 - norm2);
    return diff > 180 ? 360 - diff : diff;
}

/**
 * Determines whether aspect between two bodies is Applying (approaching exact),
 * Separating (moving away from exact), or Exact/Stationary.
 *
 * Mathematical formulation:
 * Uses the exact analytical directional derivative across the 360° circle at t = 0.
 * Completely immune to finite-difference step-size overshoot for fast bodies (Moon).
 * Correctly accounts for direct/retrograde speeds and stationary bodies.
 *
 * @param {number} lon1 - Longitude of casting body [0, 360)
 * @param {number} speed1 - Daily speed of casting body in deg/day
 * @param {number} lon2 - Longitude of receiving body or cusp degree [0, 360)
 * @param {number} speed2 - Daily speed of receiving body (0 for fixed house cusp)
 * @param {number} nominalAngle - Exact aspect angle [0, 180]
 * @returns {'applying' | 'separating' | 'exact'}
 */
export function determineAspectMotion(lon1, speed1, lon2, speed2, nominalAngle) {
    const normLon1 = ((Number(lon1) % 360) + 360) % 360;
    const normLon2 = ((Number(lon2) % 360) + 360) % 360;
    const s1 = Number(speed1) || 0;
    const s2 = Number(speed2) || 0;

    // Relative angular distance measured from body 2 to body 1 along circle [0, 360)
    const diff = (normLon1 - normLon2 + 360) % 360;

    // Shortest angular distance between the two bodies [0, 180]
    const curTheta = diff > 180 ? 360 - diff : diff;

    // Current orb
    const curOrb = Math.abs(curTheta - nominalAngle);
    if (curOrb < 1e-6) {
        return 'exact';
    }

    // Derivative of the shortest distance theta with respect to time:
    // If diff <= 180, theta = diff = lon1 - lon2  ==>  d(theta)/dt = s1 - s2
    // If diff > 180, theta = 360 - diff = lon2 - lon1  ==>  d(theta)/dt = -(s1 - s2) = s2 - s1
    const dThetaDt = diff <= 180 ? (s1 - s2) : (s2 - s1);

    // If relative speed along line of sight is virtually zero:
    if (Math.abs(dThetaDt) < 1e-7) {
        return 'exact';
    }

    // Rate of change of the orb |theta - nominalAngle|:
    // If curTheta < nominalAngle: orb = nominalAngle - theta  ==>  d(orb)/dt = -d(theta)/dt
    //   Orb is decreasing (applying) if d(theta)/dt > 0
    // If curTheta > nominalAngle: orb = theta - nominalAngle  ==>  d(orb)/dt = d(theta)/dt
    //   Orb is decreasing (applying) if d(theta)/dt < 0
    const isApplying = curTheta < nominalAngle ? (dThetaDt > 0) : (dThetaDt < 0);

    return isApplying ? 'applying' : 'separating';
}

/**
 * Computes maximum allowed orb for a planet-to-planet aspect
 */
function getMaxOrb(aspectDef, isLuminaryInvolved, orbMode) {
    if (orbMode === ORB_MODES.TIGHT) {
        return aspectDef.tightOrb;
    }
    if (orbMode === ORB_MODES.WIDE) {
        return aspectDef.wideOrb + (isLuminaryInvolved ? 1.5 : 0);
    }
    // Standard KP mode
    return isLuminaryInvolved ? aspectDef.defaultOrbLuminary : aspectDef.defaultOrbPlanet;
}

/**
 * Computes maximum allowed orb for a planet-to-house-cusp aspect
 */
function getCuspMaxOrb(aspectDef, cuspOrbMode, isLuminaryInvolved) {
    if (cuspOrbMode === CUSP_ORB_MODES.NAVAMSHA_3_20) {
        return aspectDef.isMajor ? 3.333333 : 1.666667;
    }
    if (cuspOrbMode === CUSP_ORB_MODES.STANDARD_5_00) {
        return aspectDef.isMajor ? 5.0 : 2.5;
    }
    // FULL_PLANETARY: uses full planetary/luminary orbs
    return isLuminaryInvolved ? aspectDef.defaultOrbLuminary : aspectDef.defaultOrbPlanet;
}

/**
 * Master Planetary Aspects Calculator
 *
 * @param {Array<Object>} planets - Array of 9 grahas with keys, longitude, house, speedDegPerDay
 * @param {Array<Object>} cusps - Array of 12 Placidus cusps with houseNumber, siderealLongitude
 * @param {Object} [options={}]
 * @param {string} [options.convention='kp_western'] - 'kp_western' | 'vedic_special' | 'all'
 * @param {string} [options.rahuKetuMode='western_aspects'] - Handling for Rahu/Ketu
 * @param {string} [options.orbMode='standard'] - 'standard' | 'tight' | 'wide'
 * @param {string} [options.cuspOrbMode='standard_5_00'] - 'standard_5_00' | 'navamsha_3_20' | 'full_planetary'
 * @param {boolean} [options.includeCusps=true] - Include aspects to 12 Placidus cusps
 * @returns {Object} Comprehensive aspect calculation results
 */
export function calculatePlanetaryAspects(planets, cusps, options = {}) {
    const {
        convention = ASPECT_CONVENTIONS.KP_WESTERN,
        rahuKetuMode = RAHU_KETU_ASPECT_MODES.WESTERN_ASPECTS,
        orbMode = ORB_MODES.STANDARD,
        cuspOrbMode = CUSP_ORB_MODES.STANDARD_5_00,
        includeCusps = true
    } = options;

    if (!Array.isArray(planets) || planets.length === 0) {
        return { aspects: [], summary: { total: 0, benefic: 0, malefic: 0, neutral: 0 } };
    }

    const aspects = [];
    const luminaryKeys = ['Sun', 'Moon'];

    // 1. KP WESTERN DEGREE ASPECTS
    if (convention === ASPECT_CONVENTIONS.KP_WESTERN || convention === ASPECT_CONVENTIONS.ALL) {
        for (let i = 0; i < planets.length; i++) {
            const p1 = planets[i];

            // Check if p1 can cast aspect
            const isP1Node = (p1.key === 'Rahu' || p1.key === 'Ketu');
            if (isP1Node && rahuKetuMode === RAHU_KETU_ASPECT_MODES.NONE) {
                continue;
            }

            // A. Aspects between Planet p1 and Planet p2 (for j > i to avoid duplicate pairings)
            for (let j = i + 1; j < planets.length; j++) {
                const p2 = planets[j];
                const isP2Node = (p2.key === 'Rahu' || p2.key === 'Ketu');
                if (isP2Node && rahuKetuMode === RAHU_KETU_ASPECT_MODES.NONE) {
                    continue;
                }

                // If both are Rahu and Ketu, skip (they are always 180° opposite by astronomical definition)
                if (isP1Node && isP2Node) {
                    continue;
                }

                const shortestAngle = getShortestAngle(p1.longitude, p2.longitude);
                const isLuminary = luminaryKeys.includes(p1.key) || luminaryKeys.includes(p2.key);

                for (const aspDef of WESTERN_ASPECT_DEFINITIONS) {
                    const maxOrb = getMaxOrb(aspDef, isLuminary, orbMode);
                    const currentOrb = Math.abs(shortestAngle - aspDef.angle);

                    if (currentOrb <= maxOrb) {
                        const motion = determineAspectMotion(
                            p1.longitude,
                            p1.speedDegPerDay || 0,
                            p2.longitude,
                            p2.speedDegPerDay || 0,
                            aspDef.angle
                        );

                        // Relative house span
                        const houseDiff = ((p2.house - p1.house + 12) % 12) + 1;

                        aspects.push({
                            id: `western-${p1.key}-${p2.key}-${aspDef.name}`,
                            convention: 'kp_western',
                            aspectType: aspDef.name,
                            aspectSymbol: aspDef.symbol,
                            aspectNameTe: aspDef.te,
                            isMajor: aspDef.isMajor,
                            nature: aspDef.nature,
                            nominalAngle: aspDef.angle,
                            actualAngle: shortestAngle,
                            orb: currentOrb,
                            orbFormatted: formatDMS(currentOrb),
                            motion, // 'applying' | 'separating' | 'exact'
                            castingBody: {
                                key: p1.key,
                                name: p1.name,
                                te: p1.te || p1.name,
                                longitude: p1.longitude,
                                house: p1.house,
                                sign: p1.sign?.en || '',
                                signTe: p1.sign?.te || ''
                            },
                            targetType: 'planet',
                            receivingBody: {
                                key: p2.key,
                                name: p2.name,
                                te: p2.te || p2.name,
                                longitude: p2.longitude,
                                house: p2.house,
                                sign: p2.sign?.en || '',
                                signTe: p2.sign?.te || ''
                            },
                            castingHouse: p1.house,
                            targetHouse: p2.house,
                            relativeHouseSpan: houseDiff,
                            descriptionEn: `${p1.name} in House ${p1.house} forms a ${aspDef.name} (${aspDef.angle}°) with ${p2.name} in House ${p2.house} (Orb: ${formatDMS(currentOrb)}, ${motion === 'applying' ? 'Applying' : motion === 'exact' ? 'Exact' : 'Separating'}). ${aspDef.descriptionEn}`,
                            descriptionTe: `${p1.te || p1.name} (${p1.house}వ భావం) మరియు ${p2.te || p2.name} (${p2.house}వ భావం) మధ్య ${aspDef.te} ఏర్పడింది (ఆర్బ్: ${formatDMS(currentOrb)}, ${motion === 'applying' ? 'సమీపించే గతి' : motion === 'exact' ? 'ఖచ్చితమైన స్థితి' : 'దూరమయ్యే గతి'}). ${aspDef.descriptionTe}`
                        });
                    }
                }
            }

            // B. Aspects between Planet p1 and 12 Placidus House Cusps
            if (includeCusps && Array.isArray(cusps)) {
                for (let cIdx = 0; cIdx < cusps.length; cIdx++) {
                    const cusp = cusps[cIdx];
                    const cuspLon = cusp.siderealLongitude;
                    const cuspNum = cusp.houseNumber || (cIdx + 1);

                    const shortestAngle = getShortestAngle(p1.longitude, cuspLon);
                    const isLuminary = luminaryKeys.includes(p1.key);

                    for (const aspDef of WESTERN_ASPECT_DEFINITIONS) {
                        const maxOrb = getCuspMaxOrb(aspDef, cuspOrbMode, isLuminary);
                        const currentOrb = Math.abs(shortestAngle - aspDef.angle);

                        if (currentOrb <= maxOrb) {
                            const motion = determineAspectMotion(
                                p1.longitude,
                                p1.speedDegPerDay || 0,
                                cuspLon,
                                0, // Cusp is fixed natal point
                                aspDef.angle
                            );

                            aspects.push({
                                id: `western-${p1.key}-Cusp${cuspNum}-${aspDef.name}`,
                                convention: 'kp_western',
                                aspectType: aspDef.name,
                                aspectSymbol: aspDef.symbol,
                                aspectNameTe: aspDef.te,
                                isMajor: aspDef.isMajor,
                                nature: aspDef.nature,
                                nominalAngle: aspDef.angle,
                                actualAngle: shortestAngle,
                                orb: currentOrb,
                                orbFormatted: formatDMS(currentOrb),
                                motion,
                                castingBody: {
                                    key: p1.key,
                                    name: p1.name,
                                    te: p1.te || p1.name,
                                    longitude: p1.longitude,
                                    house: p1.house,
                                    sign: p1.sign?.en || '',
                                    signTe: p1.sign?.te || ''
                                },
                                targetType: 'cusp',
                                receivingBody: {
                                    key: `Cusp ${cuspNum}`,
                                    name: `House ${cuspNum} Cusp`,
                                    te: `${cuspNum}వ భావ సంధి`,
                                    longitude: cuspLon,
                                    house: cuspNum,
                                    sign: cusp.sign?.en || '',
                                    signTe: cusp.sign?.te || ''
                                },
                                castingHouse: p1.house,
                                targetHouse: cuspNum,
                                relativeHouseSpan: ((cuspNum - p1.house + 12) % 12) + 1,
                                descriptionEn: `${p1.name} in House ${p1.house} aspects House ${cuspNum} Cusp with a ${aspDef.name} (${aspDef.angle}°, Orb: ${formatDMS(currentOrb)}, ${motion === 'applying' ? 'Applying' : motion === 'exact' ? 'Exact' : 'Separating'}). In KP, planetary aspect to a Placidus cusp triggers matters of that house.`,
                                descriptionTe: `${p1.te || p1.name} (${p1.house}వ భావం) ${cuspNum}వ భావ సంధిపై ${aspDef.te} ప్రసరింపజేస్తున్నాడు (ఆర్బ్: ${formatDMS(currentOrb)}, ${motion === 'applying' ? 'సమీపించే గతి' : motion === 'exact' ? 'ఖచ్చితమైన స్థితి' : 'దూరమయ్యే గతి'}). కేపీ విధానంలో భావ సంధిపై దృష్టి ఆ భావ ఫలితాలను చైతన్యపరుస్తుంది.`
                            });
                        }
                    }
                }
            }
        }
    }

    // 2. CLASSICAL VEDIC PARASHARI GRAHA DRISHTI
    if (convention === ASPECT_CONVENTIONS.VEDIC_SPECIAL || convention === ASPECT_CONVENTIONS.ALL) {
        for (const p of planets) {
            const isNode = (p.key === 'Rahu' || p.key === 'Ketu');
            if (isNode && rahuKetuMode === RAHU_KETU_ASPECT_MODES.NONE) {
                continue;
            }

            let applicableHouses = VEDIC_SPECIAL_ASPECTS[p.key] || [7];
            if (isNode) {
                if (rahuKetuMode === RAHU_KETU_ASPECT_MODES.SEVENTH_ONLY) {
                    applicableHouses = [7];
                } else if (rahuKetuMode === RAHU_KETU_ASPECT_MODES.NONE) {
                    continue;
                } else {
                    // Default Vedic nodes: 5, 7, 9
                    applicableHouses = [5, 7, 9];
                }
            }

            for (const hCount of applicableHouses) {
                // Target house (1-indexed whole-house count from casting house)
                const targetHouseNum = ((p.house - 1 + (hCount - 1)) % 12) + 1;

                // A. Aspect on the House itself (Whole-House Aspect)
                const targetCusp = cusps ? cusps[targetHouseNum - 1] : null;
                const cuspDeg = targetCusp ? targetCusp.siderealLongitude : null;
                const exactAngleDeg = cuspDeg !== null ? getShortestAngle(p.longitude, cuspDeg) : (hCount - 1) * 30;

                const nature = (p.key === 'Jupiter' || p.key === 'Venus') ? 'benefic' :
                    (p.key === 'Saturn' || p.key === 'Mars' || p.key === 'Rahu' || p.key === 'Ketu') ? 'malefic' : 'neutral';

                const drishtiNameEn = hCount === 7 ? 'Full 7th House Drishti' :
                    hCount === 4 ? 'Special 4th House (Chaturtha) Drishti' :
                    hCount === 8 ? 'Special 8th House (Ashtama) Drishti' :
                    hCount === 5 ? 'Special 5th House (Panchama) Drishti' :
                    hCount === 9 ? 'Special 9th House (Navama) Drishti' :
                    hCount === 3 ? 'Special 3rd House (Tritiya) Drishti' :
                    hCount === 10 ? 'Special 10th House (Dashama) Drishti' : `${hCount}th Drishti`;

                const drishtiNameTe = hCount === 7 ? 'పూర్ణ సప్తమ దృష్టి (7వ భావం)' :
                    hCount === 4 ? 'విశేష చతుర్థ దృష్టి (4వ భావం)' :
                    hCount === 8 ? 'విశేష అష్టమ దృష్టి (8వ భావం)' :
                    hCount === 5 ? 'విశేష పంచమ దృష్టి (5వ భావం)' :
                    hCount === 9 ? 'విశేష నవమ దృష్టి (9వ భావం)' :
                    hCount === 3 ? 'విశేష తృతీయ దృష్టి (3వ భావం)' :
                    hCount === 10 ? 'విశేష దశమ దృష్టి (10వ భావం)' : `${hCount}వ దృష్టి`;

                aspects.push({
                    id: `vedic-${p.key}-House${targetHouseNum}-${hCount}`,
                    convention: 'vedic_special',
                    aspectType: drishtiNameEn,
                    aspectSymbol: '👁️',
                    aspectNameTe: drishtiNameTe,
                    isMajor: true,
                    nature,
                    nominalAngle: (hCount - 1) * 30,
                    actualAngle: exactAngleDeg,
                    orb: 0,
                    orbFormatted: 'Full (100%)',
                    motion: 'applying',
                    castingBody: {
                        key: p.key,
                        name: p.name,
                        te: p.te || p.name,
                        longitude: p.longitude,
                        house: p.house,
                        sign: p.sign?.en || '',
                        signTe: p.sign?.te || ''
                    },
                    targetType: 'house',
                    receivingBody: {
                        key: `House ${targetHouseNum}`,
                        name: `House ${targetHouseNum}`,
                        te: `${targetHouseNum}వ భావం`,
                        longitude: cuspDeg || 0,
                        house: targetHouseNum,
                        sign: targetCusp?.sign?.en || '',
                        signTe: targetCusp?.sign?.te || ''
                    },
                    castingHouse: p.house,
                    targetHouse: targetHouseNum,
                    relativeHouseSpan: hCount,
                    descriptionEn: `${p.name} in House ${p.house} casts ${drishtiNameEn} on House ${targetHouseNum} (100% full Parashari whole-house Drishti).`,
                    descriptionTe: `${p.te || p.name} (${p.house}వ భావం) నుండి ${targetHouseNum}వ భావంపై ${drishtiNameTe}ను సంపూర్ణంగా ప్రసరింపజేస్తున్నాడు.`
                });

                // B. Target planets residing in that target house
                const occupants = planets.filter(op => op.house === targetHouseNum && op.key !== p.key);
                for (const occ of occupants) {
                    const ang = getShortestAngle(p.longitude, occ.longitude);

                    // For whole-house planetary drishti:
                    // Check if the relative separation distance is closing or widening:
                    const normP = ((p.longitude % 360) + 360) % 360;
                    const normOcc = ((occ.longitude % 360) + 360) % 360;
                    const diffCirc = (normP - normOcc + 360) % 360;
                    const sP = Number(p.speedDegPerDay) || 0;
                    const sOcc = Number(occ.speedDegPerDay) || 0;
                    const dDistDt = diffCirc <= 180 ? (sP - sOcc) : (sOcc - sP);
                    const mot = Math.abs(dDistDt) < 1e-7 ? 'exact' : (dDistDt < 0 ? 'applying' : 'separating');

                    aspects.push({
                        id: `vedic-${p.key}-${occ.key}-${hCount}`,
                        convention: 'vedic_special',
                        aspectType: drishtiNameEn,
                        aspectSymbol: '👁️',
                        aspectNameTe: drishtiNameTe,
                        isMajor: true,
                        nature,
                        nominalAngle: (hCount - 1) * 30,
                        actualAngle: ang,
                        orb: 0,
                        orbFormatted: 'Full (100%)',
                        motion: mot,
                        castingBody: {
                            key: p.key,
                            name: p.name,
                            te: p.te || p.name,
                            longitude: p.longitude,
                            house: p.house,
                            sign: p.sign?.en || '',
                            signTe: p.sign?.te || ''
                        },
                        targetType: 'planet',
                        receivingBody: {
                            key: occ.key,
                            name: occ.name,
                            te: occ.te || occ.name,
                            longitude: occ.longitude,
                            house: occ.house,
                            sign: occ.sign?.en || '',
                            signTe: occ.sign?.te || ''
                        },
                        castingHouse: p.house,
                        targetHouse: occ.house,
                        relativeHouseSpan: hCount,
                        descriptionEn: `${p.name} (House ${p.house}) casts ${drishtiNameEn} upon ${occ.name} (House ${occ.house}). Exact longitudinal separation is ${formatDMS(ang)}.`,
                        descriptionTe: `${p.te || p.name} (${p.house}వ భావం) నుండి ${occ.te || occ.name} (${occ.house}వ భావం) పై ${drishtiNameTe}ను ప్రసరింపజేస్తున్నాడు. డిగ్రీ దూరం: ${formatDMS(ang)}.`
                    });
                }
            }
        }
    }

    // Summary counts
    const summary = {
        total: aspects.length,
        benefic: aspects.filter(a => a.nature === 'benefic').length,
        malefic: aspects.filter(a => a.nature === 'malefic').length,
        neutral: aspects.filter(a => a.nature === 'neutral').length,
        westernCount: aspects.filter(a => a.convention === 'kp_western').length,
        vedicCount: aspects.filter(a => a.convention === 'vedic_special').length
    };

    return {
        aspects,
        summary
    };
}
