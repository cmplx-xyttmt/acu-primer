#!/bin/sh
# Builds the rough cut (no narration) from the concept B renders and clips, at 1920x1080, 30 fps.
# Change the times below and run it again:
#   sh devpost/demo-video/concept-b/rough-cut.sh
# Output: devpost/demo-video/media/concept-b/rough-cut.mp4 (gitignored, like all the media).
set -e
cd "$(dirname "$0")/../media/concept-b"

# Each line of SEGMENTS is: file  start  end  speed  [label]. A label is drawn over that segment
# (used to mark placeholder footage). The app clips are the dark-mode recordings of Oct 25; the
# two c08-book-and-draft lines are the light Oct 23 draft, kept as a placeholder until Isaac
# records one real draft on the live site.
SEGMENTS='
section-to-lesson.mp4            0     20    1
clips/c08-book-to-draft.mp4      1.5   29.5  1.3
clips/c08-book-to-draft.mp4      29.5  40.5  1.3
clips/c08-book-and-draft.mp4     34.5  386   25   PLACEHOLDER  light footage of the Oct 23 draft (to be replaced by a real one)
clips/c08-book-and-draft.mp4     386   399   1    PLACEHOLDER  light footage of the Oct 23 draft (to be replaced by a real one)
clips/c09-hanoi-review.mp4       4     22    1.25
clips/c09-hanoi-review.mp4       38    44.5  1.25
clips/c09-hanoi-review.mp4       77.5  88.7  1.25
clips/c10-hanoi-student.mp4      0     12    1.2
clips/c10-hanoi-student.mp4      14    30    1.2
clips/c10-hanoi-student.mp4      56    79.5  1.2
subject-card.mp4                 0     2.5   1
clips/c11-sampling.mp4           0     2.6   1
clips/c11-sampling.mp4           25    42.5  1
clips/c12-hanoi-log.mp4          0     12    1
end-card.mp4                     0     6     1
'

inputs=""; filters=""; labels=""; i=0
echo "$SEGMENTS" | grep -v '^ *$' > segments.txt
while read -r f a b sp label; do
  inputs="$inputs -i $f"
  text=""
  [ -n "$label" ] && text=",drawtext=text='$label':x=40:y=40:fontsize=34:fontcolor=white:box=1:boxcolor=0xb91c1c@0.85:boxborderw=14"
  filters="$filters[$i:v]trim=start=$a:end=$b,setpts=(PTS-STARTPTS)/$sp,fps=30,scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=0xfbf8f1,setsar=1$text[v$i];"
  labels="$labels[v$i]"
  i=$((i + 1))
done < segments.txt
rm segments.txt
ffmpeg -v error -y $inputs -filter_complex "${filters}${labels}concat=n=$i:v=1:a=0[out]" -map "[out]" \
  -c:v libx264 -pix_fmt yuv420p -crf 20 -preset medium -movflags +faststart rough-cut.mp4
echo "rough-cut.mp4: $(ffprobe -v error -show_entries format=duration -of csv=p=0 rough-cut.mp4) s"
