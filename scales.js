//------------------------------------------------
// ----------- Key detection and playable scales --
//------------------------------------------------
// Pure music theory helpers: no DOM access, so this module can be
// unit-tested with `node --test scales.test.mjs`.

const FRONT_MATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;
const SECTION_RE = /^\[([^\]]+)\]$/;

function withoutFrontMatter(song) {
    return song.replace(FRONT_MATTER_RE, '');
}

// Chord suffix tokens, longest first so that "maj" wins over "m".
const SUFFIX_TOKENS = [
    'maj7', 'maj9', 'maj11', 'maj13', 'maj', 'M7', 'M9', 'M', 'Δ',
    'min', 'm', '-',
    'dim7', 'dim', '°', 'ø',
    'aug', '+',
    'sus2', 'sus4', 'sus',
    'add2', 'add4', 'add6', 'add9', 'add11', 'add13', 'add',
    'alt', 'no3', 'no5',
    '13', '11', '9', '7', '6', '5', '4', '2',
    'b5', '#5', 'b9', '#9', 'b11', '#11', 'b13', '#13',
    '(', ')', ' ',
];

const MINOR_TOKENS = new Set(['min', 'm', '-']);
const MAJOR_TOKENS = new Set(['maj7', 'maj9', 'maj11', 'maj13', 'maj', 'M7', 'M9', 'M', 'Δ']);
const DIMINISHED_TOKENS = new Set(['dim7', 'dim', '°', 'ø']);
const AUGMENTED_TOKENS = new Set(['aug', '+']);
const SUSPENDED_TOKENS = new Set(['sus2', 'sus4', 'sus']);
const SEVENTH_TOKENS = new Set(['7', '9', '11', '13']);

function normaliseAccidentals(text) {
    return text.replaceAll('♭', 'b').replaceAll('♯', '#');
}

/**
 * Split a chord suffix into known tokens.
 * Returns null when the suffix contains anything that is not chord notation,
 * which is what keeps lyric words like "Big" from being read as chords.
 */
function tokenizeSuffix(suffix) {
    const tokens = [];
    let rest = suffix;
    while (rest.length > 0) {
        const token = SUFFIX_TOKENS.find((candidate) => rest.startsWith(candidate));
        if (!token) {
            return null;
        }
        tokens.push(token);
        rest = rest.substring(token.length);
    }
    return tokens;
}

/**
 * Parse a single chord token.
 * Returns { root, quality } or null when the token is not a chord.
 * Quality is one of: major, minor, dominant, diminished, augmented, suspended.
 */
export function parseChord(token) {
    if (!token) {
        return null;
    }
    const chord = normaliseAccidentals(token.trim()).split('/')[0];
    const match = chord.match(/^([A-G])([b#]?)(.*)$/);
    if (!match) {
        return null;
    }
    const root = match[1] + match[2];
    const tokens = tokenizeSuffix(match[3]);
    if (tokens === null) {
        return null;
    }

    let quality = 'major';
    for (const suffixToken of tokens) {
        if (MINOR_TOKENS.has(suffixToken)) {
            quality = 'minor';
            break;
        }
        if (DIMINISHED_TOKENS.has(suffixToken)) {
            quality = 'diminished';
            break;
        }
        if (AUGMENTED_TOKENS.has(suffixToken)) {
            quality = 'augmented';
            break;
        }
        if (SUSPENDED_TOKENS.has(suffixToken)) {
            quality = 'suspended';
            break;
        }
        if (MAJOR_TOKENS.has(suffixToken)) {
            quality = 'major';
            break;
        }
        if (SEVENTH_TOKENS.has(suffixToken)) {
            quality = 'dominant';
            break;
        }
    }

    return { root, quality };
}

export function isTabLine(line) {
    return /^[A-Ga-g][♭♯b#]?\|-/.test(line);
}

export function isChordLine(line) {
    let stripped = line.replaceAll('maj', 'Δ');
    stripped = stripped.replaceAll('M7', 'Δ');
    stripped = stripped.replaceAll(/([A-G]).?m/g, '$1');
    stripped = stripped.replaceAll(/([A-G])[b#]/g, '$1');
    stripped = stripped.replaceAll(/([1-9])[b#]/g, '$1');
    stripped = stripped.replaceAll(/sus[1-9]/g, '');
    stripped = stripped.replaceAll(/add[1-9]/g, '');
    stripped = stripped.replaceAll(/dim/g, '');
    stripped = stripped.replaceAll(/aug/g, '');
    stripped = stripped.replaceAll(/x[1-9]/g, '');

    if (stripped.match(/^[A-Ge]\|-/)) {
        return true;
    }
    if (stripped.match(/♪/)) {
        return true;
    }
    if (stripped.match(/[a-z]/)) {
        return false;
    }
    if (stripped.match(/[H-Z]/)) {
        return false;
    }
    return Boolean(stripped.match(/[A-G]/));
}

/**
 * Every chord of a song, in playing order.
 * Returns [{ root, quality }]
 */
export function chordSequence(song) {
    const body = withoutFrontMatter(song);
    const chords = [];

    const collect = (token) => {
        const chord = parseChord(token);
        if (chord) {
            chords.push(chord);
        }
    };

    body.split('\n').forEach((line) => {
        if (isTabLine(line) || line.trim().length === 0) {
            return;
        }
        if (isChordLine(line)) {
            line.replace('♪', ' ').trim().split(/\s+/).forEach(collect);
        } else {
            const brackets = line.matchAll(/\[([^\]]+)\]/g);
            for (const bracket of brackets) {
                collect(bracket[1]);
            }
        }
    });

    return chords;
}

/**
 * Collect every chord of a song, in order of first appearance,
 * with the number of times it occurs.
 * Returns [{ root, quality, count }]
 */
export function extractChords(song) {
    const counted = new Map();

    chordSequence(song).forEach((chord) => {
        const key = `${chord.root}|${chord.quality}`;
        const known = counted.get(key);
        if (known) {
            known.count += 1;
        } else {
            counted.set(key, { ...chord, count: 1 });
        }
    });

    return [...counted.values()];
}

//------------------------------------------------
// ----------- Key detection ----------------------
//------------------------------------------------

const SHARP_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FLAT_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

const MAJOR_KEY_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
const MINOR_KEY_NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'G#', 'A', 'Bb', 'B'];

// Keys whose signature is written with flats (plus C and A, which have none).
const FLAT_MAJOR_PITCHES = new Set([0, 1, 3, 5, 8, 10]);
const FLAT_MINOR_PITCHES = new Set([0, 2, 3, 5, 7, 9, 10]);

const MAJOR_STEPS = [0, 2, 4, 5, 7, 9, 11];
const MAJOR_TRIADS = ['major', 'minor', 'minor', 'major', 'major', 'minor', 'diminished'];
const MINOR_STEPS = [0, 2, 3, 5, 7, 8, 10];
const MINOR_TRIADS = ['minor', 'diminished', 'major', 'minor', 'minor', 'major', 'major'];

const MAJOR_PENTATONIC_STEPS = [0, 2, 4, 7, 9];
const MINOR_PENTATONIC_STEPS = [0, 3, 5, 7, 10];
const BLUES_STEPS = [0, 3, 5, 6, 7, 10];

const DEGREE_MATCH = 3;      // right root, right chord quality
const DEGREE_SUSPENDED = 2;  // right root, quality says nothing
const DEGREE_ALTERED = 0.5;  // right root, borrowed or secondary quality
const DEGREE_BORROWED = 1;   // outside the scale, but a everyday modal loan
const OUT_OF_KEY = -2;

// Chords rock and folk borrow all the time: interval from the tonic and the
// quality that makes them idiomatic rather than foreign.
const BORROWED_CHORDS = {
    major: { 3: 'major', 8: 'major', 10: 'major', 5: 'minor' },  // bIII, bVI, bVII, iv
    minor: { 5: 'major', 2: 'major', 9: 'major' },               // IV and II dorian, VI
};

const BONUS_DOMINANT_PRESENT = 2;
const BONUS_STARTS_ON_TONIC = 2;
const BONUS_ENDS_ON_TONIC = 3;

const MIN_MATCH = 60;          // keep alternatives that stay close to the winner
const SECTION_STICKINESS = 75; // a section sticks to the key of the song while it fits this well

function pitchOf(note) {
    const sharp = SHARP_NAMES.indexOf(note);
    return sharp === -1 ? FLAT_NAMES.indexOf(note) : sharp;
}

function spellNote(pitch, accidental) {
    const names = accidental === '#' ? SHARP_NAMES : FLAT_NAMES;
    return names[(pitch + 12) % 12];
}

function keyAccidental(tonicPitch, mode, forced) {
    if (forced === '#' || forced === 'b') {
        return forced;
    }
    const flatKeys = mode === 'minor' ? FLAT_MINOR_PITCHES : FLAT_MAJOR_PITCHES;
    return flatKeys.has(tonicPitch) ? 'b' : '#';
}

/** Score how well a set of chords fits one key. */
function scoreKey(tonicPitch, mode, chords, first, last) {
    const steps = mode === 'minor' ? MINOR_STEPS : MAJOR_STEPS;
    const triads = mode === 'minor' ? MINOR_TRIADS : MAJOR_TRIADS;
    let score = 0;
    let hasDominant = false;

    chords.forEach((chord) => {
        const interval = (pitchOf(chord.root) - tonicPitch + 12) % 12;
        const degree = steps.indexOf(interval);
        if (degree === -1) {
            const borrowed = BORROWED_CHORDS[mode][interval];
            const heard = chord.quality === 'dominant' ? 'major' : chord.quality;
            score += (borrowed === heard ? DEGREE_BORROWED : OUT_OF_KEY) * chord.count;
            return;
        }

        const expected = triads[degree];
        const actual = chord.quality === 'dominant' ? 'major' : chord.quality;
        // The dominant of a minor key is usually borrowed from harmonic minor.
        const harmonicDominant = mode === 'minor' && degree === 4
            && (chord.quality === 'major' || chord.quality === 'dominant');

        if (chord.quality === 'suspended') {
            score += DEGREE_SUSPENDED * chord.count;
        } else if (actual === expected || harmonicDominant) {
            score += DEGREE_MATCH * chord.count;
        } else {
            score += DEGREE_ALTERED * chord.count;
        }

        if (degree === 0) {
            // How much a song leans on its tonic chord is the strongest clue of all.
            score += DEGREE_MATCH * chord.count;
        }
        if (degree === 4) {
            hasDominant = true;
        }
    });

    if (hasDominant) {
        score += BONUS_DOMINANT_PRESENT;
    }
    if (first && (pitchOf(first.root) - tonicPitch + 12) % 12 === 0) {
        score += BONUS_STARTS_ON_TONIC;
    }
    if (last && (pitchOf(last.root) - tonicPitch + 12) % 12 === 0) {
        score += BONUS_ENDS_ON_TONIC;
    }

    return score;
}

function buildScale(name, rootPitch, steps, accidental, flatFifth = false) {
    return {
        name,
        notes: steps.map((step, index) => {
            const useFlat = flatFifth && index === 3;
            return spellNote(rootPitch + step, useFlat ? 'b' : accidental);
        }),
    };
}

/**
 * A song is played as a blues when its tonic and its fourth degree are both
 * dominant sevenths. One isolated seventh is only a secondary dominant.
 */
function isTwelveBarBlues(tonicPitch, chords) {
    const dominantAt = (interval) => chords.some((chord) =>
        chord.quality === 'dominant'
        && (pitchOf(chord.root) - tonicPitch + 12) % 12 === interval);

    return dominantAt(0) && dominantAt(5);
}

/**
 * A major key borrows its minor fourth when the fourth degree is played both
 * major and minor — the minor plagal colour of "69 Année Érotique" or
 * "In My Life". It calls for scales the key alone does not hold.
 */
function borrowsMinorFourth(tonicPitch, chords) {
    const fourthIs = (quality) => chords.some((chord) =>
        chord.quality === quality
        && (pitchOf(chord.root) - tonicPitch + 12) % 12 === 5);

    return fourthIs('major') && fourthIs('minor');
}

/** The scales the borrowed minor fourth opens up, over the iv chord. */
function minorFourthScales(tonicPitch, { forced }) {
    const fourthPitch = (tonicPitch + 5) % 12;
    // The colour: a major pentatonic a major third under the iv, whose five
    // notes all belong to the natural minor of that iv.
    const colourPitch = (tonicPitch + 1) % 12;
    // Both sit outside the key, so each is written the way its own root
    // is usually written rather than after the signature of the song.
    const colourAccidental = keyAccidental(colourPitch, 'major', forced);
    const fourthAccidental = keyAccidental(fourthPitch, 'minor', forced);

    return [
        buildScale(`${spellNote(colourPitch, colourAccidental)} major pentatonic`,
            colourPitch, MAJOR_PENTATONIC_STEPS, colourAccidental),
        buildScale(`${spellNote(fourthPitch, fourthAccidental)} minor pentatonic`,
            fourthPitch, MINOR_PENTATONIC_STEPS, fourthAccidental),
    ];
}

/** The scales worth soloing with over a given key. */
function scalesFor(tonicPitch, mode, chords, spelling) {
    const { accidental } = spelling;
    if (mode === 'minor') {
        const tonic = MINOR_KEY_NAMES[tonicPitch];
        return [
            buildScale(`${tonic} minor`, tonicPitch, MINOR_STEPS, accidental),
            buildScale(`${tonic} minor pentatonic`, tonicPitch, MINOR_PENTATONIC_STEPS, accidental),
            buildScale(`${tonic} blues`, tonicPitch, BLUES_STEPS, accidental, true),
        ];
    }

    const tonic = MAJOR_KEY_NAMES[tonicPitch];
    const major = buildScale(`${tonic} major`, tonicPitch, MAJOR_STEPS, accidental);
    const borrowed = borrowsMinorFourth(tonicPitch, chords)
        ? minorFourthScales(tonicPitch, spelling)
        : [];

    if (isTwelveBarBlues(tonicPitch, chords)) {
        // Over dominant-seventh songs the minor shapes of the tonic are the ones that work.
        return [
            major,
            buildScale(`${tonic} minor pentatonic`, tonicPitch, MINOR_PENTATONIC_STEPS, accidental),
            buildScale(`${tonic} blues`, tonicPitch, BLUES_STEPS, accidental, true),
            ...borrowed,
        ];
    }

    const relativePitch = (tonicPitch + 9) % 12;
    const relative = MINOR_KEY_NAMES[relativePitch];
    return [
        major,
        buildScale(`${relative} minor pentatonic`, relativePitch, MINOR_PENTATONIC_STEPS, accidental),
        buildScale(`${relative} blues`, relativePitch, BLUES_STEPS, accidental, true),
        ...borrowed,
    ];
}

/**
 * Rank the 24 keys against a piece of music.
 * Returns the best candidates, strongest first, or [] when there is
 * too little harmony to say anything.
 */
function rankKeys(song, options) {
    const chords = extractChords(song).filter((chord) => pitchOf(chord.root) !== -1);
    if (chords.length < 2) {
        return [];
    }

    const sequence = chordSequence(song);
    const first = sequence[0];
    const last = sequence[sequence.length - 1];

    const scored = [];
    for (let pitch = 0; pitch < 12; pitch++) {
        ['major', 'minor'].forEach((mode) => {
            scored.push({ pitch, mode, score: scoreKey(pitch, mode, chords, first, last) });
        });
    }
    scored.sort((a, b) => b.score - a.score);

    const best = scored[0];
    if (best.score <= 0) {
        return [];
    }

    return scored
        .map((key) => ({ ...key, match: Math.round((key.score / best.score) * 100) }))
        .filter((key) => key.match >= MIN_MATCH)
        .slice(0, 3)
        .map((key) => {
            const accidental = keyAccidental(key.pitch, key.mode, options.notation);
            const tonic = key.mode === 'minor'
                ? MINOR_KEY_NAMES[key.pitch]
                : MAJOR_KEY_NAMES[key.pitch];
            return {
                tonic,
                mode: key.mode,
                name: `${tonic} ${key.mode}`,
                score: key.score,
                match: key.match,
                scales: scalesFor(key.pitch, key.mode, chords,
                    { accidental, forced: options.notation }),
            };
        });
}

/**
 * Cut a song on its [Section] headers. Whatever comes before the first
 * header belongs to no section and is left out.
 * Returns [{ name, body }], one entry per header, in reading order.
 */
export function splitSections(song) {
    const sections = [];

    withoutFrontMatter(song).split('\n').forEach((line) => {
        const header = line.trim().match(SECTION_RE);
        if (header) {
            sections.push({ name: header[1].trim(), body: '' });
        } else if (sections.length > 0) {
            sections[sections.length - 1].body += `${line}\n`;
        }
    });

    return sections;
}

/**
 * Two keys built on the same seven notes — a key and its relative minor or
 * major — call for the same scales, so leaving one for the other is no
 * modulation for whoever is soloing.
 */
function sharesTheSameNotes(key, other) {
    if (key.name === other.name) {
        return true;
    }
    const relative = (candidate) => (candidate.mode === 'minor'
        ? (pitchOf(candidate.tonic) + 3) % 12
        : pitchOf(candidate.tonic));

    return key.mode !== other.mode && relative(key) === relative(other);
}

/**
 * Read every section of a song and tell which key it is played in.
 * A section stays on the key of the song as long as that key remains a
 * close runner-up, so that a four-chord chorus is not declared a modulation.
 */
function analyzeSections(song, songKey, options) {
    return splitSections(song).map((section) => {
        const candidates = rankKeys(section.body, options);
        if (candidates.length === 0) {
            return { name: section.name, key: null, sameAsSong: true };
        }

        const asSong = candidates.find((candidate) => candidate.name === songKey.name);
        if (asSong && asSong.match >= SECTION_STICKINESS) {
            return { name: section.name, key: asSong, sameAsSong: true };
        }

        return {
            name: section.name,
            key: candidates[0],
            sameAsSong: sharesTheSameNotes(candidates[0], songKey),
        };
    });
}

/**
 * Analyse a song and return its most likely keys with the scales to solo on,
 * plus the same reading for each of its [Section] blocks.
 * Returns null when the song holds too little harmony to say anything.
 * options.notation forces the spelling of the notes ('#' or 'b').
 */
export function analyzeSong(song, options = {}) {
    const candidates = rankKeys(song, options);
    if (candidates.length === 0) {
        return null;
    }

    return {
        chords: extractChords(song),
        candidates,
        sections: analyzeSections(song, candidates[0], options),
    };
}
