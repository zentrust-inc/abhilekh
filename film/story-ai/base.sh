#!/bin/bash
# Build the 80 s, 30 fps background track from the Canva AI clips (no audio).
set -e
C=/home/claude/ai/clips; O=/home/claude/ai/comp/seg; mkdir -p $O
ENC="-an -c:v libx264 -preset veryfast -crf 17 -pix_fmt yuv420p -r 30"
FIT="scale=1920:-2:flags=lanczos,crop=1920:1080"
seg(){ # name src ss to k dur extra mci
  local n=$1 s=$2 ss=$3 to=$4 k=$5 d=$6 x=$7 m=$8
  local mi=""; [ "$m" = 1 ] && mi=",minterpolate=fps=30:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1"
  [ -f $O/$n.mp4 ] && return
  ffmpeg -v error -y -ss $ss -to $to -i $C/$s.mp4 -vf "$FIT,setpts=$k*(PTS-STARTPTS)$mi,fps=30,tpad=stop_mode=clone:stop_duration=1,trim=duration=$d,setpts=PTS-STARTPTS$x" $ENC $O/$n.tmp.mp4
  mv $O/$n.tmp.mp4 $O/$n.mp4
}
seg 01A A 0 5.184 1.466 7.6 ",fade=in:st=0:d=0.8" 1
seg 02B B 0 5.216 1.035 5.4 ""
seg 03C C 0.4 4.8 0.909 4.0 ""
seg 04D D 1.0 5.216 0.95 4.0 ""
seg 05E E 0 5.216 2.03 10.6 "" 1
# reader UI sits over a soft, dim, reversed E
if [ ! -f $O/06E2.mp4 ]; then
ffmpeg -v error -y -i $O/05E.mp4 -vf "reverse,tpad=stop_mode=clone:stop_duration=1,trim=duration=10.9,setpts=PTS-STARTPTS,gblur=sigma=22,eq=brightness=-0.10:saturation=0.8,fade=in:st=0:d=0.5:color=black@0" $ENC $O/06E2.tmp.mp4 && mv $O/06E2.tmp.mp4 $O/06E2.mp4
fi
seg 07G G 0 5.216 1.208 6.3 ""
seg 08H H 0.3 5.216 0.997 4.9 ""
seg 09I I 0 5.216 1.284 6.7 ",gblur=sigma=7,eq=brightness=-0.08:saturation=0.85"
seg 10J J 0 5.216 1.112 5.8 ""
# K then dissolve into the v3 end card (71-80)
if [ ! -f $O/11K.mp4 ]; then
ffmpeg -v error -y -ss 0 -to 5.216 -i $C/K.mp4 -ss 70.5 -to 80 -i /home/claude/film3/story-v3-1080p60.mp4 -filter_complex \
"[0:v]$FIT,setpts=PTS-STARTPTS,fps=30,tpad=stop_mode=clone:stop_duration=1,trim=duration=5.3,setpts=PTS-STARTPTS[k];[1:v]fps=30,setpts=PTS-STARTPTS[e];[k][e]xfade=transition=fade:duration=0.7:offset=4.6,trim=duration=14,setpts=PTS-STARTPTS[v]" \
-map "[v]" $ENC $O/11K.tmp.mp4 && mv $O/11K.tmp.mp4 $O/11K.mp4
fi
ls $O/*.mp4 | sort | sed "s/.*/file '&'/" > $O/list.txt
ffmpeg -v error -y -f concat -safe 0 -i $O/list.txt -c copy /home/claude/ai/comp/base.mp4
ffprobe -v error -show_entries format=duration -of csv=p=0 /home/claude/ai/comp/base.mp4
