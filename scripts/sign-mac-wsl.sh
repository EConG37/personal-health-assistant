#!/bin/sh
set -eu
workspace=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
tools=$(mktemp -d /run/health-mac-tools.XXXXXX)
tar -xzf "$workspace/build/mac-runtime/apple-codesign-0.29.0-x86_64-unknown-linux-musl.tar.gz" -C "$tools"
tool="$tools/apple-codesign-0.29.0-x86_64-unknown-linux-musl/rcodesign"
stage=$(mktemp -d /run/health-mac-build.XXXXXX)
entitlements="$workspace/node_modules/app-builder-lib/templates/entitlements.mac.plist"
for arch in arm64 x64; do
  mkdir -p "$stage/$arch"
  unzip -q "$workspace/build/mac-runtime/health-unsigned-$arch.zip" -d "$stage/$arch"
  app="$stage/$arch/个人健康助手.app"
  test -e "$app/Contents/Frameworks/Electron Framework.framework/Electron Framework"
  "$tool" sign --config-file /dev/null --timestamp-url none --code-signature-flags runtime --entitlements-xml-file "$entitlements" "$app"
  # rcodesign 0.29 documents its own verify command as unreliable for ad-hoc
  # CMS blobs. Final packaging independently verifies Mach-O code-page hashes.
  tar -czf "$workspace/build/mac-runtime/health-signed-$arch.tar.gz" -C "$stage/$arch" '个人健康助手.app'
  echo "Local ad-hoc signing completed: $arch; hash checks follow; no Apple notarization or Mac runtime test."
  case "$stage/$arch" in /run/health-mac-build.*/arm64|/run/health-mac-build.*/x64) rm -rf -- "$stage/$arch" ;; *) exit 1 ;; esac
done
