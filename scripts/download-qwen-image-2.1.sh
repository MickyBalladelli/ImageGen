#!/usr/bin/env bash
# Download official Qwen-Image 2.1 weights without loading or running the model.
# Source: https://huggingface.co/Qwen/Qwen-Image-2.1
# Download API: https://huggingface.co/docs/huggingface_hub/guides/cli
set -euo pipefail

usage() {
  cat <<'HELP'
Usage: bash scripts/download-qwen-image-2.1.sh [options]

Downloads Qwen/Qwen-Image-2.1 into the Hugging Face cache used by MFLUX.
Expect roughly 33 GB of original weights; allow extra disk space for downloads.
Re-running reuses cached files and lets Hugging Face resume incomplete transfers.

Options:
  --cache-dir PATH   Override the Hugging Face hub cache directory.
  --revision REF     Download a specific commit, tag, or branch (default: main).
  -h, --help         Show this help without installing or downloading anything.

Requires uv. The script runs the Hugging Face CLI in an isolated uv environment.
It does not install MFLUX/ComfyUI, download an Ollama model, generate an image,
change ImageGen configuration, or accept gated-model terms on your behalf.
The model is distributed under the Qwen Research License; review its model page.
HELP
}

fail() { printf 'Error: %s\n' "$*" >&2; exit 1; }
HF_ROOT="${HF_HOME:-${XDG_CACHE_HOME:-$HOME/.cache}/huggingface}"
CACHE_DIR="${HF_HUB_CACHE:-${HUGGINGFACE_HUB_CACHE:-$HF_ROOT/hub}}"
REVISION="main"
while [[ $# -gt 0 ]]; do
  case "$1" in
    --cache-dir|--revision)
      [[ $# -ge 2 && -n "$2" && "$2" != --* ]] || fail "$1 requires a value."
      if [[ "$1" == --cache-dir ]]; then CACHE_DIR="$2"; else REVISION="$2"; fi
      shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) fail "Unknown option: $1. Use --help for usage." ;;
  esac
done

UV="$(command -v uv || true)"
if [[ -z "$UV" && -x "$HOME/.local/bin/uv" ]]; then UV="$HOME/.local/bin/uv"; fi
[[ -n "$UV" ]] || fail 'uv is required. Install it from https://docs.astral.sh/uv/getting-started/installation/ and rerun.'
mkdir -p -- "$CACHE_DIR"
CACHE_DIR="$(cd -- "$CACHE_DIR" && pwd -P)"
[[ -w "$CACHE_DIR" ]] || fail "Cache directory is not writable: $CACHE_DIR"

printf 'Model: Qwen/Qwen-Image-2.1\nRevision: %s\nCache: %s\n' "$REVISION" "$CACHE_DIR"
printf 'Disk space on the cache volume:\n'
df -h "$CACHE_DIR"
printf '\nDownloading original model files only (approximately 33 GB on a fresh cache).\n'
printf 'Quantization happens later in MFLUX; it does not reduce this download.\n'
printf 'Press Ctrl+C to stop; rerun the same command to continue.\n\n'

export HF_HUB_DOWNLOAD_TIMEOUT="${HF_HUB_DOWNLOAD_TIMEOUT:-60}"
export HF_HUB_DISABLE_TELEMETRY=1
trap 'printf "\nInterrupted. Cached files were kept; rerun to continue.\n" >&2; exit 130' INT
trap 'printf "\nStopped. Cached files were kept; rerun to continue.\n" >&2; exit 143' TERM

if "$UV" tool run --from 'huggingface-hub>=1.0,<2' hf download \
  'Qwen/Qwen-Image-2.1' --revision "$REVISION" --cache-dir "$CACHE_DIR"; then
  printf '\nDownload complete. No model was loaded or run.\n'
  printf 'To use this same cache when running MFLUX:\nexport HF_HUB_CACHE=%q\n' "$CACHE_DIR"
else
  status=$?
  printf '\nDownload failed (exit %s). Existing cached files were kept.\n' "$status" >&2
  printf 'Check the error above for disk space, network, or access issues, then rerun.\n' >&2
  printf 'If access is gated, review the model page and authenticate with: uv tool run --from huggingface-hub hf auth login\n' >&2
  exit "$status"
fi
