#!/usr/bin/env bash
# Creates the Android upload key and android/keystore.properties (both git-ignored).
# Needs a JDK (keytool). Run once from the mobile/ folder:  bash scripts/create-upload-key.sh
# KEEP BOTH FILES SAFE (password manager plus an offline copy). With Play App Signing a lost upload key can be reset
# through Play support, but it takes days.
set -euo pipefail
cd "$(dirname "$0")/.."
KEYSTORE="android/sheplates-upload.jks"
ALIAS="sheplates-upload"
if [ -f "$KEYSTORE" ]; then echo "$KEYSTORE already exists. Not overwriting."; exit 1; fi
command -v keytool >/dev/null || { echo "keytool not found. Install a JDK 21 first."; exit 1; }
PASS="$(openssl rand -hex 16)"
keytool -genkeypair -v -storetype JKS -keystore "$KEYSTORE" -alias "$ALIAS" -keyalg RSA -keysize 2048 -validity 10000 \
  -storepass "$PASS" -keypass "$PASS" -dname "CN=ShePlates, OU=Mobile, O=ShePlates, L=Coimbatore, ST=Tamil Nadu, C=IN" >/dev/null
umask 077
cat > android/keystore.properties <<PROPS
storeFile=sheplates-upload.jks
storePassword=$PASS
keyAlias=$ALIAS
keyPassword=$PASS
PROPS
echo "Created $KEYSTORE and android/keystore.properties. Back both up now."
echo "For CI, store the keystore as a base64 secret:  base64 -i $KEYSTORE | pbcopy"
