/**
 * High-Precision Placidus House Cusp Engine for Krishnamurti Paddhati (KP)
 *
 * Implements rigorous semi-diurnal / semi-nocturnal arc trisection in Right Ascension
 * with fixed-point iteration, conversion to ecliptic longitude, KP sidereal reduction,
 * and high-latitude fallback.
 */

import * as Astronomy from 'astronomy-engine';
import { resolveKPLongitude } from './kpSubLord.js';
import { getKPAyanamsha, KP_AYANAMSHA_MODES } from './kpAyanamsha.js';

const DEG2RAD = Math.PI / 180.0;
const RAD2DEG = 180.0 / Math.PI;

/**
 * Normalizes degrees to [0, 360)
 */
export function normalizeDeg(deg) {
    return ((deg % 360.0) + 360.0) % 360.0;
}

/**
 * Converts Right Ascension on the Ecliptic to Ecliptic Longitude
 *
 * @param {number} raDeg - Right Ascension in degrees
 * @param {number} epsDeg - Obliquity of ecliptic in degrees
 * @returns {number} Ecliptic longitude in degrees [0, 360)
 */
export function raToEclipticLon(raDeg, epsDeg) {
    const raRad = raDeg * DEG2RAD;
    const epsRad = epsDeg * DEG2RAD;
    const y = Math.sin(raRad);
    const x = Math.cos(raRad) * Math.cos(epsRad);
    let lon = Math.atan2(y, x) * RAD2DEG;
    return normalizeDeg(lon);
}

/**
 * Calculates Placidus Right Ascension for an intermediate cusp iteratively.
 *
 * Equation:
 *   alpha = baseDeg + factor * arcsin(tan(phi) * tan(eps) * sin(alpha))
 *
 * @param {number} baseDeg - RAMC + 30, 60, 120, or 150
 * @param {number} factor - 1/3 or 2/3
 * @param {number} phiDeg - Geographic latitude
 * @param {number} epsDeg - True obliquity of the ecliptic
 * @returns {number} Converged Right Ascension in degrees
 */
function solvePlacidusRA(baseDeg, factor, phiDeg, epsDeg) {
    const tanPhi = Math.tan(phiDeg * DEG2RAD);
    const tanEps = Math.tan(epsDeg * DEG2RAD);
    const maxArg = Math.abs(tanPhi * tanEps);

    // If polar or near-polar, iteration will not converge
    if (maxArg >= 0.999) {
        return normalizeDeg(baseDeg);
    }

    let alpha = baseDeg;
    for (let iter = 0; iter < 40; iter++) {
        const sinAlpha = Math.sin(alpha * DEG2RAD);
        let arg = tanPhi * tanEps * sinAlpha;
        if (arg > 1.0) arg = 1.0;
        if (arg < -1.0) arg = -1.0;

        const delta = factor * Math.asin(arg) * RAD2DEG;
        const nextAlpha = baseDeg + delta;

        if (Math.abs(nextAlpha - alpha) < 1e-10) {
            return normalizeDeg(nextAlpha);
        }
        alpha = nextAlpha;
    }

    return normalizeDeg(alpha);
}

/**
 * Master Placidus House Cusp Calculator
 *
 * @param {Object} params
 * @param {Date} params.utcDate - UTC Date of birth
 * @param {number} params.lat - Geographic latitude
 * @param {number} params.lon - Geographic longitude
 * @param {string} params.ayanamshaMode - KP_NEW | KP_ORIGINAL | KP_STRAIGHT
 * @returns {Object} 12 house cusps, tropical/sidereal, ayanamsha, and house allocations
 */
export function calculateKPHouses({ utcDate, lat, lon, ayanamshaMode = KP_AYANAMSHA_MODES.KP_NEW }) {
    const astroTime = Astronomy.MakeTime(utcDate);
    const ayanamsha = getKPAyanamsha(astroTime, ayanamshaMode);

    // Greenwich Mean Sidereal Time in hours
    const gmstHours = Astronomy.SiderealTime(utcDate);
    // Local Sidereal Time / RAMC in degrees
    const ramcDeg = normalizeDeg((gmstHours * 15.0) + lon);

    // True obliquity of the ecliptic (including nutation), consistent with apparent sidereal time
    const { tobl: epsDeg, dpsi } = Astronomy.e_tilt(astroTime);
    const nutationLon = dpsi / 3600.0;
    const epsRad = epsDeg * DEG2RAD;
    const latRad = lat * DEG2RAD;
    const ramcRad = ramcDeg * DEG2RAD;

    // Check for extreme polar latitude where Placidus fails
    const isPolarLatitude = Math.abs(lat) >= (90.0 - epsDeg);
    let isFallback = false;
    let houseSystemName = "Placidus (Standard KP)";

    // 1. Midheaven (MC / Cusp 10)
    const mcTropical = raToEclipticLon(ramcDeg, epsDeg);
    const icTropical = normalizeDeg(mcTropical + 180.0);

    // 2. Ascendant (ASC / Cusp 1)
    // Eastern horizon intersection with the ecliptic
    const ascY = Math.cos(ramcRad);
    const ascX = -Math.sin(ramcRad) * Math.cos(epsRad) - Math.tan(latRad) * Math.sin(epsRad);
    let ascTropical = Math.atan2(ascY, ascX) * RAD2DEG;
    ascTropical = normalizeDeg(ascTropical);
    const descTropical = normalizeDeg(ascTropical + 180.0);

    let tropicalCusps = new Array(12);

    if (isPolarLatitude) {
        // Fallback for polar latitudes (Porphyry house system)
        isFallback = true;
        houseSystemName = "Porphyry (Extreme Latitude Fallback)";
        tropicalCusps[0] = ascTropical;
        tropicalCusps[9] = mcTropical;
        tropicalCusps[6] = descTropical;
        tropicalCusps[3] = icTropical;

        // Quadrant 1 (10 to 1)
        const arc1 = normalizeDeg(ascTropical - mcTropical);
        tropicalCusps[10] = normalizeDeg(mcTropical + arc1 / 3.0);
        tropicalCusps[11] = normalizeDeg(mcTropical + (2.0 * arc1) / 3.0);

        // Quadrant 2 (1 to 4)
        const arc2 = normalizeDeg(icTropical - ascTropical);
        tropicalCusps[1] = normalizeDeg(ascTropical + arc2 / 3.0);
        tropicalCusps[2] = normalizeDeg(ascTropical + (2.0 * arc2) / 3.0);

        // Opposites
        tropicalCusps[4] = normalizeDeg(tropicalCusps[10] + 180.0);
        tropicalCusps[5] = normalizeDeg(tropicalCusps[11] + 180.0);
        tropicalCusps[7] = normalizeDeg(tropicalCusps[1] + 180.0);
        tropicalCusps[8] = normalizeDeg(tropicalCusps[2] + 180.0);
    } else {
        // Rigorous Placidus Iterative Solution
        tropicalCusps[0] = ascTropical;   // Cusp 1
        tropicalCusps[6] = descTropical;  // Cusp 7
        tropicalCusps[9] = mcTropical;    // Cusp 10
        tropicalCusps[3] = icTropical;    // Cusp 4

        // Cusp 11: Base = RAMC + 30°, Factor = 1/3
        const ra11 = solvePlacidusRA(ramcDeg + 30.0, 1.0 / 3.0, lat, epsDeg);
        tropicalCusps[10] = raToEclipticLon(ra11, epsDeg);
        tropicalCusps[4] = normalizeDeg(tropicalCusps[10] + 180.0); // Cusp 5

        // Cusp 12: Base = RAMC + 60°, Factor = 2/3
        const ra12 = solvePlacidusRA(ramcDeg + 60.0, 2.0 / 3.0, lat, epsDeg);
        tropicalCusps[11] = raToEclipticLon(ra12, epsDeg);
        tropicalCusps[5] = normalizeDeg(tropicalCusps[11] + 180.0); // Cusp 6

        // Cusp 2: Base = RAMC + 120°, Factor = 2/3
        const ra2 = solvePlacidusRA(ramcDeg + 120.0, 2.0 / 3.0, lat, epsDeg);
        tropicalCusps[1] = raToEclipticLon(ra2, epsDeg);
        tropicalCusps[7] = normalizeDeg(tropicalCusps[1] + 180.0); // Cusp 8

        // Cusp 3: Base = RAMC + 150°, Factor = 1/3
        const ra3 = solvePlacidusRA(ramcDeg + 150.0, 1.0 / 3.0, lat, epsDeg);
        tropicalCusps[2] = raToEclipticLon(ra3, epsDeg);
        tropicalCusps[8] = normalizeDeg(tropicalCusps[2] + 180.0); // Cusp 9
    }

    // Convert each tropical cusp to KP Sidereal and resolve Sub & Sub-Sub Lords
    const cusps = tropicalCusps.map((tropDeg, index) => {
        // Sidereal zodiac is measured from the mean equinox: remove nutation in longitude
        const siderealDeg = normalizeDeg(tropDeg - nutationLon - ayanamsha);
        const resolved = resolveKPLongitude(siderealDeg);

        return {
            houseNumber: index + 1,
            tropicalLongitude: tropDeg,
            siderealLongitude: siderealDeg,
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

    return {
        ramcDeg,
        epsDeg,
        ayanamsha,
        ayanamshaMode,
        isFallback,
        houseSystemName,
        ascendant: cusps[0],
        midheaven: cusps[9],
        cusps
    };
}

/**
 * Determines which KP Placidus house a given sidereal longitude belongs to.
 * In KP, a planet is in House H if its longitude falls between Cusp H and Cusp H+1.
 *
 * @param {number} planetSiderealLon - Longitude in degrees [0, 360)
 * @param {Array<Object>} cusps - 12 cusps calculated from calculateKPHouses
 * @returns {number} House number (1 to 12)
 */
export function getKPPlanetHouse(planetSiderealLon, cusps) {
    const pLon = normalizeDeg(planetSiderealLon);

    for (let h = 0; h < 12; h++) {
        const cuspCurrent = cusps[h].siderealLongitude;
        const cuspNext = cusps[(h + 1) % 12].siderealLongitude;

        // Total forward span of house h
        const span = normalizeDeg(cuspNext - cuspCurrent);
        // Forward distance of planet from current cusp
        const offset = normalizeDeg(pLon - cuspCurrent);

        if (offset >= 0.0 && offset < span) {
            return h + 1; // 1-based house number
        }
    }

    // Fallback safeguard
    return 1;
}
