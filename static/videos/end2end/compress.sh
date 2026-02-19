#!/usr/bin/env bash
set -euo pipefail

# ====== Settings ======
TARGET_MB=2              # target output size per video (approx)
AUDIO_K=128              # audio bitrate kbps (if audio exists)
MIN_VIDEO_K=180          # floor for video bitrate kbps (too low may break/looks awful)
PRESET="slow"

ENCODER="libx264"        # libx264 (best compatibility) or libx265 (smaller, slower)
USE_HVC1_TAG=0           # if ENCODER=libx265 and you want better Apple compatibility, set 1

# Optional "quality helpers" at low bitrate:
MAX_WIDTH=1920           # set 1280 for smaller files / easier to hit target
FPS=30                   # set 24 for smaller files

# Skip rules (keep or delete as you like)
SKIP_PREFIX="2x"         # skip files whose basename starts with "2x" (set to "" to disable)

log() { echo "[$(date +'%H:%M:%S')] $*"; }

hash_str() {
  # portable-ish hash helper for passlog filenames
  local s="$1"
  if command -v md5 >/dev/null 2>&1; then
    printf "%s" "$s" | md5 | awk '{print $1}'
  elif command -v md5sum >/dev/null 2>&1; then
    printf "%s" "$s" | md5sum | awk '{print $1}'
  elif command -v shasum >/dev/null 2>&1; then
    printf "%s" "$s" | shasum | awk '{print $1}'
  else
    # last resort: sanitized basename
    printf "%s" "$s" | tr -cd 'a-zA-Z0-9' | head -c 32
  fi
}

has_audio() {
  local in="$1"
  # returns 0 if has audio stream, 1 otherwise
  ffprobe -v error -select_streams a:0 -show_entries stream=codec_type \
    -of default=nw=1:nk=1 "$in" | grep -qi "audio"
}

get_duration() {
  local in="$1"
  ffprobe -v error -show_entries format=duration \
    -of default=nw=1:nk=1 "$in"
}

calc_bitrates() {
  # prints: "<total_k> <video_k> <audio_k>"
  local dur="$1" audio_k="$2"
  # total_k = TARGET_MB*8192/dur  (kbps)
  # video_k = max(total_k - audio_k, MIN_VIDEO_K)
  awk -v dur="$dur" -v mb="$TARGET_MB" -v ak="$audio_k" -v minvk="$MIN_VIDEO_K" '
    BEGIN{
      if (dur <= 0) { print "0 0 " ak; exit 0 }
      total = (mb * 8192.0) / dur
      video = total - ak
      if (video < minvk) video = minvk
      # round to int kbps
      printf "%d %d %d\n", int(total+0.5), int(video+0.5), int(ak+0.5)
    }'
}

one() {
  local in="$1"
  local dir base stem tmp dur audio_k total_k video_k passlog statsfile
  dir="$(dirname "$in")"
  base="$(basename "$in")"
  stem="${base%.*}"

  if [[ -n "$SKIP_PREFIX" && "$base" == "$SKIP_PREFIX"* ]]; then
    log "skip (name starts with $SKIP_PREFIX): $in"
    return 0
  fi

  # duration
  dur="$(get_duration "$in")"
  if ! awk -v d="$dur" 'BEGIN{ exit !(d>0.05) }'; then
    log "skip (bad duration): $in (dur=$dur)"
    return 0
  fi

  # audio bitrate decision
  if has_audio "$in"; then
    audio_k="$AUDIO_K"
  else
    audio_k=0
  fi

  read -r total_k video_k _ < <(calc_bitrates "$dur" "$audio_k")

  log "==> in-place: $in | dur=${dur}s target=${TARGET_MB}MB total≈${total_k}k video=${video_k}k audio=${audio_k}k enc=$ENCODER"

  # temp output (must NOT be same as input)
  tmp="${dir}/.${stem}.tmp.$$.$RANDOM.mp4"

  # per-file unique pass logs
  passlog="/tmp/ffpass_$(hash_str "$in").$$"
  statsfile="${passlog}.x265.log"

  cleanup() {
    rm -f "$tmp" \
      "${passlog}" "${passlog}.log" "${passlog}.log.mbtree" \
      "${statsfile}" "${statsfile}.cutree" \
      ffmpeg2pass-0.log ffmpeg2pass-0.log.mbtree \
      x265_2pass.log x265_2pass.log.temp x265_2pass.log.cutree 2>/dev/null || true
  }
  trap cleanup EXIT

  # Common filters
  # scale: keep aspect ratio, clamp width; ensure even dims with -2
  # fps: control frame rate for size
  local vf="scale='min(iw,${MAX_WIDTH})':-2,fps=${FPS},format=yuv420p"

  if [[ "$ENCODER" == "libx265" ]]; then
    # pass 1
    ffmpeg -nostdin -y -hide_banner -loglevel error \
      -i "$in" -map 0:v:0 -map '0:a:0?' \
      -vf "$vf" \
      -c:v libx265 -b:v "${video_k}k" -preset "$PRESET" \
      -x265-params "pass=1:stats=${statsfile}" \
      -an -f null /dev/null

    # pass 2
    ffmpeg -nostdin -y -hide_banner -loglevel error -stats \
      -i "$in" -map 0:v:0 -map '0:a:0?' \
      -vf "$vf" \
      -c:v libx265 -b:v "${video_k}k" -preset "$PRESET" \
      -x265-params "pass=2:stats=${statsfile}" \
      $([[ $USE_HVC1_TAG -eq 1 ]] && echo "-tag:v hvc1") \
      $( [[ "$audio_k" -gt 0 ]] && echo "-c:a aac -b:a ${audio_k}k" || echo "-an" ) \
      -movflags +faststart \
      "$tmp"
  else
    # pass 1
    ffmpeg -nostdin -y -hide_banner -loglevel error \
      -i "$in" -map 0:v:0 -map '0:a:0?' \
      -vf "$vf" \
      -c:v libx264 -b:v "${video_k}k" -preset "$PRESET" \
      -pass 1 -passlogfile "$passlog" \
      -an -f null /dev/null

    # pass 2
    ffmpeg -nostdin -y -hide_banner -loglevel error -stats \
      -i "$in" -map 0:v:0 -map '0:a:0?' \
      -vf "$vf" \
      -c:v libx264 -b:v "${video_k}k" -preset "$PRESET" \
      -pass 2 -passlogfile "$passlog" \
      $( [[ "$audio_k" -gt 0 ]] && echo "-c:a aac -b:a ${audio_k}k" || echo "-an" ) \
      -movflags +faststart \
      "$tmp"
  fi

  # overwrite original filename (no suffix)
  mv -f "$tmp" "$in"
  log "done: $in"

  # cleanup & untrap
  trap - EXIT
  cleanup
}

export -f log hash_str has_audio get_duration calc_bitrates one
export TARGET_MB AUDIO_K MIN_VIDEO_K PRESET ENCODER USE_HVC1_TAG MAX_WIDTH FPS SKIP_PREFIX

# Process all mp4 recursively
while IFS= read -r -d '' f; do
  one "$f"
done < <(find . -type f -iname "*.mp4" -print0)

log "All done."
