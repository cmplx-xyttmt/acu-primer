#!/bin/sh
# Builds the rough cut (no narration) from the concept B renders and clips, at 1920x1080, 30 fps.
# Change the times below and run it again:
#   sh devpost/demo-video/concept-b/rough-cut.sh
# Output: devpost/demo-video/media/concept-b/rough-cut.mp4 (gitignored, like all the media).
set -e
cd "$(dirname "$0")/../media/concept-b"

# Each line of SEGMENTS is: file  start  end  speed  [caption]. A caption is drawn at the top right
# of that segment; " | " in it starts a second line. The app clips are the dark-mode recordings of
# Oct 25. The draft in shot 3 is the app's fake drafting (c08-fake-draft, no Claude call), with a
# caption saying so; a real draft takes 5 to 10 minutes and about $1. The statistics shot (the
# subject card and c11) was cut on Oct 25: the session draft of 5.1 it showed was deleted, so it
# showed a lesson that isn't on the live site.
SEGMENTS='
section-to-lesson.mp4            0     20    1
clips/c08-fake-draft.mp4         1.5   38.5  1.3
clips/c08-fake-draft.mp4         38.5  57.5  1    Simulated drafting (no Claude call). | The real draft of this section took 6 minutes and cost $1.08.
clips/c09-hanoi-review.mp4       4     22    1.25
clips/c09-hanoi-review.mp4       38    44.5  1.25
clips/c09-hanoi-review.mp4       77.5  88.7  1.25
clips/c10-hanoi-student.mp4      0     12    1.2
clips/c10-hanoi-student.mp4      14    30    1.2
clips/c10-hanoi-student.mp4      56    79.5  1.2
clips/c12-hanoi-log.mp4          0     12    1
end-card.mp4                     0     6     1
'
FONT=/System/Library/Fonts/HelveticaNeue.ttc
# The caption: light text on the app's dark background, at the top right, in the empty space
# beside the page title (clear of the queue).
caption() { echo ",drawtext=fontfile=$FONT:text='$1':x=w-text_w-160:y=$2:fontsize=36:fontcolor=0xece8e1:box=1:boxcolor=0x151517@0.88:boxborderw=18"; }

inputs=""; filters=""; labels=""; i=0
echo "$SEGMENTS" | grep -v '^ *$' > segments.txt
while read -r f a b sp label; do
  inputs="$inputs -i $f"
  text=""
  if [ -n "$label" ]; then
    case "$label" in
      *" | "*) text="$(caption "${label%% | *}" 126)$(caption "${label#* | }" 186)" ;;
      *) text="$(caption "$label" 126)" ;;
    esac
  fi
  filters="$filters[$i:v]trim=start=$a:end=$b,setpts=(PTS-STARTPTS)/$sp,fps=30,scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=0xfbf8f1,setsar=1$text[v$i];"
  labels="$labels[v$i]"
  i=$((i + 1))
done < segments.txt
rm segments.txt
ffmpeg -v error -y $inputs -filter_complex "${filters}${labels}concat=n=$i:v=1:a=0[out]" -map "[out]" \
  -c:v libx264 -pix_fmt yuv420p -crf 20 -preset medium -movflags +faststart rough-cut.mp4
echo "rough-cut.mp4: $(ffprobe -v error -show_entries format=duration -of csv=p=0 rough-cut.mp4) s"
