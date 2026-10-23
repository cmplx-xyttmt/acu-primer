#!/bin/sh
# Builds the rough cut (no narration) from the concept B renders and clips, at 1920x1080, 30 fps.
# Each line of SEGMENTS is: file  start  end  speed. Change the times and run it again:
#   sh devpost/demo-video/concept-b/rough-cut.sh
# Output: devpost/demo-video/media/concept-b/rough-cut.mp4 (gitignored, like all the media).
set -e
cd "$(dirname "$0")/../media/concept-b"

SEGMENTS='
section-to-lesson.mp4            0    20    1
clips/c08-book-and-draft.mp4     1.5  34    1.3
clips/c08-book-and-draft.mp4     34   386   25
clips/c08-book-and-draft.mp4     386  399   1
clips/c09-hanoi-review.mp4       4    22    1.25
clips/c09-hanoi-review.mp4       38   44    1.25
clips/c09-hanoi-review.mp4       78   89    1.25
clips/c10-hanoi-student.mp4      0    12    1.2
clips/c10-hanoi-student.mp4      14   26    1.2
clips/c10-hanoi-student.mp4      55   78    1.2
clips/c11-sampling.mp4           24   41    1
clips/c12-hanoi-log.mp4          0    12    1
end-card.mp4                     0    6     1
'

inputs=""; filters=""; labels=""; i=0
echo "$SEGMENTS" | grep -v '^ *$' > segments.txt
while read -r f a b sp; do
  inputs="$inputs -i $f"
  filters="$filters[$i:v]trim=start=$a:end=$b,setpts=(PTS-STARTPTS)/$sp,fps=30,scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=0xfbf8f1,setsar=1[v$i];"
  labels="$labels[v$i]"
  i=$((i + 1))
done < segments.txt
rm segments.txt
ffmpeg -v error -y $inputs -filter_complex "${filters}${labels}concat=n=$i:v=1:a=0[out]" -map "[out]" \
  -c:v libx264 -pix_fmt yuv420p -crf 20 -preset medium -movflags +faststart rough-cut.mp4
echo "rough-cut.mp4: $(ffprobe -v error -show_entries format=duration -of csv=p=0 rough-cut.mp4) s"
