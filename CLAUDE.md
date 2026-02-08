# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

SongChords is a vanilla JavaScript single-page web app that converts plain text song lyrics with chord notations into a formatted, printable display. It runs entirely client-side with no build step. Deployed as a static site to GitHub Pages via `.github/workflows/static.yml`.

Demo: https://ericbrison.github.io/songchords/

## Development

```bash
npx http-server .
```

No build, transpilation, or bundling. Edit files directly and reload.

## Architecture

**Core files:**
- `index.html` — Entry point with toolbar UI, two-panel layout (editor textarea + rendered output), and Google Drive API setup
- `songchords.js` — All application logic: chord parsing, transposition, rendering, UI state management
- `songchordsAPI.js` — `SongStorage` class wrapping localStorage for song and global settings persistence
- `songchords.css` — Styling including print layout and CSS custom properties for theming
- `g/sync.js` — Google Drive API v3 integration for cloud sync of songs

**Data flow:** User edits plain text in textarea → `renderSong()` parses each line → detects line type (chord/lyrics/tab/separator) → `writeMergeChordLine()` positions chords above lyrics → output rendered in `.song-render` div.

**State is entirely localStorage-based:**
- `localStorage["songs"]` — Object keyed by random IDs, each containing `{songchordname, songchord, notation, capo, gId, version}`
- `localStorage["global"]` — Display settings: `{textfontsize, chordfontsize, chordcolor, textcolor, column, readMode}`
- `localStorage["currentSongIndex"]` — Active song ID

## Song Text Format

```
Song Title
----------

[Section Name]
     F        Am
It's a famous song line
 F7       Db
Another lyric line

> Right-aligned footer text
```

- Chord lines are auto-detected by `isChordLine()` regex (A-G with optional accidentals and extensions like m, maj7, sus4, dim, aug)
- `---` creates a horizontal separator; `---text---` creates centered section text
- `===` forces a page break for print
- `[Chord]` syntax for inline chords within lyrics
- Lines ending with `(...)` are italicized annotations
- Tab lines detected by pattern like `G|-` or `E|-`
- `♪` at start of line forces chord line detection

## Transposition System

Two chromatic scale arrays: `gammeB` (flats: Bb, Db, Eb, Gb, Ab) and `gammeD` (sharps: A#, C#, D#, F#, G#). `noteTranspose()` finds the note's position in the scale, adds the delta plus capo offset, and wraps with modulo 12. Spacing is preserved during transposition to maintain chord-over-lyric alignment.

## View Modes

Three modes toggled by `viewMode()`: 0 = read-write (split view), 1 = read-only, 2 = write-only.
