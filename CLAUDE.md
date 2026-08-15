# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

SongChords is a vanilla JavaScript single-page web app that converts plain text song lyrics with chord notations into a formatted, printable display. It runs entirely client-side with no build step. Deployed as a static site to Netlify with a serverless function for CORS proxying.

Demo: https://aquamarine-fox-4d579a.netlify.app

## Development

```bash
npx http-server .
# Or with Netlify Functions support:
npx netlify dev
```

No build, transpilation, or bundling. Edit files directly and reload. Use `netlify dev` to test the CORS proxy function locally.

## Architecture

**Core files:**
- `index.html` — Entry point with toolbar UI, two-panel layout (editor textarea + rendered output), and Google Drive API setup
- `songchords.js` — All application logic: chord parsing, transposition, rendering, UI state management
- `songchordsAPI.js` — `SongStorage` class wrapping localStorage for song and global settings persistence
- `scales.js` — Pure music theory module (no DOM): chord parsing (`parseChord`, `extractChords`), line detection (`isChordLine`, `isTabLine`) and key detection (`analyzeSong`). Unit-tested by `scales.test.mjs` (`npm test`)
- `songchords.css` — Styling including print layout and CSS custom properties for theming
- `websearch.js` — Ultimate Guitar web search and tab import, using CORS proxy
- `g/sync.js` — Google Drive API v3 integration for cloud sync of songs
- `netlify/functions/cors-proxy.mjs` — Netlify serverless function proxying requests to Ultimate Guitar (avoids CORS)

**Data flow:** User edits plain text in textarea → `renderSong()` parses each line → detects line type (chord/lyrics/tab/separator) → `writeMergeChordLine()` positions chords above lyrics → output rendered in `.song-render` div.

**State is entirely localStorage-based:**
- `localStorage["songs"]` — Object keyed by random IDs, each containing `{songchordname, songchord, notation, capo, gId, version, author, categories, group}`
- `localStorage["global"]` — Display settings: `{textfontsize, chordfontsize, chordcolor, textcolor, column, readMode}`
- `localStorage["currentSongIndex"]` — Active song ID

## Song Text Format

```
---
author: Artist Name
categories: Rock, Pop
---
Song Title
----------

[Section Name]
     F        Am
It's a famous song line
 F7       Db
Another lyric line

> Right-aligned footer text
```

- **Front-matter metadata** — Optional YAML-like block at the start of the song text (`---\nauthor: ...\ncategories: ...\n---`). Parsed by `parseFrontMatter()`, stripped from rendering by `stripFrontMatter()`. Updated via `updateFrontMatter()`. Metadata is stored in the song text itself so it syncs automatically with Google Drive/pCloud.
- Legacy `#category:` lines are still parsed as fallback but converted to front-matter when metadata is saved via the dialog.
- Chord lines are auto-detected by `isChordLine()` regex (A-G with optional accidentals and extensions like m, maj7, sus4, dim, aug)
- `---` at the start of the file (followed by metadata) is front-matter; `---` elsewhere creates a horizontal separator; `---text---` creates centered section text
- `===` forces a page break for print
- `[Chord]` syntax for inline chords within lyrics
- Lines ending with `(...)` are italicized annotations
- Tab lines detected by pattern like `G|-` or `E|-`
- `♪` at start of line forces chord line detection

## Transposition System

Two chromatic scale arrays: `gammeB` (flats: Bb, Db, Eb, Gb, Ab) and `gammeD` (sharps: A#, C#, D#, F#, G#). `noteTranspose()` finds the note's position in the scale, adds the delta plus capo offset, and wraps with modulo 12. Spacing is preserved during transposition to maintain chord-over-lyric alignment.

## Key Detection

`analyzeSong()` in `scales.js` scores the 24 major and minor keys against the chords of the song: diatonic chords with the expected quality score highest, common modal loans (♭VII, ♭III, ♭VI, iv, harmonic-minor V) score low but positive, foreign chords are penalised. The tonic chord counts twice, so the chord a song leans on drives the result. `renderSong()` calls `writeScales()`, which writes the winning key, the scales to solo with (major/minor, pentatonic, blues — the tonic's own minor shapes when the song is a twelve-bar blues) and the runner-up keys with their relative score, in a `.song-scales` line at the top of the render.

The analysis reads the song text as written, so it always reports the **sounding** key, independent of the capo (which only shifts the displayed chords). Note spelling follows the key signature unless the ♭/♯ selector forces it.

`analyzeSong()` also returns a `sections` array, one entry per `[Section]` header (`splitSections()` cuts the song on those lines; each occurrence of a repeated header is a block of its own). `writeSectionKey()` labels the header in the render: a section that stays on the key of the song only recalls it in grey, a section that moves away shows its key — boxed — with its scales. Two guards keep the labels honest: a section keeps the key of the song while that key remains a candidate at `SECTION_STICKINESS` (75%) or better, and a key sharing the same seven notes (relative major/minor) is never counted as a modulation. On a 51-song corpus this leaves ~9% of sections flagged as moving away.

## View Modes

Three modes toggled by `viewMode()`: 0 = read-write (split view), 1 = read-only, 2 = write-only.
