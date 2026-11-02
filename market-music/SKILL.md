---
name: market-music
description: Turn live or historical cryptocurrency/market data into musical notes, scales, and audio playback with interactive ASCII / terminal visual playing animations.
---

# Market Music & Visualizer

A skill that converts crypto and market data (prices, candle OHLCV, volume, volatility, and order flow) into musical notes, melodies, chords, and rhythmic patterns, accompanied by real-time visual playing animations (piano roll, frequency bars, and rhythmic waveforms).

## Features

- **Data-to-Music Sonification**:
  - Map price levels to musical pitches/scales (Pentatonic, Major, Minor, Dorian, Blues).
  - Map volume and candle sizes to dynamics (velocity), note duration, and tempo (BPM).
  - Map price direction (green/red candles, upward/downward trends) to note intervals or octave shifts.
- **Visual Playback Animation**:
  - Terminal-based ASCII/Unicode piano roll animation.
  - Live animated visualizer simulating bouncing notes, frequency bars, and playback cursors.
- **Audio Output / Sheet Representation**:
  - Emits ABC notation, MIDI event sequences, and Web Audio API tone synthesis code.

## Workflow

1. **Fetch Market Data**:
   - Use `lookup_assets` to pull price, 24h change, high/low, and OHLCV candle histories.
   - Extract sequence arrays of close prices, highs, lows, and trading volumes.

2. **Quantize and Map to Scale**:
   - Normalize price range `[min_price, max_price]` to pitch indices (e.g., C3 to C6, 36 to 72 MIDI semitones).
   - Constrain pitches to harmonious scales (e.g., Minor Pentatonic for volatile/bearish movements, Major Pentatonic or Lydian for bull runs).
   - Assign note durations based on candle volume / volatility.

3. **Render Visual Animation & Notes**:
   - Output structured musical notation (ABC notation / note stream).
   - Display a step-by-step visual playback frame sequence (piano keyboard bar or vertical waterfall reel).
