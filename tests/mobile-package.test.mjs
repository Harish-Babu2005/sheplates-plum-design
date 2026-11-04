import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const read = (file) => readFile(path.join(root, file), "utf8");
const pngSize = async (file) => { const b = await readFile(path.join(root, file)); assert.equal(b.toString("ascii", 1, 4), "PNG", `${file} is a PNG`); return [b.readUInt32BE(16), b.readUInt32BE(20)]; };

test("both apps use one app id, the hosted address and portrait phone settings", async () => {
  const config = await read("mobile/capacitor.config.ts");
  assert.match(config, /appId: "com\.sheplates\.app"/);
  assert.match(config, /url: "https:\/\/app\.sheplates\.com"/);
  assert.match(config, /errorPath: "offline\.html"/);
  assert.match(config, /allowNavigation:[^\]]*razorpay/);
  assert.match(await read("mobile/android/app/build.gradle"), /applicationId "com\.sheplates\.app"/);
  assert.match(await read("mobile/android/app/src/main/res/values/strings.xml"), /<string name="app_name">ShePlates<\/string>/);
  const pbx = await read("mobile/ios/App/App.xcodeproj/project.pbxproj");
  assert.equal((pbx.match(/PRODUCT_BUNDLE_IDENTIFIER = com\.sheplates\.app;/g) || []).length, 2, "debug and release");
  assert.equal((pbx.match(/TARGETED_DEVICE_FAMILY = 1;/g) || []).length, 2, "iPhone only");
  assert.doesNotMatch(pbx, /TARGETED_DEVICE_FAMILY = "1,2"/);
  assert.match(pbx, /PrivacyInfo\.xcprivacy in Resources/);
});

test("Android declares only the permissions the app uses and keeps secrets out of git", async () => {
  const manifest = await read("mobile/android/app/src/main/AndroidManifest.xml");
  const permissions = [...manifest.matchAll(/uses-permission android:name="android\.permission\.(\w+)"/g)].map((m) => m[1]).sort();
  assert.deepEqual(permissions, ["ACCESS_COARSE_LOCATION", "ACCESS_FINE_LOCATION", "CAMERA", "INTERNET"]);
  assert.match(manifest, /usesCleartextTraffic="false"/);
  assert.match(manifest, /screenOrientation="portrait"/);
  const gradle = await read("mobile/android/app/build.gradle");
  assert.match(gradle, /keystore\.properties/);
  assert.match(gradle, /ANDROID_KEYSTORE_FILE/);
  assert.match(gradle, /signingConfigs\.release/);
  const ignore = await read("mobile/.gitignore");
  for (const pattern of ["*.jks", "*.keystore", "keystore.properties", "*.p12", "*.mobileprovision", "AuthKey_*.p8"]) assert.ok(ignore.includes(pattern), pattern);
  // Only files git tracks matter here: the key made by create-upload-key.sh lives in android/ but is ignored.
  const tracked = execFileSync("git", ["ls-files", "mobile"], { cwd: root, encoding: "utf8" }).split("\n").filter(Boolean);
  const secrets = tracked.filter((f) => /\.(jks|keystore|p12|mobileprovision|p8)$/.test(f) || path.basename(f) === "keystore.properties");
  assert.deepEqual(secrets, [], "no signing material is tracked by git");
});

test("iPhone has the permission texts, export compliance, privacy manifest and UPI schemes", async () => {
  const plist = await read("mobile/ios/App/App/Info.plist");
  for (const key of ["NSLocationWhenInUseUsageDescription", "NSCameraUsageDescription", "NSMicrophoneUsageDescription", "NSPhotoLibraryUsageDescription", "ITSAppUsesNonExemptEncryption", "LSApplicationQueriesSchemes"]) assert.ok(plist.includes(key), key);
  assert.doesNotMatch(plist, /UIInterfaceOrientationLandscape/, "portrait only");
  assert.match(plist, /<string>phonepe<\/string>/);
  const privacy = await read("mobile/ios/App/App/PrivacyInfo.xcprivacy");
  assert.match(privacy, /NSPrivacyTracking<\/key>\s*<false\/>/);
  assert.match(privacy, /NSPrivacyCollectedDataTypePreciseLocation/);
});

test("icons, splash and store artwork exist at the sizes the stores require", async () => {
  assert.deepEqual(await pngSize("mobile/resources/icon-only.png"), [1024, 1024]);
  assert.deepEqual(await pngSize("mobile/store-assets/ios-app-store-icon-1024.png"), [1024, 1024]);
  assert.deepEqual(await pngSize("mobile/store-assets/play-store/icon-512.png"), [512, 512]);
  assert.deepEqual(await pngSize("mobile/store-assets/play-store/feature-graphic-1024x500.png"), [1024, 500]);
  const iosShots = (await readdir(path.join(root, "mobile/store-assets/ios-iphone-6.7in"))).filter((f) => f.endsWith(".png"));
  const androidShots = (await readdir(path.join(root, "mobile/store-assets/android-phone"))).filter((f) => f.endsWith(".png"));
  assert.ok(iosShots.length >= 2 && iosShots.length <= 10, "App Store takes 2 to 10 screenshots");
  assert.ok(androidShots.length >= 2 && androidShots.length <= 8, "Play takes 2 to 8 phone screenshots");
  for (const f of iosShots) assert.deepEqual(await pngSize(`mobile/store-assets/ios-iphone-6.7in/${f}`), [1290, 2796], f);
  for (const f of androidShots) assert.deepEqual(await pngSize(`mobile/store-assets/android-phone/${f}`), [1080, 2400], f);
  const adaptive = await stat(path.join(root, "mobile/android/app/src/main/res/mipmap-anydpi-v26/ic_launcher.xml"));
  assert.ok(adaptive.size > 0, "adaptive launcher icon generated");
  assert.ok((await stat(path.join(root, "mobile/ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png"))).size > 0);
});

test("the offline screen retries the hosted app, and the release workflows and guide are in place", async () => {
  const offline = await read("mobile/www/offline.html");
  assert.match(offline, /https:\/\/app\.sheplates\.com/);
  assert.match(offline, /id="retry"/);
  assert.match(offline, /prefers|viewport-fit=cover/);
  const android = await read(".github/workflows/mobile-android.yml");
  assert.match(android, /bundleRelease/);
  assert.match(android, /upload-artifact/);
  const ios = await read(".github/workflows/mobile-ios.yml");
  assert.match(ios, /xcodebuild archive/);
  assert.match(ios, /exportArchive/);
  assert.match(await read("mobile/ios/ExportOptions.plist"), /app-store-connect/);
  const verify = await read(".github/workflows/mobile-ios-verify.yml");
  assert.match(verify, /CODE_SIGNING_ALLOWED=NO/);
  assert.match(verify, /-sdk iphoneos/);
  assert.match(verify, /-sdk iphonesimulator/);
  const guide = await read("mobile/STORE-RELEASE.md");
  for (const topic of ["Privacy Policy", "account deletion", "Data safety", "App Privacy", "com.sheplates.app", "Review notes"]) assert.ok(guide.toLowerCase().includes(topic.toLowerCase()), topic);
});
