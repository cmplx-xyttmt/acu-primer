#!/bin/sh
# The finished video: Isaac's two voice takes over the rough cut (Oct 25).
#   sh devpost/demo-video/concept-b/final-mix.sh ~/Downloads/acuprimer-part-1.webm ~/Downloads/acuprimer-part-2.webm
# Part 1 is the take from 0:00 (voice-from-0.000s-lead-3.002s), part 2 the take from shot 5
# (voice-from-97.000s-lead-3.001s). Both were recorded while the cut played, so they're in time
# with it once the 3-second countdown is cut off. The switch is at 1:36.4, in a pause just
# before shot 5 (1:37), so no word is cut. Then: rumble below 80 Hz removed, clicks smoothed
# (adeclick), a gentle gate on the pauses, a fixed +6.8 dB to about -17 LUFS, and a limiter on
# the peaks. Output: devpost/demo-video/media/concept-b/final.mp4.
set -e
P1=$1; P2=$2
cd "$(dirname "$0")/../media/concept-b"
SWITCH=96.4
ffmpeg -y -i rough-cut.mp4 -i "$P1" -i "$P2" -filter_complex "\
[1:a]atrim=start=3.002:duration=$SWITCH,asetpts=PTS-STARTPTS[a1];\
[2:a]atrim=start=$(awk "BEGIN{print 3.001 + $SWITCH - 97}"),asetpts=PTS-STARTPTS[a2];\
[a1][a2]concat=n=2:v=0:a=1,highpass=f=80,adeclick,agate=threshold=0.006:ratio=3:range=0.1:attack=8:release=300,\
volume=6.8dB,alimiter=limit=0.84:attack=5:release=50:level=disabled,aresample=48000,apad[a]" \
  -map 0:v -map "[a]" -c:v copy -c:a aac -b:a 192k -t "$(ffprobe -v error -show_entries format=duration -of csv=p=0 rough-cut.mp4)" final.mp4 -loglevel error
echo "final.mp4 written"
