import test from 'node:test';
import assert from 'node:assert/strict';

import { parseChord, extractChords, analyzeSong } from './scales.js';

const song = (...lines) => lines.join('\n');

// ---------------------------------------------------------------
// parseChord
// ---------------------------------------------------------------

test('parseChord reads a bare major triad', () => {
    assert.deepEqual(parseChord('G'), { root: 'G', quality: 'major' });
});

test('parseChord reads a minor triad', () => {
    assert.deepEqual(parseChord('Am'), { root: 'A', quality: 'minor' });
});

test('parseChord keeps the minor quality of a minor seventh', () => {
    assert.deepEqual(parseChord('Am7'), { root: 'A', quality: 'minor' });
});

test('parseChord marks a dominant seventh as dominant', () => {
    assert.deepEqual(parseChord('G7'), { root: 'G', quality: 'dominant' });
});

test('parseChord treats a major seventh as major', () => {
    assert.deepEqual(parseChord('Cmaj7'), { root: 'C', quality: 'major' });
});

test('parseChord normalises sharp and flat roots', () => {
    assert.deepEqual(parseChord('C#m'), { root: 'C#', quality: 'minor' });
    assert.deepEqual(parseChord('Bb'), { root: 'Bb', quality: 'major' });
});

test('parseChord accepts the unicode accidentals used by the renderer', () => {
    assert.deepEqual(parseChord('F♯m'), { root: 'F#', quality: 'minor' });
    assert.deepEqual(parseChord('E♭'), { root: 'Eb', quality: 'major' });
});

test('parseChord reads diminished and augmented chords', () => {
    assert.deepEqual(parseChord('Bdim'), { root: 'B', quality: 'diminished' });
    assert.deepEqual(parseChord('Caug'), { root: 'C', quality: 'augmented' });
});

test('parseChord keeps only the chord root of a slash chord', () => {
    assert.deepEqual(parseChord('F/A'), { root: 'F', quality: 'major' });
});

test('parseChord treats suspended chords as quality-less', () => {
    assert.deepEqual(parseChord('Dsus4'), { root: 'D', quality: 'suspended' });
});

test('parseChord rejects what is not a chord', () => {
    assert.equal(parseChord('Hello'), null);
    assert.equal(parseChord(''), null);
    assert.equal(parseChord('x4'), null);
});

// ---------------------------------------------------------------
// extractChords
// ---------------------------------------------------------------

test('extractChords counts each occurrence of a chord', () => {
    const song = [
        '   G       D',
        'Somewhere over the rainbow',
        '   G',
        'Way up high',
    ].join('\n');

    assert.deepEqual(extractChords(song), [
        { root: 'G', quality: 'major', count: 2 },
        { root: 'D', quality: 'major', count: 1 },
    ]);
});

test('extractChords ignores lyric lines that start with a chord-like word', () => {
    const song = ['Am  F', 'Am I the only one'].join('\n');

    assert.deepEqual(extractChords(song), [
        { root: 'A', quality: 'minor', count: 1 },
        { root: 'F', quality: 'major', count: 1 },
    ]);
});

test('extractChords picks up inline bracket chords inside lyrics', () => {
    const song = 'I [C]once was [G]lost but [Am]now am found';

    assert.deepEqual(extractChords(song), [
        { root: 'C', quality: 'major', count: 1 },
        { root: 'G', quality: 'major', count: 1 },
        { root: 'A', quality: 'minor', count: 1 },
    ]);
});

test('extractChords skips tablature lines', () => {
    const song = ['E|-----3---|', 'B|-----0---|', '  C   G'].join('\n');

    assert.deepEqual(extractChords(song), [
        { root: 'C', quality: 'major', count: 1 },
        { root: 'G', quality: 'major', count: 1 },
    ]);
});

test('extractChords skips the front-matter block', () => {
    const song = [
        '---',
        'author: Eddie',
        'categories: Rock, Blues',
        '---',
        '   A   E',
    ].join('\n');

    assert.deepEqual(extractChords(song), [
        { root: 'A', quality: 'major', count: 1 },
        { root: 'E', quality: 'major', count: 1 },
    ]);
});

test('extractChords returns nothing for a song without chords', () => {
    assert.deepEqual(extractChords('Just some words\nand more words'), []);
});

// ---------------------------------------------------------------
// analyzeSong - key detection
// ---------------------------------------------------------------

test('analyzeSong detects a plain I-V-vi-IV major progression', () => {
    const analysis = analyzeSong(song('G   D   Em  C', 'la la la la'));

    assert.equal(analysis.candidates[0].name, 'G major');
    assert.equal(analysis.candidates[0].tonic, 'G');
    assert.equal(analysis.candidates[0].mode, 'major');
});

test('analyzeSong prefers the key the song resolves on', () => {
    const analysis = analyzeSong(song('C   F   G   C', 'words here'));

    assert.equal(analysis.candidates[0].name, 'C major');
});

test('analyzeSong detects a minor key with a harmonic minor dominant', () => {
    const analysis = analyzeSong(song('Am  Dm  E7  Am', 'words here'));

    assert.equal(analysis.candidates[0].name, 'A minor');
});

test('analyzeSong detects a flat key and spells its notes with flats', () => {
    const analysis = analyzeSong(song('F   Bb  C7  F', 'words here'));

    assert.equal(analysis.candidates[0].name, 'F major');
    assert.deepEqual(analysis.candidates[0].scales[0].notes,
        ['F', 'G', 'A', 'Bb', 'C', 'D', 'E']);
});

test('analyzeSong ranks candidates from strongest to weakest', () => {
    const analysis = analyzeSong(song('G   D   Em  C', 'la la la la'));

    assert.equal(analysis.candidates[0].match, 100);
    assert.ok(analysis.candidates.length <= 3);
    for (let i = 1; i < analysis.candidates.length; i++) {
        assert.ok(analysis.candidates[i].match <= analysis.candidates[i - 1].match);
        assert.ok(analysis.candidates[i].name !== analysis.candidates[i - 1].name);
    }
});

test('analyzeSong rejects a key contradicted by an out-of-scale chord', () => {
    // F# major has no place in C major; the song is plainly in D major.
    const analysis = analyzeSong(song('D   A   F#m  G', 'words here'));

    assert.equal(analysis.candidates[0].name, 'D major');
});

test('analyzeSong returns null when there is nothing to analyse', () => {
    assert.equal(analyzeSong('Just some words\nand more words'), null);
    assert.equal(analyzeSong(song('   G', 'a single chord')), null);
});

// ---------------------------------------------------------------
// analyzeSong - playable scales
// ---------------------------------------------------------------

test('a major key offers its major scale and the relative minor shapes', () => {
    const { scales } = analyzeSong(song('G   D   Em  C', 'la la la la')).candidates[0];

    assert.deepEqual(scales.map((scale) => scale.name),
        ['G major', 'E minor pentatonic', 'E blues']);
    assert.deepEqual(scales[0].notes, ['G', 'A', 'B', 'C', 'D', 'E', 'F#']);
    assert.deepEqual(scales[1].notes, ['E', 'G', 'A', 'B', 'D']);
    assert.deepEqual(scales[2].notes, ['E', 'G', 'A', 'Bb', 'B', 'D']);
});

test('a minor key offers its own minor, pentatonic and blues scales', () => {
    const { scales } = analyzeSong(song('Am  Dm  E7  Am', 'words here')).candidates[0];

    assert.deepEqual(scales.map((scale) => scale.name),
        ['A minor', 'A minor pentatonic', 'A blues']);
    assert.deepEqual(scales[0].notes, ['A', 'B', 'C', 'D', 'E', 'F', 'G']);
    assert.deepEqual(scales[1].notes, ['A', 'C', 'D', 'E', 'G']);
});

test('a song built on dominant sevenths offers the blues scale of its tonic', () => {
    const analysis = analyzeSong(song('A7  D7  E7  A7', 'woke up this morning'));

    assert.equal(analysis.candidates[0].name, 'A major');
    assert.deepEqual(analysis.candidates[0].scales.map((scale) => scale.name),
        ['A major', 'A minor pentatonic', 'A blues']);
});

test('analyzeSong can be forced to spell notes with sharps', () => {
    const { scales } = analyzeSong(song('F   Bb  C7  F', 'words here'),
        { notation: '#' }).candidates[0];

    assert.deepEqual(scales[0].notes, ['F', 'G', 'A', 'A#', 'C', 'D', 'E']);
});

test('a mixolydian bVII does not steal the key from the tonic', () => {
    // Proud Mary: hammered D with C and G around it, plainly in D.
    const analysis = analyzeSong(song(
        'D    D    D    D',
        'left a good job in the city',
        'D    C    G    D',
        'rollin on the river',
        'D    C    G    D',
        'more river',
    ));

    assert.equal(analysis.candidates[0].name, 'D major');
});

test('the most played chord weighs on the key more than a passing one', () => {
    const analysis = analyzeSong(song(
        'F    C    F    C',
        'hey jude',
        'F    C    F',
        'na na na',
    ));

    assert.equal(analysis.candidates[0].name, 'F major');
});

test('a lone secondary dominant is not enough to call a song a blues', () => {
    // Hey Jude has an F7 leading to Bb, but it is no twelve-bar blues.
    const { scales } = analyzeSong(song(
        'F    C    C7   F',
        'hey jude',
        'F7   Bb   F    C7   F',
        'the movement you need',
    )).candidates[0];

    assert.deepEqual(scales.map((scale) => scale.name),
        ['F major', 'D minor pentatonic', 'D blues']);
});

// ---------------------------------------------------------------
// analyzeSong - sections
// ---------------------------------------------------------------

const sectionSong = song(
    '[Intro]',
    'C',
    'la',
    '[Verse 1]',
    'C    G    Am   F',
    'words words words',
    'C    G    F    C',
    'more words here',
    '[Bridge]',
    'Eb   Ab   Bb   Eb',
    'a whole different place',
    'Eb   Ab   Bb   Eb',
    'still there',
    '[Chorus]',
    'F    G    C    Am',
    'sing it out loud',
    'F    G    C    C',
    'sing it again',
);

test('a section keeps the key of the song when it does not move away', () => {
    const { sections } = analyzeSong(sectionSong);

    const verse = sections.find((section) => section.name === 'Verse 1');
    assert.equal(verse.sameAsSong, true);
    assert.equal(verse.key.name, 'C major');
});

test('a modulating section reports its own key and scales', () => {
    const { sections } = analyzeSong(sectionSong);

    const bridge = sections.find((section) => section.name === 'Bridge');
    assert.equal(bridge.sameAsSong, false);
    assert.equal(bridge.key.name, 'Eb major');
    assert.deepEqual(bridge.key.scales.map((scale) => scale.name),
        ['Eb major', 'C minor pentatonic', 'C blues']);
});

test('a section too short to analyse carries no key', () => {
    const { sections } = analyzeSong(sectionSong);

    const intro = sections.find((section) => section.name === 'Intro');
    assert.equal(intro.key, null);
});

test('sections are reported once per occurrence, in reading order', () => {
    const { sections } = analyzeSong(sectionSong);

    assert.deepEqual(sections.map((section) => section.name),
        ['Intro', 'Verse 1', 'Bridge', 'Chorus']);
});

test('each occurrence of a repeated section is analysed on its own', () => {
    const { sections } = analyzeSong(song(
        '[Chorus]',
        'C    G    Am   F',
        'first time round',
        'C    G    F    C',
        'still the same',
        '[Verse]',
        'C    G    Am   F',
        'a verse in between',
        'C    G    F    C',
        'more of it',
        '[Chorus]',
        'D    A    Bm   G',
        'lifted a tone',
        'D    A    G    D',
        'and it stays there',
    ));

    const choruses = sections.filter((section) => section.name === 'Chorus');
    assert.equal(choruses.length, 2);
    assert.equal(choruses[0].key.name, 'C major');
    assert.equal(choruses[1].key.name, 'D major');
    assert.equal(choruses[1].sameAsSong, false);
});

test('a song without section headers reports no section', () => {
    assert.deepEqual(analyzeSong(song('C    G    Am   F', 'no headers here')).sections, []);
});

test('a section sitting on the relative minor is not a modulation', () => {
    // Same seven notes as the song: nothing new to play there.
    const { sections } = analyzeSong(song(
        '[Verse]',
        'C    G    F    C',
        'the song is in C',
        'C    G    F    C',
        'no doubt about it',
        '[Chorus]',
        'C    F    G    C',
        'and it stays in C',
        'C    F    G    C',
        'all the way through',
        '[Bridge]',
        'Am   Dm   E7   Am',
        'darker for a while',
        '[Chorus]',
        'C    F    G    C',
        'and it stays in C',
        'C    F    G    C',
        'all the way through',
    ));

    const bridge = sections.find((section) => section.name === 'Bridge');
    assert.equal(bridge.key.name, 'A minor');
    assert.equal(bridge.sameAsSong, true);
});

// ---------------------------------------------------------------
// analyzeSong - borrowed minor fourth
// ---------------------------------------------------------------

test('a borrowed minor fourth adds the two scales that fit it', () => {
    // 69 Année Érotique: the IV turns minor under a D pedal.
    const { candidates } = analyzeSong(song(
        'Dmaj7  G/D  Gm/D  D',
        'soixante neuf',
        'Dmaj7  G/D  Gm/D  D',
        'annee erotique',
    ));

    assert.equal(candidates[0].name, 'D major');
    assert.deepEqual(candidates[0].scales.map((scale) => scale.name), [
        'D major',
        'B minor pentatonic',
        'B blues',
        'Eb major pentatonic',
        'G minor pentatonic',
    ]);
    assert.deepEqual(candidates[0].scales[3].notes, ['Eb', 'F', 'G', 'Bb', 'C']);
    assert.deepEqual(candidates[0].scales[4].notes, ['G', 'Bb', 'C', 'D', 'F']);
});

test('the major fourth alone leaves the scales untouched', () => {
    const { candidates } = analyzeSong(song('D    G    A    D', 'plain and major'));

    assert.equal(candidates[0].scales.length, 3);
});

test('a minor key keeps its own scales when its fourth turns major', () => {
    // The dorian IV of a minor key is another story, and another colour.
    const { candidates } = analyzeSong(song(
        'Am   D    Am   Dm',
        'dorian then aeolian',
        'Am   D    Dm   Am',
        'and back again',
    ));

    assert.equal(candidates[0].mode, 'minor');
    assert.equal(candidates[0].scales.length, 3);
});
