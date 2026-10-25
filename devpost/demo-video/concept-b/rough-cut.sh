#!/bin/sh
# Builds the rough cut (no narration) from the concept B renders and clips, at 1920x1080, 30 fps.
# Change the times below and run it again:
#   sh devpost/demo-video/concept-b/rough-cut.sh
# Output: devpost/demo-video/media/concept-b/rough-cut.mp4 (gitignored, like all the media).
set -e
cd "$(dirname "$0")/../media/concept-b"

# Each line of SEGMENTS is: file  start  end  speed  hold  zoom  [caption].
#   hold: seconds the segment's last frame is held after it plays (0 for none).
#   zoom: how far the segment slowly zooms in over its whole length (1 for none, 1.03 is 3%).
#   caption: drawn at the top right of that segment; " | " in it starts a second line.
# Every pair of segments is joined by a crossfade of XFADE seconds. The outgoing segment's last
# frame is held through the crossfade, so each segment still starts at the sum of the lengths
# before it, and the cut is as long as the segments add up to.
# The app clips are the dark-mode recordings of Oct 25. The draft in shot 3 is the app's fake
# drafting (c08-fake-draft, no Claude call), with a caption saying so; a real draft takes 5 to 10
# minutes and about $1. The statistics shot (the subject card and c11) was cut on Oct 25: the
# session draft of 5.1 it showed was deleted, so it showed a lesson that isn't on the live site.
# The start and end times are set so that every shot starts on a whole second (narration.html's
# times): 0:00, 0:21, 0:43 (inside the first c08 line), 1:08, 1:37, 2:20, 2:38; the end is 2:50 (the end
# card was cut to 12 s and the opener's hold to 1 s on Oct 25: under the rules' three minutes).
SEGMENTS='
section-to-lesson.mp4            0     20    1     1    1
clips/c08-fake-draft.mp4         2.1   38.5  1.3   0    1
clips/c08-fake-draft.mp4         38.5  57.5  1     0    1    Simulated drafting (no Claude call). | The real draft of this section took 6 minutes and cost $1.08.
clips/c09-hanoi-review.mp4       3.45  22    1.25  0    1
clips/c09-hanoi-review.mp4       38    44.5  1.25  0    1
clips/c09-hanoi-review.mp4       77.5  88.7  1.25  0    1
clips/c10-hanoi-student.mp4      0     12    1.2   0    1
clips/c10-hanoi-student.mp4      14    30    1.2   0    1
clips/c10-hanoi-student.mp4      55.9  79.5  1.2   0    1
clips/c12-hanoi-log.mp4          0     12.4  1     5.6  1
end-card.mp4                     0     6     1     6    1.03
'
# Each line of LABELS is: time  text. A section label fades in at the bottom left at that time
# (in the finished cut), stays about 3 seconds and fades out.
LABELS='
21.2   Start from a book
43.0   Draft lessons
68.2   Review
97.2  A student
140.2  The student log
'
XFADE=0.4
FONT=/System/Library/Fonts/HelveticaNeue.ttc
# The caption: light text on the app's dark background, at the top right, in the empty space
# beside the page title (clear of the queue).
caption() { echo ",drawtext=fontfile=$FONT:text='$1':x=w-text_w-160:y=$2:fontsize=36:fontcolor=0xece8e1:box=1:boxcolor=0x151517@0.88:boxborderw=18"; }
# A section label: white on a solid green box (a dark box disappeared on the dark screens), at the
# bottom left, where no screen has anything. Up for about 3 seconds.
label() {
  a="if(lt(t,$1),0,if(lt(t,$1+0.4),(t-$1)/0.4,if(lt(t,$1+3.0),1,if(lt(t,$1+3.4),($1+3.4-t)/0.4,0))))"
  echo ",drawtext=fontfile=$FONT:text='$2':x=64:y=h-text_h-64:fontsize=46:fontcolor=white:box=1:boxcolor=0x2e8659@0.95:boxborderw=20:alpha='$a':enable='between(t,$1,$1+3.4)'"
}

inputs=""; filters=""; i=0; total=0; prev=""
echo "$SEGMENTS" | grep -v '^ *$' > segments.txt
n=$(wc -l < segments.txt | tr -d ' ')
while read -r f a b sp hold zoom label; do
  inputs="$inputs -i $f"
  text=""
  if [ -n "$label" ]; then
    case "$label" in
      *" | "*) text="$(caption "${label%% | *}" 126)$(caption "${label#* | }" 186)" ;;
      *) text="$(caption "$label" 126)" ;;
    esac
  fi
  # The segment's length in frames, and with the crossfade's held frames (not for the last one).
  frames=$(awk "BEGIN{printf \"%d\", ($b-$a)/$sp*30 + $hold*30 + 0.5}")
  out=$frames; [ $((i + 1)) -lt "$n" ] && out=$(awk "BEGIN{printf \"%d\", $frames + $XFADE*30 + 0.5}")
  zp=""
  if [ "$zoom" != "1" ]; then
    # Scaled up 4x first so the slow zoom moves in quarter pixels and doesn't jitter.
    zp=",scale=7680:4320,zoompan=z='1+($zoom-1)*on/$out':x='iw/2-iw/zoom/2':y='ih/2-ih/zoom/2':d=1:s=1920x1080:fps=30"
  fi
  filters="$filters[$i:v]trim=start=$a:end=$b,setpts=(PTS-STARTPTS)/$sp,fps=30,scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=0xfbf8f1,setsar=1$text,tpad=stop_mode=clone:stop_duration=$(awk "BEGIN{print $hold+2}"),trim=end_frame=$out$zp,setpts=PTS-STARTPTS,fps=30[v$i];"
  # Crossfade from what's built so far into this segment, starting where this segment starts.
  if [ $i -gt 0 ]; then
    offset=$(awk "BEGIN{printf \"%.4f\", $total/30}")
    filters="$filters[$prev][v$i]xfade=transition=fade:duration=$XFADE:offset=$offset[x$i];"
    prev="x$i"
  else
    prev="v0"
  fi
  total=$((total + frames))
  i=$((i + 1))
done < segments.txt
rm segments.txt

labels=""
echo "$LABELS" | grep -v '^ *$' > labels.txt
while read -r t text; do labels="$labels$(label "$t" "$text")"; done < labels.txt
rm labels.txt

ffmpeg -v error -y $inputs -filter_complex "${filters}[$prev]null${labels}[out]" -map "[out]" \
  -c:v libx264 -pix_fmt yuv420p -crf 20 -preset medium -movflags +faststart rough-cut.mp4
echo "rough-cut.mp4: $(ffprobe -v error -show_entries format=duration -of csv=p=0 rough-cut.mp4) s (planned $(awk "BEGIN{print $total/30}") s)"
