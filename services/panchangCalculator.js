const Astronomy = require('astronomy-engine');

const CITIES = {
    hyderabad: { name: 'హైదరాబాద్ (Hyderabad)', lat: 17.3850, lon: 78.4867, tz: 5.5 },
    vijayawada: { name: 'విజయవాడ (Vijayawada)', lat: 16.5062, lon: 80.6480, tz: 5.5 },
    visakhapatnam: { name: 'విశాఖపట్నం (Vizag)', lat: 17.6868, lon: 83.2185, tz: 5.5 },
    tirupati: { name: 'తిరుపతి (Tirupati)', lat: 13.6288, lon: 79.4192, tz: 5.5 },
    guntur: { name: 'గుంటూరు (Guntur)', lat: 16.3067, lon: 80.4365, tz: 5.5 },
    bengaluru: { name: 'బెంగళూరు (Bengaluru)', lat: 12.9716, lon: 77.5946, tz: 5.5 },
    chennai: { name: 'చెన్నై (Chennai)', lat: 13.0827, lon: 80.2707, tz: 5.5 },
    mumbai: { name: 'ముంబై (Mumbai)', lat: 19.0760, lon: 72.8777, tz: 5.5 },
    delhi: { name: 'న్యూఢిల్లీ (New Delhi)', lat: 28.6139, lon: 77.2090, tz: 5.5 },
    dallas: { name: 'Dallas, TX (USA)', lat: 32.7767, lon: -96.7970, tz: -5.0 },
    newjersey: { name: 'New Jersey (USA)', lat: 40.0583, lon: -74.4057, tz: -4.0 },
    sanjose: { name: 'San Jose, CA (USA)', lat: 37.3382, lon: -121.8863, tz: -7.0 },
    london: { name: 'London (UK)', lat: 51.5074, lon: -0.1278, tz: 1.0 },
    sydney: { name: 'Sydney (Australia)', lat: -33.8688, lon: 151.2093, tz: 10.0 }
};

const TITHI_NAMES = [
    "Padyami", "Vidiya", "Thadiya", "Chavithi", "Panchami",
    "Shashthi", "Sapthami", "Ashtami", "Navami", "Dasami",
    "Ekadasi", "Dwadasi", "Trayodasi", "Chaturdasi", "Pournami"
];

const NAKSHATRA_NAMES = [
    "Ashwini", "Bharani", "Krittika", "Rohini", "Mrigashira", "Arudra",
    "Punarvasu", "Pushyami", "Ashlesha", "Makha", "Pubba", "Uttara",
    "Hasta", "Chitta", "Swati", "Vishakha", "Anuradha", "Jyeshta",
    "Mula", "Purvaashada", "Uttaraashada", "Shravanam", "Dhanishta",
    "Satabhisha", "Purvabhadra", "Uttarabhadra", "Revathi"
];

const YOGA_NAMES = [
    "Vishkambha", "Priti", "Ayushman", "Saubhagya", "Shobhana", "Atiganda",
    "Sukarma", "Dhriti", "Shula", "Ganda", "Vriddhi", "Dhruva", "Vyaghata",
    "Harshana", "Vajra", "Siddhi", "Vyatipata", "Variyan", "Parigha",
    "Shiva", "Siddha", "Sadhya", "Shubha", "Shukla", "Brahma", "Indra", "Vaidhriti"
];

const KARANA_NAMES = [
    "Bava", "Balava", "Kaulava", "Taitila", "Garija", "Vanija", "Vishti"
];

const RASI_NAMES = [
    "Mesham", "Vrishabham", "Mithunam", "Karkatakam",
    "Simham", "Kanya", "Tula", "Vrischika",
    "Dhanussu", "Makaram", "Kumbham", "Meenam"
];

function formatLocalTime(d, tzOffset) {
    if (!d) return "--:--";
    const localMs = d.getTime() + tzOffset * 3600 * 1000;
    const localD = new Date(localMs);
    const hours = localD.getUTCHours();
    const mins = localD.getUTCMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const h12 = hours % 12 || 12;
    return `${String(h12).padStart(2, '0')}:${String(mins).padStart(2, '0')} ${ampm}`;
}

function findTithiEnd(calcTime, currentTithiIndex) {
    for (let h = 0.5; h <= 30; h += 0.5) {
        const testT = new Date(calcTime.getTime() + h * 3600 * 1000);
        const sP = Astronomy.SunPosition(testT);
        const mP = Astronomy.Ecliptic(Astronomy.GeoVector(Astronomy.Body.Moon, testT, true));
        const d = (mP.elon - sP.elon + 360) % 360;
        if (Math.floor(d / 12) !== currentTithiIndex) {
            let low = (h - 0.5) * 3600 * 1000;
            let high = h * 3600 * 1000;
            while (high - low > 60000) {
                const mid = (low + high) / 2;
                const midT = new Date(calcTime.getTime() + mid);
                const sM = Astronomy.SunPosition(midT);
                const mM = Astronomy.Ecliptic(Astronomy.GeoVector(Astronomy.Body.Moon, midT, true));
                const dM = (mM.elon - sM.elon + 360) % 360;
                if (Math.floor(dM / 12) === currentTithiIndex) low = mid;
                else high = mid;
            }
            return new Date(calcTime.getTime() + high);
        }
    }
    return null;
}

function findNakshatraEnd(calcTime, currentNakshatraIndex) {
    const span = 360 / 27;
    for (let h = 0.5; h <= 30; h += 0.5) {
        const testT = new Date(calcTime.getTime() + h * 3600 * 1000);
        const jd = Astronomy.MakeTime(testT).tt;
        const t = jd / 36525.0;
        const ayan = 23.853056 + 1.396971 * t;
        const mP = Astronomy.Ecliptic(Astronomy.GeoVector(Astronomy.Body.Moon, testT, true));
        const sidereal = (mP.elon - ayan + 360) % 360;
        if (Math.floor(sidereal / span) !== currentNakshatraIndex) {
            let low = (h - 0.5) * 3600 * 1000;
            let high = h * 3600 * 1000;
            while (high - low > 60000) {
                const mid = (low + high) / 2;
                const midT = new Date(calcTime.getTime() + mid);
                const jdM = Astronomy.MakeTime(midT).tt;
                const tM = jdM / 36525.0;
                const ayanM = 23.853056 + 1.396971 * tM;
                const mM = Astronomy.Ecliptic(Astronomy.GeoVector(Astronomy.Body.Moon, midT, true));
                const sidM = (mM.elon - ayanM + 360) % 360;
                if (Math.floor(sidM / span) === currentNakshatraIndex) low = mid;
                else high = mid;
            }
            return new Date(calcTime.getTime() + high);
        }
    }
    return null;
}

function calculatePanchang(dateInput, lat = 17.3850, lon = 78.4867, tzOffset = 5.5) {
    const parsed = new Date(dateInput);
    const year = parsed.getFullYear();
    const month = parsed.getMonth();
    const day = parsed.getDate();

    const observer = new Astronomy.Observer(lat, lon, 100);

    // Search Sunrise & Sunset for the given local date
    const dayStartUtc = new Date(Date.UTC(year, month, day, 0 - tzOffset, 0, 0));
    const sunriseObj = Astronomy.SearchRiseSet(Astronomy.Body.Sun, observer, +1, dayStartUtc, 1);
    const sunriseTime = sunriseObj ? sunriseObj.date : new Date(Date.UTC(year, month, day, 6 - tzOffset, 0, 0));

    const sunsetObj = Astronomy.SearchRiseSet(Astronomy.Body.Sun, observer, -1, sunriseTime, 1);
    const sunsetTime = sunsetObj ? sunsetObj.date : new Date(Date.UTC(year, month, day, 18 - tzOffset, 0, 0));

    // Moonrise and Moonset
    const moonriseObj = Astronomy.SearchRiseSet(Astronomy.Body.Moon, observer, +1, dayStartUtc, 1);
    const moonsetObj = Astronomy.SearchRiseSet(Astronomy.Body.Moon, observer, -1, dayStartUtc, 1);

    // Calculate astrological parameters at Sunrise (traditional Vedic standard)
    const calcTime = sunriseTime;

    const sunPos = Astronomy.SunPosition(calcTime);
    const moonGeo = Astronomy.GeoVector(Astronomy.Body.Moon, calcTime, true);
    const moonPos = Astronomy.Ecliptic(moonGeo);

    // Lahiri Ayanamsha (time.tt is days from J2000.0, so centuries t = tt / 36525.0)
    const jd = Astronomy.MakeTime(calcTime).tt;
    const t = jd / 36525.0;
    const lahiriAyanamsha = 23.853056 + 1.396971 * t + 0.000309 * t * t;

    const siderealSun = (sunPos.elon - lahiriAyanamsha + 360) % 360;
    const siderealMoon = (moonPos.elon - lahiriAyanamsha + 360) % 360;

    // 1. Tithi
    const moonSunDiff = (moonPos.elon - sunPos.elon + 360) % 360;
    const tithiSlot = Math.floor(moonSunDiff / 12); // 0 to 29
    const isSukla = tithiSlot < 15;
    const paksha = isSukla ? "Sukla" : "Bahula";
    const tithiNameInPaksha = tithiSlot === 14 ? "Pournami" : (tithiSlot === 29 ? "Amavasya" : TITHI_NAMES[tithiSlot % 15]);

    const tithiEndTime = findTithiEnd(calcTime, tithiSlot);
    const nextTithiSlot = (tithiSlot + 1) % 30;
    const nextPaksha = nextTithiSlot < 15 ? "Sukla" : "Bahula";
    const nextTithiName = nextTithiSlot === 14 ? "Pournami" : (nextTithiSlot === 29 ? "Amavasya" : TITHI_NAMES[nextTithiSlot % 15]);

    // 2. Nakshatra
    const nakshatraIndex = Math.floor(siderealMoon / (360 / 27));
    const nakshatraName = NAKSHATRA_NAMES[nakshatraIndex];
    const nakshatraEndTime = findNakshatraEnd(calcTime, nakshatraIndex);
    const nextNakshatraName = NAKSHATRA_NAMES[(nakshatraIndex + 1) % 27];

    // 3. Yoga
    const yogaIndex = Math.floor(((siderealSun + siderealMoon) % 360) / (360 / 27));
    const yogaName = YOGA_NAMES[yogaIndex];

    // 4. Karana
    const karanaSlot = Math.floor(moonSunDiff / 6);
    let karanaName = "";
    if (karanaSlot === 0) karanaName = "Kimstughna";
    else if (karanaSlot === 57) karanaName = "Shakuni";
    else if (karanaSlot === 58) karanaName = "Chatushpada";
    else if (karanaSlot === 59) karanaName = "Naga";
    else karanaName = KARANA_NAMES[(karanaSlot - 1) % 7];

    // 5. Moon Sign
    const moonSign = RASI_NAMES[Math.floor(siderealMoon / 30)];

    // 6. Muhurtham slots
    const dayDurationMs = sunsetTime.getTime() - sunriseTime.getTime();
    const slotDurationMs = dayDurationMs / 8;
    const localDayOfWeek = new Date(sunriseTime.getTime() + tzOffset * 3600 * 1000).getUTCDay();

    const rahuSlots = [8, 2, 7, 5, 6, 4, 3];
    const yamaSlots = [5, 4, 3, 2, 1, 7, 6];
    const gulikaSlots = [7, 6, 5, 4, 3, 2, 1];

    const getSlotRange = (slotIndex1) => {
        const startMs = sunriseTime.getTime() + (slotIndex1 - 1) * slotDurationMs;
        const endMs = startMs + slotDurationMs;
        return `${formatLocalTime(new Date(startMs), tzOffset)} - ${formatLocalTime(new Date(endMs), tzOffset)}`;
    };

    // Durmuhurta slots (standard daytime calculation)
    const durmuhurtaSlotsByDay = {
        0: [14],
        1: [8, 12],
        2: [2, 7],
        3: [5],
        4: [6, 11],
        5: [4, 9],
        6: [1]
    };
    const muhurtha15Ms = dayDurationMs / 15;
    const dayDurSlots = durmuhurtaSlotsByDay[localDayOfWeek] || [8];
    const durmuhurtaStr = dayDurSlots.map(s => {
        const sMs = sunriseTime.getTime() + (s - 1) * muhurtha15Ms;
        const eMs = sMs + muhurtha15Ms;
        return `${formatLocalTime(new Date(sMs), tzOffset)} - ${formatLocalTime(new Date(eMs), tzOffset)}`;
    }).join(', ');

    return {
        date: `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
        tithi: `${paksha} ${tithiNameInPaksha}`,
        tithi_till: tithiEndTime ? formatLocalTime(tithiEndTime, tzOffset) : null,
        next_tithi: `${nextPaksha} ${nextTithiName}`,
        nakshatra: nakshatraName,
        nakshatra_till: nakshatraEndTime ? formatLocalTime(nakshatraEndTime, tzOffset) : null,
        next_nakshatra: nextNakshatraName,
        yoga: yogaName,
        karana: karanaName,
        moon_sign: moonSign,
        sunrise: formatLocalTime(sunriseTime, tzOffset),
        sunset: formatLocalTime(sunsetTime, tzOffset),
        moonrise: moonriseObj ? formatLocalTime(moonriseObj.date, tzOffset) : "06:00 PM",
        moonset: moonsetObj ? formatLocalTime(moonsetObj.date, tzOffset) : "06:00 AM",
        rahu_kalam: getSlotRange(rahuSlots[localDayOfWeek]),
        yamagandam: getSlotRange(yamaSlots[localDayOfWeek]),
        gulika_kalam: getSlotRange(gulikaSlots[localDayOfWeek]),
        durmuhurta: durmuhurtaStr,
        varjyam: "08:15 AM - 09:45 AM"
    };
}

module.exports = {
    CITIES,
    calculatePanchang
};
