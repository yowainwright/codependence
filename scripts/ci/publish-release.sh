#!/usr/bin/env bash

set -euo pipefail

resolve_dist_tag() {
  local version="${VERSION:-}"

  if [[ "$version" =~ -(alpha|beta|rc) ]]; then
    echo "tag=${BASH_REMATCH[1]}" >> "$GITHUB_OUTPUT"
  else
    echo "tag=latest" >> "$GITHUB_OUTPUT"
  fi
}

pack_tarball() {
  npm pack --ignore-scripts --json > npm-pack.json

  local tarball
  tarball="$(
    node -e "
      const fs = require('node:fs');
      const text = fs.readFileSync('npm-pack.json', 'utf8');
      const start = text.indexOf('[');
      if (start < 0) throw new Error('npm pack JSON output not found');
      const [pkg] = JSON.parse(text.slice(start));
      console.log(pkg.filename);
    "
  )"

  test -n "$tarball"
  echo "tarball=$tarball" >> "$GITHUB_OUTPUT"
}

prepare_attestation() {
  local tarball="${TARBALL:-}"
  local bundle_path="${ATTESTATION_BUNDLE_PATH:-}"

  if [ -z "$tarball" ] || [ -z "$bundle_path" ]; then
    echo "TARBALL and ATTESTATION_BUNDLE_PATH are required" >&2
    exit 1
  fi

  local sigstore_bundle="${tarball}.sigstore.json"
  cp "$bundle_path" "$sigstore_bundle"
  echo "sigstore_bundle=$sigstore_bundle" >> "$GITHUB_OUTPUT"
}

publish_npm() {
  local package_version="${PACKAGE_VERSION:-}"
  local tarball="${TARBALL:-}"
  local dist_tag="${DIST_TAG:-}"

  if [ -z "$package_version" ] || [ -z "$tarball" ] || [ -z "$dist_tag" ]; then
    echo "PACKAGE_VERSION, TARBALL, and DIST_TAG are required" >&2
    exit 1
  fi

  local version="${package_version#v}"
  if npm view "codependence@$version" version > /dev/null 2>&1; then
    echo "codependence@$version is already published"
    return 0
  fi

  npm publish "$tarball" --provenance --access public --tag "$dist_tag"
}

publish_github_release_assets() {
  local version="${VERSION:-}"
  local tarball="${TARBALL:-}"
  local sigstore_bundle="${SIGSTORE_BUNDLE:-}"

  if [ -z "$version" ] || [ -z "$tarball" ] || [ -z "$sigstore_bundle" ]; then
    echo "VERSION, TARBALL, and SIGSTORE_BUNDLE are required" >&2
    exit 1
  fi

  local release_args=()
  if [[ "$version" =~ -(alpha|beta|rc) ]]; then
    release_args+=(--prerelease)
  fi

  if gh release view "$version" > /dev/null 2>&1; then
    gh release upload "$version" "$tarball" "$sigstore_bundle" --clobber
    return 0
  fi

  gh release create "$version" "$tarball" "$sigstore_bundle" \
    --title "$version" \
    --generate-notes \
    "${release_args[@]}"
}

case "${1:-}" in
  resolve-dist-tag)
    resolve_dist_tag
    ;;
  pack)
    pack_tarball
    ;;
  prepare-attestation)
    prepare_attestation
    ;;
  publish-npm)
    publish_npm
    ;;
  publish-github-release-assets)
    publish_github_release_assets
    ;;
  *)
    echo "Usage: $0 {resolve-dist-tag|pack|prepare-attestation|publish-npm|publish-github-release-assets}" >&2
    exit 2
    ;;
esac
