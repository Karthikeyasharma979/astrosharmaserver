const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { searchLocations, reverseGeocode, resolveTimezoneForDate } = require('../services/geocodingService');

// Rate limiter for location search & reverse endpoints (100 requests per 15 minutes per IP)
const locationLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 150,
    message: {
        success: false,
        message: 'Too many location requests from this IP, please try again shortly.'
    },
    standardHeaders: true,
    legacyHeaders: false
});

router.use(locationLimiter);

/**
 * GET /api/location/search?q=...&count=10
 * Searches worldwide cities, towns, villages, and countries with autocomplete support.
 */
router.get('/search', async (req, res) => {
    try {
        const query = req.query.q;
        const count = Math.min(Math.max(parseInt(req.query.count, 10) || 10, 1), 25);

        if (!query || typeof query !== 'string' || !query.trim()) {
            return res.json({
                success: true,
                count: 0,
                data: [],
                attribution: 'Geocoding data © Open-Meteo & OpenStreetMap contributors'
            });
        }

        const results = await searchLocations(query, count);

        res.json({
            success: true,
            count: results.length,
            data: results,
            attribution: 'Geocoding data © Open-Meteo & OpenStreetMap contributors'
        });
    } catch (error) {
        console.error('Location search error:', error.message);
        res.status(500).json({
            success: false,
            message: 'An error occurred while searching locations.',
            error: error.message
        });
    }
});

/**
 * GET /api/location/reverse?lat=...&lon=...
 * Reverse geocodes coordinates to a readable address and authoritative IANA timezone.
 */
router.get('/reverse', async (req, res) => {
    try {
        const lat = parseFloat(req.query.lat);
        const lon = parseFloat(req.query.lon);

        if (isNaN(lat) || isNaN(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
            return res.status(400).json({
                success: false,
                message: 'Valid latitude (-90 to +90) and longitude (-180 to +180) are required.'
            });
        }

        const data = await reverseGeocode(lat, lon);

        res.json({
            success: true,
            data,
            attribution: 'Reverse geocoding © OpenStreetMap contributors via Photon (Komoot)'
        });
    } catch (error) {
        console.error('Reverse geocoding error:', error.message);
        res.status(500).json({
            success: false,
            message: 'An error occurred while reverse geocoding the coordinates.',
            error: error.message
        });
    }
});

/**
 * GET /api/location/timezone?lat=...&lon=...&date=YYYY-MM-DD
 * Resolves authoritative IANA timezone and historical offset for a specific date.
 */
router.get('/timezone', (req, res) => {
    try {
        const lat = parseFloat(req.query.lat);
        const lon = parseFloat(req.query.lon);
        const dateStr = req.query.date || null;

        if (isNaN(lat) || isNaN(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
            return res.status(400).json({
                success: false,
                message: 'Valid latitude (-90 to +90) and longitude (-180 to +180) are required.'
            });
        }

        const data = resolveTimezoneForDate(lat, lon, dateStr);

        res.json({
            success: true,
            data
        });
    } catch (error) {
        console.error('Timezone resolution error:', error.message);
        res.status(500).json({
            success: false,
            message: 'An error occurred while resolving the timezone.',
            error: error.message
        });
    }
});

module.exports = router;
