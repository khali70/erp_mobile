#!/usr/bin/env bash
#
# brand-assets.sh — turn whatever Gemini hands back into the exact asset set
# this app needs. Uses ffmpeg + sips only (no ImageMagick required).
#
#   ./scripts/brand-assets.sh all <icon-on-flat-bg.png>
#
# Sub-commands (run individually if you want to tweak one asset):
#   square   <in> <out>                     center-crop to 1:1
#   keyout   <in> <out> [hex] [sim] [blend] flat background -> transparent
#   trim     <in> <out>                     autocrop to the mark's bounding box
#   fit      <in> <out> <canvas> <pct> [bg] scale mark to <pct>% and pad to canvas
#   mono     <in> <out>                     black silhouette, alpha preserved
#   flatten  <in> <out> <hex>               composite alpha onto a solid color
#   info     <in>                           dimensions + alpha check
#
set -euo pipefail

BRAND_BG="0xE6F5F3"   # soft teal — adaptive icon background
BRAND_TEAL="0x0E7569"
OUT_DIR="${OUT_DIR:-assets}"

# KEY=none  -> source already has a real alpha channel, skip the chroma-key pass.
#              Required for sources that already carry transparency: keying
#              #E6F5F3 out of those would eat a legitimately light-colored plate.
# KEY=0x.... -> override the background color to key out.
KEY="${KEY:-$BRAND_BG}"

die() { echo "error: $*" >&2; exit 1; }
need() { command -v "$1" >/dev/null || die "missing '$1'"; }
need ffmpeg
need ffprobe

# ---------------------------------------------------------------- primitives

info() {
  ffprobe -v error -select_streams v:0 \
    -show_entries stream=width,height,pix_fmt -of csv=p=0 "$1"
}

# center-crop to a square using the shorter side, then it is safe to scale
square() {
  ffmpeg -v error -y -i "$1" \
    -vf "crop='min(iw,ih)':'min(iw,ih)',format=rgba" "$2"
}

# flat background -> alpha. sim=how far from the key color counts as background,
# blend=softness of the edge (keeps anti-aliasing from turning into a hard jaggy).
keyout() {
  local in=$1 out=$2 hex=${3:-$BRAND_BG} sim=${4:-0.16} blend=${5:-0.04}
  ffmpeg -v error -y -i "$in" \
    -vf "format=rgba,colorkey=${hex}:${sim}:${blend}" "$out"
}

# autocrop transparent margins so the mark's real bounding box is known
trim() {
  local in=$1 out=$2
  # alphaextract turns alpha into luma so cropdetect can see the mark
  local crop
  # cropdetect reports on the info log stream, so this pass must not be quiet
  crop=$(ffmpeg -v info -i "$in" \
      -vf "format=rgba,alphaextract,cropdetect=limit=1:round=1:reset=0:skip=0" \
      -frames:v 1 -f null - 2>&1 |
    grep -o 'crop=[0-9:]*' | tail -1) || true
  [ -n "${crop:-}" ] || die "trim: cropdetect found nothing (is the image fully transparent?)"
  ffmpeg -v error -y -i "$in" -vf "format=rgba,${crop}" "$out"
}

# scale the (already trimmed) mark so its longest side is <pct>% of <canvas>,
# then pad out to a square canvas. bg defaults to transparent.
fit() {
  local in=$1 out=$2 canvas=$3 pct=$4 bg=${5:-0x00000000}
  local box=$(( canvas * pct / 100 ))
  ffmpeg -v error -y -i "$in" -vf \
    "format=rgba,scale=w=${box}:h=${box}:force_original_aspect_ratio=decrease:flags=lanczos,\
pad=${canvas}:${canvas}:(ow-iw)/2:(oh-ih)/2:color=${bg}" \
    "$out"
}

# flatten alpha onto a solid color (Play Store icon must have no alpha)
flatten() {
  local in=$1 out=$2 hex=${3:-$BRAND_BG}
  ffmpeg -v error -y -i "$in" -vf \
    "format=rgba,split[a][b];[a]drawbox=color=${hex}:t=fill[bg];[bg][b]overlay,format=rgb24" \
    "$out"
}

# recolor every pixel to r,g,b while keeping the existing alpha mask
tint() {
  local in=$1 out=$2 r=$3 g=$4 b=$5
  ffmpeg -v error -y -i "$in" -vf \
    "format=rgba,geq=r=${r}:g=${g}:b=${b}:a='alpha(X,Y)'" "$out"
}

# every opaque pixel -> pure black, alpha untouched
mono() { tint "$1" "$2" 0 0 0; }

# arbitrary WxH (feature graphic): mark centered on brand teal.
# Must composite with overlay, not pad+format=rgb24 — dropping alpha on a keyed
# image resurrects the original background color under the transparent pixels.
banner() {
  local in=$1 out=$2 w=$3 h=$4 bg=${5:-$BRAND_TEAL}
  ffmpeg -v error -y -i "$in" -f lavfi -i "color=c=${bg}:s=${w}x${h}" \
    -filter_complex \
    "[0]format=rgba,scale=w=-1:h=$(( h * 55 / 100 )):flags=lanczos[m];\
[1][m]overlay=(W-w)/2:(H-h)/2:format=auto,format=rgb24" \
    -frames:v 1 "$out"
}

# ---------------------------------------------------------------- pipeline

tmp=""
cleanup() { [ -n "$tmp" ] && rm -rf "$tmp"; return 0; }
trap cleanup EXIT

all() {
  local src=${1:-}
  [ -n "$src" ] || die "usage: $0 all <source.png>"
  [ -f "$src" ] || die "no such file: $src"
  mkdir -p "$OUT_DIR"
  tmp=$(mktemp -d)

  echo "source: $(info "$src")"

  if [ "$KEY" = "none" ]; then
    # Source is already a bare mark on alpha. Do NOT center-crop to square — that
    # would slice the caps off a wider-than-tall mark. trim + fit handle framing.
    echo "key:    skipped (source already has alpha)"
    cp "$src" "$tmp/cut.png"
  else
    square "$src" "$tmp/sq.png"
    keyout "$tmp/sq.png" "$tmp/cut.png" "$KEY"
  fi
  trim "$tmp/cut.png" "$tmp/mark.png"
  echo "mark:   $(info "$tmp/mark.png")"

  # adaptive foreground — mark inside the centre 60% safe zone
  fit "$tmp/mark.png" "$OUT_DIR/android-icon-foreground.png" 1024 60

  # solid background plate
  ffmpeg -v error -y -f lavfi -i "color=c=${BRAND_BG}:s=1024x1024" \
    -frames:v 1 "$OUT_DIR/android-icon-background.png"

  # themed-icon silhouette
  mono "$OUT_DIR/android-icon-foreground.png" "$OUT_DIR/android-icon-monochrome.png"

  # splash — mark at 45% on transparent
  fit "$tmp/mark.png" "$OUT_DIR/splash-icon.png" 1024 45

  # legacy launcher icon — 64% mark on the brand plate
  fit "$tmp/mark.png" "$tmp/icon-a.png" 1024 64
  flatten "$tmp/icon-a.png" "$OUT_DIR/icon.png" "$BRAND_BG"

  # web favicon
  fit "$tmp/mark.png" "$tmp/fav.png" 512 64
  flatten "$tmp/fav.png" "$OUT_DIR/favicon.png" "$BRAND_BG"

  # Play Store listing assets (not bundled in the app)
  mkdir -p docs/branding/play
  fit "$tmp/mark.png" "$tmp/play.png" 512 64
  flatten "$tmp/play.png" "docs/branding/play/icon-512.png" "$BRAND_BG"
  # feature graphic sits on brand teal, so the mark goes white — a teal mark on a
  # teal plate is invisible
  tint "$tmp/mark.png" "$tmp/mark-white.png" 255 255 255
  banner "$tmp/mark-white.png" "docs/branding/play/feature-graphic-1024x500.png" 1024 500

  echo
  echo "written:"
  for f in "$OUT_DIR"/icon.png "$OUT_DIR"/android-icon-foreground.png \
           "$OUT_DIR"/android-icon-background.png "$OUT_DIR"/android-icon-monochrome.png \
           "$OUT_DIR"/splash-icon.png "$OUT_DIR"/favicon.png \
           docs/branding/play/icon-512.png docs/branding/play/feature-graphic-1024x500.png; do
    printf '  %-52s %s\n' "$f" "$(info "$f")"
  done
}

cmd=${1:-all}; shift || true
case "$cmd" in
  all|square|keyout|trim|fit|mono|flatten|banner|info) "$cmd" "$@" ;;
  *) die "unknown command: $cmd" ;;
esac
