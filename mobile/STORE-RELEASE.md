# ShePlates for Android and iPhone: release guide

The apps are a native shell (Capacitor 8) around the hosted product at **https://app.sheplates.com**. The screens,
features and look are the website's, so every web release reaches both apps without a store update. A new store build is
only needed when something native changes (icon, permissions, plugins, version number).

| | Android | iPhone |
|---|---|---|
| Bundle / package id | `com.sheplates.app` | `com.sheplates.app` |
| Display name | ShePlates | ShePlates |
| Version | 1.0.0 (code 1) | 1.0.0 (build 1) |
| Minimum OS | Android 7 (API 24), target API 36 | iOS 15 |
| Devices | phones, portrait | iPhone only, portrait |
| Project | `mobile/android` | `mobile/ios/App/App.xcodeproj` |

Change the id before the first upload if you want a different one. It cannot be changed afterwards.
Search for `com.sheplates.app` in `capacitor.config.ts`, `android/app/build.gradle`, `android/app/src/main/res/values/strings.xml` and the Xcode project.

---

## 0. Fix these before you submit (both stores will reject without them)

1. **Public Privacy Policy and Terms pages.** Both stores need a web address for the privacy policy, and the app footer
   currently shows "Terms and Conditions" and "Privacy Policy" as plain text, not links. Publish the approved texts
   (Vendor Agreement, T&C and Privacy Policy dated 26 Oct 2026) at, for example, `https://app.sheplates.com/privacy`
   and `/terms`, and link them from the footer.
2. **In-app account deletion.** Apple (guideline 5.1.1(v)) and Google Play both require users who can create an account
   to be able to delete it from inside the app, and Google also asks for a deletion web address. The app has no
   "Delete my account" yet. It needs a server route (service-role delete of the auth user and their data) and a button in Profile.
3. **Reviewer test accounts.** Reviewers cannot use the `*.demo` accounts, which exist only in demo mode. Create a real
   customer, vendor and (optional) Operations account on the live site and put the credentials in the review notes.
4. **User-generated content rules (Apple 1.2).** Stories, Food Shorts and Find people let users post content. Apple expects
   a way to report content (present), a way to block an abusive user (confirm it exists), moderation (the Stories monitor)
   and published contact details (present in the footer).
5. **Payments.** Food orders are physical goods, so Razorpay is allowed without in-app purchase. Test a real UPI payment on a
   real phone for both stores. The vendor subscription plans are a business service sold to vendors; if Apple questions
   them (guideline 3.1), the fallback is to take plan payments on the web only.
6. **Apple "minimum functionality" (guideline 4.2).** A shell around a website is the most common reason for rejection.
   This one adds a native splash, offline screen, permissions, portrait lock and safe-area handling, but if Apple pushes back
   the usual fix is native push notifications for order updates and a native share sheet. Plan for one round of review.

---

## 1. What is in this folder

```
mobile/
  capacitor.config.ts          app id, name, hosted address, allowed hosts, splash and system bar settings
  www/offline.html             branded "You're offline" screen shown when the hosted app cannot load
  android/                     Android Studio project (permissions, signing, versioning already set)
  ios/App/App.xcodeproj        Xcode project (permissions text, privacy manifest, iPhone only, portrait)
  resources/                   source icon, adaptive icon layers and splash artwork
  store-assets/
    play-store/                icon-512.png and feature-graphic-1024x500.png
    android-phone/             7 screenshots, 1080 x 2400
    ios-iphone-6.7in/          7 screenshots, 1290 x 2796 (use for the 6.7-inch and 6.9-inch slots)
    ios-app-store-icon-1024.png
  scripts/create-upload-key.sh creates the Android upload key
../.github/workflows/          mobile-android.yml, mobile-ios.yml (signed builds) and mobile-ios-verify.yml (unsigned compile check)
```

Artwork note: the icons and splash use the current logo on peacock teal. Replace `resources/icon-only.png`,
`icon-foreground.png`, `splash.png` when the designer's new logo arrives, then run `npm run assets` and `npx cap sync`.

---

## 2. Android (Google Play)

**Accounts:** a Google Play Console developer account (one-time US$25). New personal accounts must run a closed test with
at least 12 testers for 14 days before production. Organisation accounts are exempt.

**Build the bundle, either way:**

*In the cloud (no tools needed):* push the repository to GitHub, open **Actions > Android release bundle > Run workflow**.
Download `sheplates-android-release` (the `.aab`). To sign it, first create the key (below) and add the four secrets named at
the top of the workflow file. Without them you get an unsigned bundle, good only for checking that it builds.

*On your computer:* install JDK 21 and the Android SDK (Android Studio does both), then
```bash
cd mobile
npm ci
bash scripts/create-upload-key.sh     # once; creates android/keystore.properties and the .jks (back them up)
npx cap sync android
cd android && ./gradlew bundleRelease
# result: android/app/build/outputs/bundle/release/app-release.aab
```

**Upload:** Play Console > Create app (name ShePlates, App, Free) > Production (or Internal/Closed testing) > Create release,
turn on **Play App Signing**, upload the `.aab`.

**Store listing:** text below; icon `store-assets/play-store/icon-512.png`; feature graphic `feature-graphic-1024x500.png`;
screenshots `store-assets/android-phone/*`.

**Forms to complete:** Privacy policy URL, App access (give the reviewer accounts), Ads (No), Content rating questionnaire
(user-generated content: Yes), Target audience 18+ (or 13+), Data safety (below), Account deletion URL, Food & drink category.

**Data safety answers (confirm against how you actually use the data):**
- Collected: name, email address, phone number, physical address, precise and approximate location, photos and videos, user ids,
  purchase history, other user-generated content.
- Purpose: app functionality and account management. Not used for advertising or analytics sold to others.
- Shared: payment processing with Razorpay; hosting and database with Supabase (service providers).
- Encrypted in transit: Yes. Users can request deletion: Yes (once account deletion above is built).
- Card and bank details are entered on Razorpay's screen and are not stored by ShePlates.

Permissions the app asks for: location (delivery pin, nearby kitchens) and camera (photos and videos for statuses, Food Shorts,
products, certificates). Both are requested only when the feature is used.

---

## 3. iPhone (App Store)

**Accounts:** Apple Developer Program (US$99 a year; organisations need a D-U-N-S number). Create the app in App Store
Connect with bundle id `com.sheplates.app`.

**You need a Mac with Xcode, or the cloud build:**

*In the cloud:* add the secrets named at the top of `mobile-ios.yml` (App Store Connect API key with App Manager role, issuer id,
key id, team id), then **Actions > iPhone App Store build > Run workflow**. It archives, signs automatically, and uploads to TestFlight.

*On your Mac:*
```bash
cd mobile && npm ci && npx cap sync ios
npx cap open ios
```
In Xcode: select the **App** target > Signing & Capabilities > pick your Team (automatic signing) > set the destination to
**Any iOS Device** > **Product > Archive** > **Distribute App > App Store Connect > Upload**.

**App Store Connect:** screenshots from `store-assets/ios-iphone-6.7in` (the 6.7-inch and 6.9-inch slots accept 1290 x 2796);
icon `ios-app-store-icon-1024.png` is already inside the app; add the privacy policy URL, App Privacy answers (same data as the
Play table above, all "linked to the user", none used for tracking), support URL, age rating (user-generated content: Yes),
review notes with test accounts, then Submit for Review.

Already set in the project: usage descriptions for location, camera, microphone and photos; export compliance
(`ITSAppUsesNonExemptEncryption = false`); privacy manifest; UPI app schemes so Razorpay can open GPay, PhonePe, Paytm and others.

---

## 4. Store listing text

**Name:** ShePlates
**Subtitle (iOS, 30):** Home food from your area
**Short description (Play, 80):** Order home-cooked meals and fresh essentials from verified kitchens near you.

**Full description:**
ShePlates brings home-cooked food, bakes, groceries and daily essentials from verified kitchens in your neighbourhood.

- Order for tomorrow or plan up to 15 days ahead, with delivery time slots you choose
- Food Drops: surplus meals from nearby kitchens, every evening at a better price
- Daily and weekly schedules for milk, meals and groceries, with pause and reschedule
- Live order tracking from confirmation to delivery
- Stories and Food Shorts from kitchens and neighbours
- She Agent, your food assistant: it plans, suggests and fills your basket, and never pays without your confirmation
- Request quotations for your monthly grocery list from local vendors
- Kitchens and vendors get their own dashboard for orders, catalogue, delivery team and settlements

Home meals, made simple.

**Keywords (iOS, 100):** home food,tiffin,bakery,groceries,milk,meal plan,local kitchens,food drops,subscription
**Category:** Food & Drink. **Support:** support@sheplates.com, 9600037836 (every day, 9:30 AM to 7 PM).

**Review notes (paste and fill in):** "ShePlates is a hosted app with accounts. Customer: EMAIL / PASSWORD. Vendor: EMAIL /
PASSWORD. Payments use Razorpay in test mode for these accounts. Location is used to find kitchens near the delivery pin."

---

## 5. Updating later

- **Web fixes and features:** deploy the website as usual. Both apps pick it up on next open. No store review.
- **Native changes** (icon, permission, plugin, id): bump `versionCode`/`versionName` (Android) and the build number (iOS),
  run `npx cap sync`, build and upload again. CI sets the build number from the run number automatically.
- Never commit `*.jks`, `keystore.properties`, `*.p12`, `*.p8` or `*.mobileprovision` (they are git-ignored).
