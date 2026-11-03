/**
 * Location, Geocoding and IANA Timezone Resolution Service for AstroSharma
 */
import tzlookup from 'tz-lookup';

export const POPULAR_LOCATIONS = [
    // South India - Telangana & Andhra Pradesh
    { id: 'hyd', name: 'Hyderabad', state: 'Telangana', country: 'India', countryCode: 'IN', lat: 17.3850, lon: 78.4867, timezone: 'Asia/Kolkata', tzLabel: 'IST (UTC+05:30)', telugu: 'హైదరాబాద్' },
    { id: 'vja', name: 'Vijayawada', state: 'Andhra Pradesh', country: 'India', countryCode: 'IN', lat: 16.5062, lon: 80.6480, timezone: 'Asia/Kolkata', tzLabel: 'IST (UTC+05:30)', telugu: 'విజయవాడ' },
    { id: 'viz', name: 'Visakhapatnam', state: 'Andhra Pradesh', country: 'India', countryCode: 'IN', lat: 17.6868, lon: 83.2185, timezone: 'Asia/Kolkata', tzLabel: 'IST (UTC+05:30)', telugu: 'విశాఖపట్నం' },
    { id: 'tir', name: 'Tirupati', state: 'Andhra Pradesh', country: 'India', countryCode: 'IN', lat: 13.6288, lon: 79.4192, timezone: 'Asia/Kolkata', tzLabel: 'IST (UTC+05:30)', telugu: 'తిరుపతి' },
    { id: 'gun', name: 'Guntur', state: 'Andhra Pradesh', country: 'India', countryCode: 'IN', lat: 16.3067, lon: 80.4365, timezone: 'Asia/Kolkata', tzLabel: 'IST (UTC+05:30)', telugu: 'గుంటూరు' },
    { id: 'war', name: 'Warangal', state: 'Telangana', country: 'India', countryCode: 'IN', lat: 17.9689, lon: 79.5941, timezone: 'Asia/Kolkata', tzLabel: 'IST (UTC+05:30)', telugu: 'వరంగల్' },
    { id: 'kar', name: 'Karimnagar', state: 'Telangana', country: 'India', countryCode: 'IN', lat: 18.4386, lon: 79.1288, timezone: 'Asia/Kolkata', tzLabel: 'IST (UTC+05:30)', telugu: 'కరీంనగర్' },
    { id: 'kha', name: 'Khammam', state: 'Telangana', country: 'India', countryCode: 'IN', lat: 17.2473, lon: 80.1514, timezone: 'Asia/Kolkata', tzLabel: 'IST (UTC+05:30)', telugu: 'ఖమ్మం' },
    { id: 'niz', name: 'Nizamabad', state: 'Telangana', country: 'India', countryCode: 'IN', lat: 18.6725, lon: 78.0941, timezone: 'Asia/Kolkata', tzLabel: 'IST (UTC+05:30)', telugu: 'నిజామాబాద్' },
    { id: 'raj', name: 'Rajahmundry', state: 'Andhra Pradesh', country: 'India', countryCode: 'IN', lat: 17.0005, lon: 81.8040, timezone: 'Asia/Kolkata', tzLabel: 'IST (UTC+05:30)', telugu: 'రాజమండ్రి' },
    { id: 'nel', name: 'Nellore', state: 'Andhra Pradesh', country: 'India', countryCode: 'IN', lat: 14.4426, lon: 79.9865, timezone: 'Asia/Kolkata', tzLabel: 'IST (UTC+05:30)', telugu: 'నెల్లూరు' },
    { id: 'kur', name: 'Kurnool', state: 'Andhra Pradesh', country: 'India', countryCode: 'IN', lat: 15.8281, lon: 78.0373, timezone: 'Asia/Kolkata', tzLabel: 'IST (UTC+05:30)', telugu: 'కర్నూలు' },

    // South India - Other States
    { id: 'blr', name: 'Bengaluru (Bangalore)', state: 'Karnataka', country: 'India', countryCode: 'IN', lat: 12.9716, lon: 77.5946, timezone: 'Asia/Kolkata', tzLabel: 'IST (UTC+05:30)', telugu: 'బెంగళూరు' },
    { id: 'chn', name: 'Chennai (Madras)', state: 'Tamil Nadu', country: 'India', countryCode: 'IN', lat: 13.0827, lon: 80.2707, timezone: 'Asia/Kolkata', tzLabel: 'IST (UTC+05:30)', telugu: 'చెన్నై' },
    { id: 'koc', name: 'Kochi (Cochin)', state: 'Kerala', country: 'India', countryCode: 'IN', lat: 9.9312, lon: 76.2673, timezone: 'Asia/Kolkata', tzLabel: 'IST (UTC+05:30)', telugu: 'కొచ్చి' },

    // North & West & East India
    { id: 'del', name: 'New Delhi', state: 'Delhi', country: 'India', countryCode: 'IN', lat: 28.6139, lon: 77.2090, timezone: 'Asia/Kolkata', tzLabel: 'IST (UTC+05:30)', telugu: 'న్యూఢిల్లీ' },
    { id: 'bom', name: 'Mumbai (Bombay)', state: 'Maharashtra', country: 'India', countryCode: 'IN', lat: 19.0760, lon: 72.8777, timezone: 'Asia/Kolkata', tzLabel: 'IST (UTC+05:30)', telugu: 'ముంబై' },
    { id: 'pun', name: 'Pune', state: 'Maharashtra', country: 'India', countryCode: 'IN', lat: 18.5204, lon: 73.8567, timezone: 'Asia/Kolkata', tzLabel: 'IST (UTC+05:30)', telugu: 'పుణె' },
    { id: 'ccu', name: 'Kolkata (Calcutta)', state: 'West Bengal', country: 'India', countryCode: 'IN', lat: 22.5726, lon: 88.3639, timezone: 'Asia/Kolkata', tzLabel: 'IST (UTC+05:30)', telugu: 'కోల్‌కతా' },
    { id: 'ahm', name: 'Ahmedabad', state: 'Gujarat', country: 'India', countryCode: 'IN', lat: 23.0225, lon: 72.5714, timezone: 'Asia/Kolkata', tzLabel: 'IST (UTC+05:30)', telugu: 'అహ్మదాబాద్' },
    { id: 'jai', name: 'Jaipur', state: 'Rajasthan', country: 'India', countryCode: 'IN', lat: 26.9124, lon: 75.7873, timezone: 'Asia/Kolkata', tzLabel: 'IST (UTC+05:30)', telugu: 'జైపూర్' },
    { id: 'lko', name: 'Lucknow', state: 'Uttar Pradesh', country: 'India', countryCode: 'IN', lat: 26.8467, lon: 80.9462, timezone: 'Asia/Kolkata', tzLabel: 'IST (UTC+05:30)', telugu: 'లక్నో' },
    { id: 'vns', name: 'Varanasi (Kashi)', state: 'Uttar Pradesh', country: 'India', countryCode: 'IN', lat: 25.3176, lon: 82.9739, timezone: 'Asia/Kolkata', tzLabel: 'IST (UTC+05:30)', telugu: 'వారణాసి' },
    { id: 'pat', name: 'Patna', state: 'Bihar', country: 'India', countryCode: 'IN', lat: 25.5941, lon: 85.1376, timezone: 'Asia/Kolkata', tzLabel: 'IST (UTC+05:30)', telugu: 'పాట్నా' },
    { id: 'bho', name: 'Bhopal', state: 'Madhya Pradesh', country: 'India', countryCode: 'IN', lat: 23.2599, lon: 77.4126, timezone: 'Asia/Kolkata', tzLabel: 'IST (UTC+05:30)', telugu: 'భోపాల్' },
    { id: 'chd', name: 'Chandigarh', state: 'Punjab/Haryana', country: 'India', countryCode: 'IN', lat: 30.7333, lon: 76.7794, timezone: 'Asia/Kolkata', tzLabel: 'IST (UTC+05:30)', telugu: 'చండీగఢ్' },

    // International Diaspora Hubs
    { id: 'dfw', name: 'Dallas, TX', state: 'Texas', country: 'United States', countryCode: 'US', lat: 32.7767, lon: -96.7970, timezone: 'America/Chicago', tzLabel: 'Central Time (US)', telugu: 'డల్లాస్ (USA)' },
    { id: 'sjc', name: 'San Jose, CA', state: 'California', country: 'United States', countryCode: 'US', lat: 37.3382, lon: -121.8863, timezone: 'America/Los_Angeles', tzLabel: 'Pacific Time (US)', telugu: 'శాన్ జోస్ (USA)' },
    { id: 'ewr', name: 'Edison, NJ', state: 'New Jersey', country: 'United States', countryCode: 'US', lat: 40.5187, lon: -74.4121, timezone: 'America/New_York', tzLabel: 'Eastern Time (US)', telugu: 'న్యూజెర్సీ (USA)' },
    { id: 'chi', name: 'Chicago, IL', state: 'Illinois', country: 'United States', countryCode: 'US', lat: 41.8781, lon: -87.6298, timezone: 'America/Chicago', tzLabel: 'Central Time (US)', telugu: 'చికాగో (USA)' },
    { id: 'lon', name: 'London', state: 'Greater London', country: 'United Kingdom', countryCode: 'GB', lat: 51.5074, lon: -0.1278, timezone: 'Europe/London', tzLabel: 'GMT / BST (UK)', telugu: 'లండన్ (UK)' },
    { id: 'dxb', name: 'Dubai', state: 'Dubai', country: 'United Arab Emirates', countryCode: 'AE', lat: 25.2048, lon: 55.2708, timezone: 'Asia/Dubai', tzLabel: 'GST (UTC+04:00)', telugu: 'దుబాయ్ (UAE)' },
    { id: 'sin', name: 'Singapore', state: 'Central', country: 'Singapore', countryCode: 'SG', lat: 1.3521, lon: 103.8198, timezone: 'Asia/Singapore', tzLabel: 'SGT (UTC+08:00)', telugu: 'సింగపూర్' },
    { id: 'syd', name: 'Sydney', state: 'NSW', country: 'Australia', countryCode: 'AU', lat: -33.8688, lon: 151.2093, timezone: 'Australia/Sydney', tzLabel: 'AEST / AEDT (Australia)', telugu: 'సిడ్నీ (Australia)' },
    { id: 'yyz', name: 'Toronto', state: 'Ontario', country: 'Canada', countryCode: 'CA', lat: 43.6532, lon: -79.3832, timezone: 'America/Toronto', tzLabel: 'Eastern Time (Canada)', telugu: 'టొరంటో (Canada)' }
];

/**
 * Resolve standard IANA timezone accurately from (lat, lon) offline using boundary polygons
 */
export function resolveIanaTimezone(lat, lon) {
    const numLat = Number(lat);
    const numLon = Number(lon);
    if (isNaN(numLat) || isNaN(numLon)) return 'UTC';

    try {
        const tz = tzlookup(numLat, numLon);
        if (tz) return tz;
    } catch {
        // Fallback for extreme oceanic coordinates
    }

    if (numLat >= 6 && numLat <= 38 && numLon >= 68 && numLon <= 98) {
        return 'Asia/Kolkata';
    }
    return 'UTC';
}

/**
 * Returns formatted offset for a given timezone and date (handling DST and historical rules)
 */
export function getTimezoneOffsetForDate(timezone, dateStr = null) {
    try {
        const date = dateStr ? new Date(`${dateStr}T12:00:00Z`) : new Date();
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
 * Searches locations matching user query (Synchronous curated list fallback)
 */
export function searchLocations(query) {
    if (!query || !query.trim()) return POPULAR_LOCATIONS.slice(0, 8);
    const q = query.toLowerCase().trim();
    return POPULAR_LOCATIONS.filter(item =>
        item.name.toLowerCase().includes(q) ||
        item.state.toLowerCase().includes(q) ||
        item.country.toLowerCase().includes(q) ||
        (item.telugu && item.telugu.includes(q))
    ).slice(0, 10);
}

/**
 * Searches worldwide locations via backend proxy (Open-Meteo & Photon) with local fallback
 * @param {string} query
 * @param {number} count
 * @returns {Promise<Array>}
 */
export async function searchLocationsOnline(query, count = 10) {
    if (!query || !query.trim()) return POPULAR_LOCATIONS.slice(0, 8);
    const trimmed = query.trim();

    try {
        const response = await fetch(`/api/location/search?q=${encodeURIComponent(trimmed)}&count=${count}`);
        if (response.ok) {
            const data = await response.json();
            if (data && data.success && Array.isArray(data.data) && data.data.length > 0) {
                return data.data;
            }
        }
    } catch (err) {
        console.warn("Backend location search endpoint unavailable, using offline dataset:", err.message);
    }

    // Fallback: Synchronous search on curated locations
    return searchLocations(trimmed);
}

/**
 * Reverse geocodes coordinates to address details via backend proxy with local fallback
 * @param {number} lat
 * @param {number} lon
 * @returns {Promise<Object>}
 */
export async function reverseGeocodeOnline(lat, lon) {
    const numLat = Number(lat);
    const numLon = Number(lon);

    if (isNaN(numLat) || isNaN(numLon) || numLat < -90 || numLat > 90 || numLon < -180 || numLon > 180) {
        throw new Error("Invalid coordinates for reverse geocoding.");
    }

    const localTz = resolveIanaTimezone(numLat, numLon);
    const localTzOffset = getTimezoneOffsetForDate(localTz);

    try {
        const response = await fetch(`/api/location/reverse?lat=${numLat}&lon=${numLon}`);
        if (response.ok) {
            const data = await response.json();
            if (data && data.success && data.data) {
                return data.data;
            }
        }
    } catch (err) {
        console.warn("Backend reverse geocode endpoint unavailable, using local coordinate details:", err.message);
    }

    // Fallback: Return formatted coordinate details with authoritative timezone
    return {
        lat: numLat,
        lon: numLon,
        name: `${numLat.toFixed(4)}°, ${numLon.toFixed(4)}°`,
        displayName: `${numLat >= 0 ? `${numLat.toFixed(4)}° N` : `${Math.abs(numLat).toFixed(4)}° S`}, ${numLon >= 0 ? `${numLon.toFixed(4)}° E` : `${Math.abs(numLon).toFixed(4)}° W`}`,
        city: '',
        state: '',
        country: '',
        timezone: localTz,
        tzLabel: `${localTz} (${localTzOffset})`,
        source: 'local-fallback'
    };
}

/**
 * Converts a local birth date and time into UTC Date using IANA historical rules
 * Uses native Intl.DateTimeFormat to accurately resolve Daylight Saving Time (DST) & historical offsets.
 *
 * @param {string} dateStr - 'YYYY-MM-DD'
 * @param {string} timeStr - 'HH:MM'
 * @param {string} timeZone - IANA timezone identifier (e.g. 'Asia/Kolkata', 'America/New_York')
 * @returns {Date} UTC Date object
 */
export function resolveLocalToUTC(dateStr, timeStr, timeZone = 'Asia/Kolkata') {
    const [year, month, day] = dateStr.split('-').map(Number);
    const [hours, minutes] = timeStr.split(':').map(Number);

    if (isNaN(year) || isNaN(month) || isNaN(day) || isNaN(hours) || isNaN(minutes)) {
        throw new Error("Invalid birth date or time components.");
    }

    // Step 1: Initial UTC timestamp guess
    const guessUtc = new Date(Date.UTC(year, month - 1, day, hours, minutes, 0));

    try {
        // Step 2: Format using target timezone
        const formatter = new Intl.DateTimeFormat('en-US', {
            timeZone,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
        });

        const parts = formatter.formatToParts(guessUtc);
        const partMap = {};
        for (const p of parts) partMap[p.type] = p.value;

        const tzYear = parseInt(partMap.year, 10);
        const tzMonth = parseInt(partMap.month, 10);
        const tzDay = parseInt(partMap.day, 10);
        let tzHour = parseInt(partMap.hour, 10);
        if (tzHour === 24) tzHour = 0;
        const tzMin = parseInt(partMap.minute, 10);

        // Difference between local representation and guess in milliseconds
        const asLocalInUtc = Date.UTC(tzYear, tzMonth - 1, tzDay, tzHour, tzMin, 0);
        const offsetMs = asLocalInUtc - guessUtc.getTime();

        // Exact UTC date
        return new Date(guessUtc.getTime() - offsetMs);
    } catch {
        // Fallback for custom or unrecognised timezone string
        console.warn(`Timezone '${timeZone}' not standard in Intl, assuming IST (UTC+5:30)`);
        return new Date(guessUtc.getTime() - (5.5 * 3600 * 1000));
    }
}
