/**
 * Copies the code this server shares with the website into shared/.
 *
 * The server and the website are separate repositories and are deployed separately, so the
 * server can't load files from ../src when it runs. It uses this committed copy instead.
 *
 *   npm run sync-shared    update shared/ from the website code in ../src
 *   npm run check-shared   fail if shared/ no longer matches ../src
 *
 * Run sync-shared and commit shared/ after changing any of these files in the website.
 */
const fs = require('fs');
const path = require('path');

const SOURCE_DIR = path.resolve(__dirname, '../../src');
const SHARED_DIR = path.resolve(__dirname, '../shared');

// The files the server loads directly. Anything these import is copied too.
const ENTRY_FILES = [
    'utils/consultationPricing.js',
    'utils/kp/kpSubLord.js',
    'utils/kp/kpHouses.js',
    'utils/kp/kpSignificators.js',
    'utils/kp/kpAspects.js',
    'utils/kp/kpRulingPlanets.js',
    'utils/kp/vimshottariDasha.js',
    'utils/nakshatraUtils.js',
    'services/locationService.js'
];

const IMPORT_PATTERN = /(?:from\s+|import\s*\(\s*|import\s+)['"]([^'"]+)['"]/g;

const collectFiles = (relativePath, found = new Set()) => {
    if (found.has(relativePath)) return found;

    const fullPath = path.join(SOURCE_DIR, relativePath);
    if (!fs.existsSync(fullPath)) {
        throw new Error(`Shared file not found in the website code: src/${relativePath}`);
    }
    found.add(relativePath);

    for (const [, specifier] of fs.readFileSync(fullPath, 'utf8').matchAll(IMPORT_PATTERN)) {
        if (specifier.startsWith('.')) {
            collectFiles(path.posix.join(path.posix.dirname(relativePath), specifier), found);
        }
    }
    return found;
};

const listSharedFiles = (dir = SHARED_DIR, prefix = '') => {
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const relativePath = path.posix.join(prefix, entry.name);
        if (entry.isDirectory()) return listSharedFiles(path.join(dir, entry.name), relativePath);
        return entry.name.endsWith('.js') ? [relativePath] : [];
    });
};

// Git may check files out with different line endings on different machines
const readNormalized = (fullPath) => fs.readFileSync(fullPath, 'utf8').replace(/\r\n/g, '\n');

const main = () => {
    const checkOnly = process.argv.includes('--check');

    if (!fs.existsSync(SOURCE_DIR)) {
        console.error(`Website code not found at ${SOURCE_DIR}. Run this with the server folder inside the website folder.`);
        process.exit(2);
    }

    const expected = new Set();
    ENTRY_FILES.forEach((file) => collectFiles(file, expected));

    const outdated = [...expected].filter((file) => {
        const copy = path.join(SHARED_DIR, file);
        return !fs.existsSync(copy) || readNormalized(copy) !== readNormalized(path.join(SOURCE_DIR, file));
    });
    const stale = listSharedFiles().filter((file) => !expected.has(file));

    if (checkOnly) {
        if (outdated.length === 0 && stale.length === 0) {
            console.log(`shared/ matches the website code (${expected.size} files).`);
            return;
        }
        outdated.forEach((file) => console.error(`Out of date: shared/${file}`));
        stale.forEach((file) => console.error(`No longer needed: shared/${file}`));
        console.error('Run "npm run sync-shared" and commit shared/.');
        process.exit(1);
    }

    for (const file of outdated) {
        const target = path.join(SHARED_DIR, file);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.copyFileSync(path.join(SOURCE_DIR, file), target);
    }
    for (const file of stale) {
        fs.rmSync(path.join(SHARED_DIR, file));
    }
    console.log(`Updated ${outdated.length} file(s) and removed ${stale.length}. shared/ has ${expected.size} files.`);
};

main();
