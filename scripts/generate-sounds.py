"""
Generates the eight tones in assets/audio.

    python scripts/generate-sounds.py

They are synthesised rather than licensed so the repo stays self-contained and the
sound design is a parameter rather than an asset hunt. Four pentatonic drum pads
(C5, E5, G5, A5) so any sequence the beat game produces is consonant, a rising
chime for a match, and — deliberately — a soft falling third rather than a buzzer
for a miss. A child must never learn that the app is testing them.
"""

import math
import os
import struct
import wave

SR = 44100
OUT_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "assets", "audio")


def tone(freq, dur, decay=9.0, harm=0.28, attack=0.006):
    """A decaying sine with two quiet harmonics, faded at both ends to avoid clicks."""
    n = int(SR * dur)
    out = []
    for i in range(n):
        t = i / SR
        env = math.exp(-decay * t)
        if t < attack:
            env *= t / attack
        remaining = (n - i) / SR
        if remaining < 0.01:
            env *= remaining / 0.01
        v = (
            math.sin(2 * math.pi * freq * t)
            + harm * math.sin(2 * math.pi * freq * 2 * t)
            + 0.12 * math.sin(2 * math.pi * freq * 3 * t)
        )
        out.append(0.62 * env * v / (1 + harm + 0.12))
    return out


def seq(*parts):
    out = []
    for part in parts:
        out.extend(part)
    return out


def write_wav(name, samples):
    path = os.path.join(OUT_DIR, name)
    with wave.open(path, "w") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(
            b"".join(
                struct.pack("<h", max(-32767, min(32767, int(s * 32767)))) for s in samples
            )
        )
    print(f"{name}  {len(samples) / SR:.2f}s")


def main():
    os.makedirs(OUT_DIR, exist_ok=True)

    # Drum pads — a C major pentatonic subset, so no sequence can sound wrong.
    for name, freq in [
        ("pad-1.wav", 523.25),  # C5
        ("pad-2.wav", 659.25),  # E5
        ("pad-3.wav", 783.99),  # G5
        ("pad-4.wav", 880.00),  # A5
    ]:
        write_wav(name, tone(freq, 0.45, decay=8.0))

    write_wav("correct.wav", seq(tone(783.99, 0.16, decay=11.0), tone(1046.50, 0.42, decay=7.0)))
    write_wav("retry.wav", seq(tone(440.00, 0.16, decay=12.0, harm=0.1), tone(349.23, 0.34, decay=9.0, harm=0.1)))
    write_wav(
        "celebrate.wav",
        seq(
            tone(523.25, 0.13, decay=13.0),
            tone(659.25, 0.13, decay=13.0),
            tone(783.99, 0.13, decay=13.0),
            tone(1046.50, 0.55, decay=6.0),
        ),
    )
    write_wav("tap.wav", tone(1174.66, 0.09, decay=30.0, harm=0.05))


if __name__ == "__main__":
    main()
