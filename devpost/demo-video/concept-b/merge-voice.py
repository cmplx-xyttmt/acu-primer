#!/usr/bin/env python3
"""Lay voice takes from narration.html's teleprompter over the rough cut.

    python3 merge-voice.py ~/Downloads/voice-from-0.000s-lead-3.012s.webm [more takes...]

Each take's file name says where in the cut it starts (from) and how much audio comes before
the cut starts playing (lead, the countdown). A take covers the cut from its start until the
next take starts, so a redo from shot 4 replaces the first take from shot 4 on; of two takes
from the same shot, the one named last wins. Writes
../media/concept-b/final.mp4 (the video untouched, the voice as AAC).
"""
import re
import subprocess
import sys
from pathlib import Path

here = Path(__file__).resolve().parent
cut = here / "../media/concept-b/rough-cut.mp4"
out = here / "../media/concept-b/final.mp4"

takes = []
for arg in sys.argv[1:]:
    m = re.search(r"voice-from-([\d.]+)s-lead-(-?[\d.]+)s", Path(arg).name)
    if not m:
        sys.exit(f"Can't read where {arg} starts: keep the name the page gave it.")
    takes.append((float(m.group(1)), float(m.group(2)), arg))
if not takes:
    sys.exit(__doc__)
# Two takes from the same shot: the one named last on the command line wins.
takes = sorted({start: (start, lead, path) for start, lead, path in takes}.values())

length = float(subprocess.check_output(
    ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(cut)], text=True))

inputs, filters, labels = ["-i", str(cut)], [], []
for i, (start, lead, path) in enumerate(takes):
    until = takes[i + 1][0] if i + 1 < len(takes) else length
    inputs += ["-i", path]
    filters.append(
        f"[{i + 1}:a]atrim=start={lead}:duration={until - start},asetpts=PTS-STARTPTS,"
        f"adelay={int(start * 1000)}:all=1[a{i}]")
    labels.append(f"[a{i}]")
filters.append(f"{''.join(labels)}amix=inputs={len(labels)}:normalize=0,apad[voice]")

subprocess.run(["ffmpeg", "-y", *inputs, "-filter_complex", ";".join(filters),
                "-map", "0:v", "-map", "[voice]", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k",
                "-t", f"{length}", str(out)], check=True)
print(f"Wrote {out.resolve()}")
