#!/bin/bash
# Cuts the teaser from the recorded gameplay clips in assets/trailer/raw and lays the text cards over it.
# Run from the repo root: bash tools/trailer.sh   (needs ffmpeg). Writes assets/trailer/cut.mp4 (no sound).
set -e
R=assets/trailer/raw; W=assets/trailer/work; mkdir -p $W; : > $W/list.txt
# clip, start second, length, text card (or -)
SEGS="t-hero 0.6 3.6 card-1
t-start 0.4 2.8 -
t-chase 2.2 2.8 -
t-side 1.4 3.0 card-2
t-drone 1.2 2.4 -
t-front 0.6 2.0 -
t-giant 0.9 3.4 card-3
t-fire 1.6 3.0 card-4
t-firefront 1.0 2.2 -
t-firedrone 1.0 2.2 -
t-fireside 0.4 2.6 -
t-fire 6.0 3.4 card-end"
n=0
echo "$SEGS" | while read clip start len card; do
  n=$((n+1)); out=$W/seg$(printf %02d $n).mp4
  base="[0:v]fps=30,scale=1920:1080:flags=lanczos,setsar=1"
  if [ "$card" = "-" ]; then
    ffmpeg -v error -y -i $R/$clip.webm -ss $start -t $len -filter_complex "$base[v]" -map "[v]" -an -c:v libx264 -preset medium -crf 17 -pix_fmt yuv420p $out < /dev/null
  else
    end=$(python3 -c "print($len-0.55)")
    ffmpeg -v error -y -i $R/$clip.webm -loop 1 -i $R/$card.png -ss $start -t $len -filter_complex "$base[v];[1:v]format=rgba,fade=in:st=$(python3 -c "print($start+0.35)"):d=0.45:alpha=1,fade=out:st=$(python3 -c "print($start+$end)"):d=0.45:alpha=1[c];[v][c]overlay=0:0:shortest=1[o]" -map "[o]" -an -c:v libx264 -preset medium -crf 17 -pix_fmt yuv420p $out < /dev/null
  fi
  echo "file 'seg$(printf %02d $n).mp4'" >> $W/list.txt; echo "seg $n $clip"
done
ffmpeg -v error -y -f concat -safe 0 -i $W/list.txt -c copy $W/joined.mp4
D=$(ffprobe -v error -show_entries format=duration -of csv=p=0 $W/joined.mp4)
ffmpeg -v error -y -i $W/joined.mp4 -vf "fade=in:st=0:d=0.5,fade=out:st=$(python3 -c "print($D-0.7)"):d=0.7" -an -c:v libx264 -preset medium -crf 21 -pix_fmt yuv420p -movflags +faststart assets/trailer/cut.mp4
echo "cut.mp4 $D s"
