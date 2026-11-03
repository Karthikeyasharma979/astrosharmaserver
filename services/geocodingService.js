/**
 * Geocoding, Reverse Geocoding, and IANA Timezone Resolution Service
 * Backend proxy for AstroSharma with in-memory caching and rate-limit compliance.
 *
 * Upstream Providers Used:
 * 1. Open-Meteo Geocoding API (Permits search/autocomplete; ODbL/CC-BY 4.0 license; 10,000 req/day free)
 * 2. Photon by Komoot (Built on OpenStreetMap data specifically for autocomplete & reverse geocoding; ODbL license)
 * 3. tz-lookup (Fast, offline coordinate-to-IANA-timezone boundary polygon dataset; CC0-1.0 license)
 */

const axios = require('axios');
const path = require('path');
const tzlookup = require('tz-lookup');

// User-Agent identifying AstroSharma to comply with upstream provider policies
const USER_AGENT = 'AstroSharma/1.0 (+https://astrosharma.com; contact@astrosharma.com)';

// In-Memory Cache with TTL (24 Hours)
class SimpleCache {
    constructor(ttlMs = 24 * 60 * 60 * 1000, maxEntries = 500) {
        this.ttlMs = ttlMs;
        this.maxEntries = maxEntries;
        this.store = new Map();
    }

    get(key) {
        const item = this.store.get(key);
        if (!item) return null;
        if (Date.now() > item.expiresAt) {
            this.store.delete(key);
            return null;
        }
        return item.value;
    }

    set(key, value) {
        if (this.store.size >= this.maxEntries) {
            // Remove the oldest entry
            const oldestKey = this.store.keys().next().value;
            this.store.delete(oldestKey);
        }
        this.store.set(key, {
            value,
            expiresAt: Date.now() + this.ttlMs
        });
    }

    clear() {
        this.store.clear();
    }
}

const searchCache = new SimpleCache(24 * 60 * 60 * 1000, 500);
const reverseCache = new SimpleCache(24 * 60 * 60 * 1000, 500);

// Load curated popular locations with Telugu metadata for instant response
const POPULAR_LOCATIONS = [
    { id: 'hyd', name: 'Hyderabad', state: 'Telangana', country: 'India', countryCode: 'IN', lat: 17.3850, lon: 78.4867, timezone: 'Asia/Kolkata', tzLabel: 'IST (UTC+05:30)', telugu: 'హైదరాబాద్' },
    { id: 'vja', name: 'Vijayawada', state: 'Andhra Pradesh', country: 'India', countryCode: 'IN', lat: 16.5062, lon: 80.6480, timezone: 'Asia/Kolkata', tzLabel: 'IST (UTC+05:30)', telugu: 'విజయవాడ' },
    { id: 'viz', name: 'Visakhapatnam', state: 'Andhra Pradesh', country: 'India', countryCode: 'IN', lat: 17.6868, lon: 83.2185, timezone: 'Asia/Kolkata', tzLabel: 'IST (UTC+05:30)', telugu: 'విశాఖపట్నం' },
    { id: 'tir', name: 'Tirupati', state: 'Andhra Pradesh', country: 'India', countryCode: 'IN', lat: 13.6288, lon: 79.4192, timezone: 'Asia/Kolkata', tzLabel: 'IST (UTC+05:30)', telugu: 'తిరుపతి' },
    { id: 'gun', name: 'Guntur', state: 'Andhra Pradesh', country: 'India', countryCode: 'IN', lat: 16.3067, lon: 80.4365, timezone: 'Asia/Kolkata', tzLabel: 'IST (UTC+05:30)', telugu: 'గుంటూరు' },
    { id: 'blr', name: 'Bengaluru', state: 'Karnataka', country: 'India', countryCode: 'IN', lat: 12.9716, lon: 77.5946, timezone: 'Asia/Kolkata', tzLabel: 'IST (UTC+05:30)', telugu: 'బెంగళూరు' },
    { id: 'chn', name: 'Chennai', state: 'Tamil Nadu', country: 'India', countryCode: 'IN', lat: 13.0827, lon: 80.2707, timezone: 'Asia/Kolkata', tzLabel: 'IST (UTC+05:30)', telugu: 'చెన్నై' },
    { id: 'koc', name: 'Kochi', state: 'Kerala', country: 'India', countryCode: 'IN', lat: 9.9312, lon: 76.2673, timezone: 'Asia/Kolkata', tzLabel: 'IST (UTC+05:30)', telugu: 'కొచ్చి' },
    { id: 'del', name: 'New Delhi', state: 'Delhi', country: 'India', countryCode: 'IN', lat: 28.6139, lon: 77.2090, timezone: 'Asia/Kolkata', tzLabel: 'IST (UTC+05:30)', telugu: 'న్యూఢిల్లీ' },
    { id: 'bom', name: 'Mumbai', state: 'Maharashtra', country: 'India', countryCode: 'IN', lat: 19.0760, lon: 72.8777, timezone: 'Asia/Kolkata', tzLabel: 'IST (UTC+05:30)', telugu: 'ముంబై' },
    { id: 'pun', name: 'Pune', state: 'Maharashtra', country: 'India', countryCode: 'IN', lat: 18.5204, lon: 73.8567, timezone: 'Asia/Kolkata', tzLabel: 'IST (UTC+05:30)', telugu: 'పుణె' },
    { id: 'ccu', name: 'Kolkata', state: 'West Bengal', country: 'India', countryCode: 'IN', lat: 22.5726, lon: 88.3639, timezone: 'Asia/Kolkata', tzLabel: 'IST (UTC+05:30)', telugu: 'కోల్‌కతా' },
    { id: 'ahm', name: 'Ahmedabad', state: 'Gujarat', country: 'India', countryCode: 'IN', lat: 23.0225, lon: 72.5714, timezone: 'Asia/Kolkata', tzLabel: 'IST (UTC+05:30)', telugu: 'అహ్మదాబాద్' },
    { id: 'jai', name: 'Jaipur', state: 'Rajasthan', country: 'India', countryCode: 'IN', lat: 26.9124, lon: 75.7873, timezone: 'Asia/Kolkata', tzLabel: 'IST (UTC+05:30)', telugu: 'జైపూర్' },
    { id: 'lko', name: 'Lucknow', state: 'Uttar Pradesh', country: 'India', countryCode: 'IN', lat: 26.8467, lon: 80.9462, timezone: 'Asia/Kolkata', tzLabel: 'IST (UTC+05:30)', telugu: 'లక్నో' },
    { id: 'vns', name: 'Varanasi', state: 'Uttar Pradesh', country: 'India', countryCode: 'IN', lat: 25.3176, lon: 82.9739, timezone: 'Asia/Kolkata', tzLabel: 'IST (UTC+05:30)', telugu: 'వారణాసి' },
    { id: 'war', name: 'Warangal', state: 'Telangana', country: 'India', countryCode: 'IN', lat: 17.9689, lon: 79.5941, timezone: 'Asia/Kolkata', tzLabel: 'IST (UTC+05:30)', telugu: 'వరంగల్' },
    { id: 'kar', name: 'Karimnagar', state: 'Telangana', country: 'India', countryCode: 'IN', lat: 18.4386, lon: 79.1288, timezone: 'Asia/Kolkata', tzLabel: 'IST (UTC+05:30)', telugu: 'కరీంనగర్' },
    { id: 'kha', name: 'Khammam', state: 'Telangana', country: 'India', countryCode: 'IN', lat: 17.2473, lon: 80.1514, timezone: 'Asia/Kolkata', tzLabel: 'IST (UTC+05:30)', telugu: 'ఖమ్మం' },
    { id: 'niz', name: 'Nizamabad', state: 'Telangana', country: 'India', countryCode: 'IN', lat: 18.6725, lon: 78.0941, timezone: 'Asia/Kolkata', tzLabel: 'IST (UTC+05:30)', telugu: 'నిజామాబాద్' },
    { id: 'raj', name: 'Rajahmundry', state: 'Andhra Pradesh', country: 'India', countryCode: 'IN', lat: 17.0005, lon: 81.8040, timezone: 'Asia/Kolkata', tzLabel: 'IST (UTC+05:30)', telugu: 'రాజమండ్రి' },
    { id: 'nel', name: 'Nellore', state: 'Andhra Pradesh', country: 'India', countryCode: 'IN', lat: 14.4426, lon: 79.9865, timezone: 'Asia/Kolkata', tzLabel: 'IST (UTC+05:30)', telugu: 'నెల్లూరు' },
    { id: 'kur', name: 'Kurnool', state: 'Andhra Pradesh', country: 'India', countryCode: 'IN', lat: 15.8281, lon: 78.0373, timezone: 'Asia/Kolkata', tzLabel: 'IST (UTC+05:30)', telugu: 'కర్నూలు' },
    { id: 'dfw', name: 'Dallas', state: 'Texas', country: 'United States', countryCode: 'US', lat: 32.7767, lon: -96.7970, timezone: 'America/Chicago', tzLabel: 'Central Time (US)', telugu: 'డల్లాస్ (USA)' },
    { id: 'sjc', name: 'San Jose', state: 'California', country: 'United States', countryCode: 'US', lat: 37.3382, lon: -121.8863, timezone: 'America/Los_Angeles', tzLabel: 'Pacific Time (US)', telugu: 'శాన్ జోస్ (USA)' },
    { id: 'ewr', name: 'Edison', state: 'New Jersey', country: 'United States', countryCode: 'US', lat: 40.5187, lon: -74.4121, timezone: 'America/New_York', tzLabel: 'Eastern Time (US)', telugu: 'ఎడిసన్, న్యూజెర్సీ (USA)' },
    { id: 'chi', name: 'Chicago', state: 'Illinois', country: 'United States', countryCode: 'US', lat: 41.8781, lon: -87.6298, timezone: 'America/Chicago', tzLabel: 'Central Time (US)', telugu: 'చికాగో (USA)' },
    { id: 'lon', name: 'London', state: 'Greater London', country: 'United Kingdom', countryCode: 'GB', lat: 51.5074, lon: -0.1278, timezone: 'Europe/London', tzLabel: 'GMT / BST (UK)', telugu: 'లండన్ (UK)' },
    { id: 'dxb', name: 'Dubai', state: 'Dubai', country: 'United Arab Emirates', countryCode: 'AE', lat: 25.2048, lon: 55.2708, timezone: 'Asia/Dubai', tzLabel: 'GST (UTC+04:00)', telugu: 'దుబాయ్ (UAE)' },
    { id: 'sin', name: 'Singapore', state: 'Central', country: 'Singapore', countryCode: 'SG', lat: 1.3521, lon: 103.8198, timezone: 'Asia/Singapore', tzLabel: 'SGT (UTC+08:00)', telugu: 'సింగపూర్' },
    { id: 'syd', name: 'Sydney', state: 'NSW', country: 'Australia', countryCode: 'AU', lat: -33.8688, lon: 151.2093, timezone: 'Australia/Sydney', tzLabel: 'AEST / AEDT (Australia)', telugu: 'సిడ్నీ (Australia)' },
    { id: 'yyz', name: 'Toronto', state: 'Ontario', country: 'Canada', countryCode: 'CA', lat: 43.6532, lon: -79.3832, timezone: 'America/Toronto', tzLabel: 'Eastern Time (Canada)', telugu: 'టొరంటో (Canada)' }
];

/**
 * Format standard UTC offset label for any IANA timezone (e.g. "UTC+05:30")
 */
function getTzOffsetLabel(timezone, date = new Date()) {
    try {
        const formatter = new Intl.DateTimeFormat('en-US', {
            timeZone: timezone,
            timeZoneName: 'shortOffset'
        });
        const parts = formatter.formatToParts(date);
        const tzPart = parts.find(p => p.type === 'timeZoneName');
        return tzPart ? tzPart.value : 'UTC';
    } catch {
        return 'UTC';
    }
}

/**
 * Resolve IANA timezone accurately from (lat, lon)
 */
function resolveIanaTimezone(lat, lon) {
    try {
        const tz = tzlookup(lat, lon);
        if (tz) return tz;
    } catch (err) {
        // Fallback boundary or water coordinate approximation
    }
    // Longitude-based fallback if coordinate is in international waters
    const offsetHours = Math.round(lon / 15);
    if (offsetHours >= 5 && offsetHours <= 6 && lat >= 6 && lat <= 38 && lon >= 68 && lon <= 98) {
        return 'Asia/Kolkata';
    }
    return 'UTC';
}

/**
 * Search locations worldwide (Cities, Towns, Villages, Countries)
 * Primary: Open-Meteo Geocoding API (allows autocomplete/search; 10,000 req/day free)
 * Fallback: Photon by Komoot (OSM search-as-you-type)
 */
async function searchLocations(query, count = 10) {
    if (!query || typeof query !== 'string') return [];
    const trimmed = query.trim();
    if (!trimmed) return [];

    const cacheKey = `search_${trimmed.toLowerCase()}_${count}`;
    const cached = searchCache.get(cacheKey);
    if (cached) return cached;

    // 1. Check local curated list first for instant prefix matches
    const lower = trimmed.toLowerCase();
    const localMatches = POPULAR_LOCATIONS.filter(item =>
        item.name.toLowerCase().startsWith(lower) ||
        (item.telugu && item.telugu.includes(lower)) ||
        item.state.toLowerCase().startsWith(lower)
    ).map(item => ({
        ...item,
        displayName: `${item.name}, ${item.state}, ${item.country}`,
        source: 'local'
    }));

    // If query has fewer than 2 characters, return local matches only
    if (trimmed.length < 2) {
        return localMatches.slice(0, count);
    }

    let remoteResults = [];
    let providerSource = 'open-meteo';

    // 2. Query Open-Meteo Geocoding API
    try {
        const openMeteoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(trimmed)}&count=${count}&language=en&format=json`;
        const res = await axios.get(openMeteoUrl, {
            headers: { 'User-Agent': USER_AGENT },
            timeout: 5000
        });

        if (res.data && Array.isArray(res.data.results)) {
            remoteResults = res.data.results.map((r, idx) => {
                const lat = Number(r.latitude);
                const lon = Number(r.longitude);
                // Verify or resolve authoritative timezone
                const timezone = r.timezone || resolveIanaTimezone(lat, lon);
                const tzLabel = getTzOffsetLabel(timezone);

                // Build clean administrative display name
                const parts = [r.name];
                if (r.admin1 && r.admin1 !== r.name) parts.push(r.admin1);
                if (r.country && r.country !== r.admin1) parts.push(r.country);

                // Check for Telugu equivalent in curated dictionary
                const matchedCurated = POPULAR_LOCATIONS.find(p =>
                    p.name.toLowerCase() === r.name.toLowerCase() &&
                    (!p.countryCode || p.countryCode === r.country_code)
                );

                return {
                    id: `om_${r.id || idx}`,
                    name: r.name,
                    displayName: parts.join(', '),
                    state: r.admin1 || '',
                    country: r.country || '',
                    countryCode: r.country_code || '',
                    lat,
                    lon,
                    timezone,
                    tzLabel: `${timezone.split('/').pop().replace(/_/g, ' ')} (${tzLabel})`,
                    telugu: matchedCurated?.telugu || null,
                    population: r.population || 0,
                    source: 'open-meteo'
                };
            });
        }
    } catch (omErr) {
        console.warn(`Open-Meteo Geocoding failed for "${trimmed}", attempting Photon fallback:`, omErr.message);
        providerSource = 'photon';

        // 3. Fallback: Photon Komoot API
        try {
            const photonUrl = `https://photon.komoot.io/api/?q=${encodeURIComponent(trimmed)}&limit=${count}`;
            const res = await axios.get(photonUrl, {
                headers: { 'User-Agent': USER_AGENT },
                timeout: 5000
            });

            if (res.data && Array.isArray(res.data.features)) {
                remoteResults = res.data.features.map((f, idx) => {
                    const props = f.properties || {};
                    const [lon, lat] = f.geometry?.coordinates || [0, 0];
                    const timezone = resolveIanaTimezone(lat, lon);
                    const tzLabel = getTzOffsetLabel(timezone);

                    const name = props.name || props.city || props.town || trimmed;
                    const parts = [name];
                    if (props.state && props.state !== name) parts.push(props.state);
                    if (props.country && props.country !== props.state) parts.push(props.country);

                    const matchedCurated = POPULAR_LOCATIONS.find(p =>
                        p.name.toLowerCase() === name.toLowerCase()
                    );

                    return {
                        id: `ph_${props.osm_id || idx}`,
                        name,
                        displayName: parts.join(', '),
                        state: props.state || '',
                        country: props.country || '',
                        countryCode: (props.countrycode || '').toUpperCase(),
                        lat: Number(lat),
                        lon: Number(lon),
                        timezone,
                        tzLabel: `${timezone.split('/').pop().replace(/_/g, ' ')} (${tzLabel})`,
                        telugu: matchedCurated?.telugu || null,
                        source: 'photon'
                    };
                });
            }
        } catch (photonErr) {
            console.warn(`Photon fallback failed for "${trimmed}":`, photonErr.message);
        }
    }

    // Deduplicate and merge: local curated matches first, followed by remote results
    const combined = [];
    const seenCoordinates = new Set();

    for (const loc of [...localMatches, ...remoteResults]) {
        const coordKey = `${loc.lat.toFixed(3)},${loc.lon.toFixed(3)}`;
        if (!seenCoordinates.has(coordKey)) {
            seenCoordinates.add(coordKey);
            combined.push(loc);
        }
        if (combined.length >= count) break;
    }

    searchCache.set(cacheKey, combined);
    return combined;
}

/**
 * Reverse Geocode coordinates to place details (used when marker moves on map)
 * Uses Photon by Komoot (OSM reverse) with tz-lookup
 */
async function reverseGeocode(lat, lon) {
    const numLat = Number(lat);
    const numLon = Number(lon);

    if (isNaN(numLat) || isNaN(numLon) || numLat < -90 || numLat > 90 || numLon < -180 || numLon > 180) {
        throw new Error("Invalid latitude or longitude coordinates.");
    }

    const cacheKey = `reverse_${numLat.toFixed(4)}_${numLon.toFixed(4)}`;
    const cached = reverseCache.get(cacheKey);
    if (cached) return cached;

    // Resolve authoritative timezone locally
    const timezone = resolveIanaTimezone(numLat, numLon);
    const tzLabel = getTzOffsetLabel(timezone);

    let result = {
        lat: numLat,
        lon: numLon,
        name: `${numLat.toFixed(4)}°, ${numLon.toFixed(4)}°`,
        displayName: `${numLat.toFixed(4)}° N, ${numLon.toFixed(4)}° E`,
        city: '',
        state: '',
        country: '',
        countryCode: '',
        timezone,
        tzLabel: `${timezone.split('/').pop().replace(/_/g, ' ')} (${tzLabel})`,
        source: 'coordinates'
    };

    try {
        const photonUrl = `https://photon.komoot.io/reverse?lat=${numLat}&lon=${numLon}`;
        const res = await axios.get(photonUrl, {
            headers: { 'User-Agent': USER_AGENT },
            timeout: 5000
        });

        if (res.data && Array.isArray(res.data.features) && res.data.features.length > 0) {
            const props = res.data.features[0].properties || {};
            const name = props.name || props.locality || props.city || props.town || props.village || props.county || 'Pinned Location';

            const parts = [name];
            if (props.city && props.city !== name) parts.push(props.city);
            else if (props.county && props.county !== name) parts.push(props.county);
            if (props.state) parts.push(props.state);
            if (props.country) parts.push(props.country);

            result = {
                lat: numLat,
                lon: numLon,
                name,
                displayName: parts.join(', '),
                city: props.city || props.town || props.village || '',
                state: props.state || '',
                country: props.country || '',
                countryCode: (props.countrycode || '').toUpperCase(),
                timezone,
                tzLabel: `${timezone.split('/').pop().replace(/_/g, ' ')} (${tzLabel})`,
                source: 'photon'
            };
        }
    } catch (err) {
        console.warn(`Reverse geocode failed for (${numLat}, ${numLon}):`, err.message);
    }

    reverseCache.set(cacheKey, result);
    return result;
}

/**
 * Resolve exact historical timezone offset for a specific birth date & coordinates
 */
function resolveTimezoneForDate(lat, lon, dateStr = null) {
    const numLat = Number(lat);
    const numLon = Number(lon);

    if (isNaN(numLat) || isNaN(numLon) || numLat < -90 || numLat > 90 || numLon < -180 || numLon > 180) {
        throw new Error("Invalid geographic coordinates.");
    }

    const timezone = resolveIanaTimezone(numLat, numLon);
    const targetDate = dateStr ? new Date(`${dateStr}T12:00:00Z`) : new Date();

    const tzLabel = getTzOffsetLabel(timezone, targetDate);

    return {
        lat: numLat,
        lon: numLon,
        timezone,
        tzLabel: `${timezone} (${tzLabel})`,
        date: dateStr || targetDate.toISOString().split('T')[0]
    };
}

module.exports = {
    searchLocations,
    reverseGeocode,
    resolveTimezoneForDate,
    resolveIanaTimezone,
    POPULAR_LOCATIONS
};
