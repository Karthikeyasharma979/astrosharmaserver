/**
 * Swiss Ephemeris Calculation Adapter for AstroSharma
 *
 * Authoritative astronomical calculation engine for Krishnamurti Paddhati (KP).
 * Uses Swiss Ephemeris (sweph v2.10.03) binding for Node.js.
 *
 * Astronomical calculations performed:
 * - Geocentric apparent planetary positions (Sun, Moon, Mars, Mercury, Jupiter, Venus, Saturn)
 * - Krishnamurti Ayanamsha (SE_SIDM_KRISHNAMURTI = 5)
 * - Mean and True Lunar Nodes (Rahu / Ketu)
 * - Placidus House Cusps (1-12), Ascendant, Midheaven (MC), and ARMC
 * - Polar latitude Porphyry fallback
 *
 * KP Astrology interpretations (Nakshatras, Sub Lords, 4-Level Significators, Ruling Planets)
 * are applied consistently on top of the authoritative Swiss Ephemeris coordinates.
 */

const sweph = require('sweph');
const path = require('path');

// Import KP domain interpretation helpers
const { resolveKPLongitude, SIGN_LORDS } = require('../shared/utils/kp/kpSubLord.js');
const { getKPPlanetHouse, normalizeDeg } = require('../shared/utils/kp/kpHouses.js');
const { calculateKPSignificators } = require('../shared/utils/kp/kpSignificators.js');
const { calculatePlanetaryAspects } = require('../shared/utils/kp/kpAspects.js');
const { calculateKPHora } = require('../shared/utils/kp/kpRulingPlanets.js');
const { formatDMS } = require('../shared/utils/nakshatraUtils.js');
const { resolveLocalToUTC } = require('../shared/services/locationService.js');
const { calculateVimshottariDasha } = require('../shared/utils/kp/vimshottariDasha.js');

const KP_AYANAMSHA_MODES = {
    KP_NEW: 'KP_NEW',
    KP_ORIGINAL: 'KP_ORIGINAL',
    KP_STRAIGHT: 'KP_STRAIGHT'
};

const BODIES = [
    { key: 'Sun', id: sweph.constants.SE_SUN, name: 'Sun', sanskrit: 'Surya', short: 'Su', te: 'సూర్యుడు' },
    { key: 'Moon', id: sweph.constants.SE_MOON, name: 'Moon', sanskrit: 'Chandra', short: 'Mo', te: 'చంద్రుడు' },
    { key: 'Mars', id: sweph.constants.SE_MARS, name: 'Mars', sanskrit: 'Mangal', short: 'Ma', te: 'కుజుడు' },
    { key: 'Mercury', id: sweph.constants.SE_MERCURY, name: 'Mercury', sanskrit: 'Budha', short: 'Me', te: 'బుధుడు' },
    { key: 'Jupiter', id: sweph.constants.SE_JUPITER, name: 'Jupiter', sanskrit: 'Guru', short: 'Ju', te: 'గురువు' },
    { key: 'Venus', id: sweph.constants.SE_VENUS, name: 'Venus', sanskrit: 'Shukra', short: 'Ve', te: 'శుక్రుడు' },
    { key: 'Saturn', id: sweph.constants.SE_SATURN, name: 'Saturn', sanskrit: 'Shani', short: 'Sa', te: 'శని' }
];

/**
 * Converts UTC Date object to Julian Day in UT
 *
 * @param {Date} dateObj
 * @returns {number} Julian Day UT
 */
function getJulianDayUT(dateObj) {
    const year = dateObj.getUTCFullYear();
    const month = dateObj.getUTCMonth() + 1;
    const day = dateObj.getUTCDate();
    const hourUtc = dateObj.getUTCHours() +
        dateObj.getUTCMinutes() / 60.0 +
        dateObj.getUTCSeconds() / 3600.0 +
        dateObj.getUTCMilliseconds() / 3600000.0;

    return sweph.julday(year, month, day, hourUtc, sweph.constants.SE_GREG_CAL);
}

/**
 * Sets sidereal mode and calculates Krishnamurti Ayanamsha for Julian Day UT
 *
 * @param {number} jd_ut - Julian Day in UT
 * @param {string} mode - 'KP_NEW' (default) | 'KP_ORIGINAL' | 'KP_STRAIGHT'
 * @returns {number} Ayanamsha in degrees
 */
function getKPAyanamsha(jd_ut, mode = KP_AYANAMSHA_MODES.KP_NEW) {
    switch (mode) {
        case KP_AYANAMSHA_MODES.KP_ORIGINAL: {
            // Traditional K.S.K. manual ephemeris constant: 23° 45' 56" at J2000.0 (23.76555556°)
            const t = (jd_ut - 2451545.0) / 36525.0;
            return 23.76555556 + 1.3955235 * t + 0.000308 * t * t;
        }

        case KP_AYANAMSHA_MODES.KP_STRAIGHT: {
            // Straight linear model from zero-ayanamsha year 291.0 AD
            const decimalYear = 2000.0 + ((jd_ut - 2451545.0) / 365.25);
            return (decimalYear - 291.0) * (50.2388475 / 3600.0);
        }

        case KP_AYANAMSHA_MODES.KP_NEW:
        default: {
            // Swiss Ephemeris Krishnamurti Sidereal Mode (SE_SIDM_KRISHNAMURTI = 5)
            sweph.set_sid_mode(sweph.constants.SE_SIDM_KRISHNAMURTI, 0, 0);
            return sweph.get_ayanamsa_ut(jd_ut);
        }
    }
}

/**
 * Calculates complete KP Kundli using authoritative Swiss Ephemeris astronomical calculations
 *
 * @param {Object} params
 * @param {string} params.birthDate - 'YYYY-MM-DD'
 * @param {string} params.birthTime - 'HH:MM'
 * @param {number} params.lat - Geographic latitude (-90 to +90)
 * @param {number} params.lon - Geographic longitude (-180 to +180)
 * @param {string} [params.timezone='Asia/Kolkata'] - IANA timezone identifier
 * @param {string} [params.ayanamshaMode='KP_NEW'] - KP_NEW | KP_ORIGINAL | KP_STRAIGHT
 * @param {string} [params.nodeMode='mean'] - 'mean' (default) | 'true'
 * @returns {Object} Complete KP Kundli dataset matching the existing application contract
 */
function calculateKPKundliSwiss({
    birthDate,
    birthTime,
    lat,
    lon,
    timezone = 'Asia/Kolkata',
    ayanamshaMode = KP_AYANAMSHA_MODES.KP_NEW,
    nodeMode = 'mean'
}) {
    const startTime = performance.now();

    // 1. Input Validation
    if (!birthDate || typeof birthDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) {
        throw new Error("Invalid birthDate format. Expected YYYY-MM-DD.");
    }
    if (!birthTime || typeof birthTime !== 'string' || !/^\d{1,2}:\d{2}(:\d{2})?$/.test(birthTime)) {
        throw new Error("Invalid birthTime format. Expected HH:MM.");
    }
    const latitude = Number(lat);
    const longitude = Number(lon);
    if (isNaN(latitude) || latitude < -90 || latitude > 90) {
        throw new Error("Invalid latitude. Must be between -90 and +90 degrees.");
    }
    if (isNaN(longitude) || longitude < -180 || longitude > 180) {
        throw new Error("Invalid longitude. Must be between -180 and +180 degrees.");
    }

    // 2. Resolve exact UTC Date & Julian Day in UT
    const utcDate = resolveLocalToUTC(birthDate, birthTime, timezone);
    const jd_ut = getJulianDayUT(utcDate);

    // 3. Configure KP Sidereal Ayanamsha
    const ayanamsha = getKPAyanamsha(jd_ut, ayanamshaMode);

    // 4. Placidus House Cusps & Ascendant via Swiss Ephemeris
    // sweph.houses_ex with 'P' (Placidus) and SEFLG_SIDEREAL
    sweph.set_sid_mode(sweph.constants.SE_SIDM_KRISHNAMURTI, 0, 0);
    const hRes = sweph.houses_ex(jd_ut, sweph.constants.SEFLG_SIDEREAL, latitude, longitude, 'P');

    const isFallback = (hRes.flag === -1);
    const houseSystemName = isFallback
        ? "Porphyry (Extreme Latitude Fallback)"
        : "Placidus (Standard KP)";

    // hRes.data.houses contains 12 cusps
    const rawCusps = hRes.data.houses;
    const cusps = rawCusps.map((siderealDeg, index) => {
        const normSidereal = normalizeDeg(siderealDeg);
        const resolved = resolveKPLongitude(normSidereal);
        return {
            houseNumber: index + 1,
            tropicalLongitude: normalizeDeg(normSidereal + ayanamsha),
            siderealLongitude: normSidereal,
            signIndex: resolved.signIndex,
            sign: resolved.sign,
            signLord: resolved.signLord,
            degreeInSign: resolved.degreeInSign,
            nakshatra: resolved.nakshatra,
            starLord: resolved.starLord,
            subLord: resolved.subLord,
            subSubLord: resolved.subSubLord
        };
    });

    const ascendantDeg = normalizeDeg(hRes.data.points[0]);
    const lagnaResolved = resolveKPLongitude(ascendantDeg);
    const lagnaCusp = {
        houseNumber: 1,
        tropicalLongitude: normalizeDeg(ascendantDeg + ayanamsha),
        siderealLongitude: ascendantDeg,
        signIndex: lagnaResolved.signIndex,
        sign: lagnaResolved.sign,
        signLord: lagnaResolved.signLord,
        degreeInSign: lagnaResolved.degreeInSign,
        nakshatra: lagnaResolved.nakshatra,
        starLord: lagnaResolved.starLord,
        subLord: lagnaResolved.subLord,
        subSubLord: lagnaResolved.subSubLord
    };

    // 5. Planetary Positions (Sun through Saturn)
    const SID_FLAGS = sweph.constants.SEFLG_SWIEPH | sweph.constants.SEFLG_SIDEREAL | sweph.constants.SEFLG_SPEED;
    const TROP_FLAGS = sweph.constants.SEFLG_SWIEPH | sweph.constants.SEFLG_SPEED;
    const planets = [];

    for (const b of BODIES) {
        const sidRes = sweph.calc_ut(jd_ut, b.id, SID_FLAGS);
        const tropRes = sweph.calc_ut(jd_ut, b.id, TROP_FLAGS);

        const siderealLon = normalizeDeg(sidRes.data[0]);
        const tropicalLon = normalizeDeg(tropRes.data[0]);
        const speed = sidRes.data[3];
        const isRetrograde = (b.key !== 'Sun' && b.key !== 'Moon') && (speed < 0);

        const resolved = resolveKPLongitude(siderealLon);
        const house = getKPPlanetHouse(siderealLon, cusps);

        planets.push({
            key: b.key,
            name: b.name,
            sanskrit: b.sanskrit,
            short: b.short,
            te: b.te,
            tropicalLongitude: tropicalLon,
            longitude: siderealLon,
            signIndex: resolved.signIndex,
            sign: resolved.sign,
            signLord: resolved.signLord,
            degreeInSign: resolved.degreeInSign,
            nakshatra: resolved.nakshatra,
            nakshatraIndex: resolved.nakshatraIndex,
            starLord: resolved.starLord,
            subLord: resolved.subLord,
            subSubLord: resolved.subSubLord,
            house,
            isRetrograde,
            speedDegPerDay: speed
        });
    }

    // 6. Lunar Nodes: Rahu & Ketu (Mean Node or True Node)
    const isTrueNode = (nodeMode === 'true');
    const nodeBodyId = isTrueNode ? sweph.constants.SE_TRUE_NODE : sweph.constants.SE_MEAN_NODE;
    const nodeLabel = isTrueNode ? 'True Node' : 'Mean Node';

    const rahuSidRes = sweph.calc_ut(jd_ut, nodeBodyId, SID_FLAGS);
    const rahuTropRes = sweph.calc_ut(jd_ut, nodeBodyId, TROP_FLAGS);

    const rahuSidereal = normalizeDeg(rahuSidRes.data[0]);
    const ketuSidereal = normalizeDeg(rahuSidereal + 180.0);

    const rahuTropical = normalizeDeg(rahuTropRes.data[0]);
    const ketuTropical = normalizeDeg(rahuTropical + 180.0);

    const rahuSpeed = rahuSidRes.data[3];
    const ketuSpeed = rahuSpeed;

    const rahuResolved = resolveKPLongitude(rahuSidereal);
    const ketuResolved = resolveKPLongitude(ketuSidereal);

    const rahuHouse = getKPPlanetHouse(rahuSidereal, cusps);
    const ketuHouse = getKPPlanetHouse(ketuSidereal, cusps);

    planets.push({
        key: 'Rahu',
        name: `Rahu (${nodeLabel})`,
        sanskrit: 'Rahu',
        short: 'Ra',
        te: 'రాహువు',
        tropicalLongitude: rahuTropical,
        longitude: rahuSidereal,
        signIndex: rahuResolved.signIndex,
        sign: rahuResolved.sign,
        signLord: rahuResolved.signLord,
        degreeInSign: rahuResolved.degreeInSign,
        nakshatra: rahuResolved.nakshatra,
        nakshatraIndex: rahuResolved.nakshatraIndex,
        starLord: rahuResolved.starLord,
        subLord: rahuResolved.subLord,
        subSubLord: rahuResolved.subSubLord,
        house: rahuHouse,
        isRetrograde: true,
        speedDegPerDay: rahuSpeed
    });

    planets.push({
        key: 'Ketu',
        name: `Ketu (${nodeLabel})`,
        sanskrit: 'Ketu',
        short: 'Ke',
        te: 'కేతువు',
        tropicalLongitude: ketuTropical,
        longitude: ketuSidereal,
        signIndex: ketuResolved.signIndex,
        sign: ketuResolved.sign,
        signLord: ketuResolved.signLord,
        degreeInSign: ketuResolved.degreeInSign,
        nakshatra: ketuResolved.nakshatra,
        nakshatraIndex: ketuResolved.nakshatraIndex,
        starLord: ketuResolved.starLord,
        subLord: ketuResolved.subLord,
        subSubLord: ketuResolved.subSubLord,
        house: ketuHouse,
        isRetrograde: true,
        speedDegPerDay: ketuSpeed
    });

    // 7. 4-Fold KP House Significators
    const significators = calculateKPSignificators(planets, cusps);

    // 8. Visual Placidus Houses Representation
    const chartHouses = cusps.map((cusp, i) => {
        const houseNum = i + 1;
        const planetsInHouse = planets.filter(p => p.house === houseNum);
        return {
            houseNumber: houseNum,
            cuspLongitude: cusp.siderealLongitude,
            signIndex: cusp.signIndex,
            sign: cusp.sign,
            signLord: cusp.signLord,
            starLord: cusp.starLord,
            subLord: cusp.subLord,
            subSubLord: cusp.subSubLord,
            planets: planetsInHouse
        };
    });

    const moonPlanet = planets.find(p => p.key === 'Moon');
    const sunPlanet = planets.find(p => p.key === 'Sun');

    const execMs = performance.now() - startTime;

    const calculatedAspects = calculatePlanetaryAspects(planets, cusps);

    return {
        lagna: lagnaCusp,
        lagnaLord: lagnaCusp.signLord,
        planets,
        cusps,
        houses: chartHouses,
        significators,
        aspects: calculatedAspects,
        moonSign: moonPlanet.sign,
        moonPosition: moonPlanet,
        sunSign: sunPlanet.sign,
        sunPosition: sunPlanet,
        nakshatra: moonPlanet.nakshatra,
        subLord: moonPlanet.subLord,
        hora: calculateKPHora({ date: birthDate, time: birthTime, lat, lon, timezone }),
        dasha: calculateVimshottariDasha({
            moonSiderealLongitude: moonPlanet.longitude,
            birthDateUtc: utcDate,
            planets,
            cusps,
            aspects: calculatedAspects,
            significators
        }),
        metadata: {
            utcDate: utcDate.toISOString(),
            jd_ut: jd_ut,
            ayanamshaDeg: ayanamsha.toFixed(6),
            ayanamshaFormatted: formatDMS(ayanamsha),
            ayanamshaMode,
            nodeMode,
            houseSystem: houseSystemName,
            isExtremeLatitudeFallback: isFallback,
            executionTimeMs: execMs.toFixed(2),
            ephemeris: "High-Precision Astronomical Ephemeris",
            engine: "astro_astronomical_engine"
        }
    };
}

module.exports = {
    calculateKPKundliSwiss,
    calculateVimshottariDasha,
    getJulianDayUT,
    getKPAyanamsha,
    KP_AYANAMSHA_MODES
};
