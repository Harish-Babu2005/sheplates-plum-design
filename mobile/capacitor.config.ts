import type { CapacitorConfig } from "@capacitor/cli";

/**
 * ShePlates apps for Android and iPhone.
 * The apps are a native shell around the hosted product at https://app.sheplates.com, so the screens, features and
 * look are exactly the website's and every web release reaches the apps without a store update.
 */
const config: CapacitorConfig = {
  appId: "com.sheplates.app",
  appName: "ShePlates",
  webDir: "www",
  backgroundColor: "#FFFFFF",
  appendUserAgent: "ShePlatesApp/1.0",
  server: {
    url: "https://app.sheplates.com",
    androidScheme: "https",
    errorPath: "offline.html",
    // Hosts the app may navigate to inside the shell: itself, Supabase auth, and Razorpay checkout. Anything else opens in the system browser.
    allowNavigation: ["app.sheplates.com", "*.supabase.co", "checkout.razorpay.com", "api.razorpay.com", "*.razorpay.com"],
  },
  ios: {
    // The web app already pads for the notch and home indicator with env(safe-area-inset-*) (viewport-fit=cover).
    contentInset: "never",
    preferredContentMode: "mobile",
    backgroundColor: "#FFFFFF",
    scrollEnabled: true,
  },
  android: {
    allowMixedContent: false,
    webContentsDebuggingEnabled: false,
    backgroundColor: "#FFFFFF",
  },
  plugins: {
    SplashScreen: { launchShowDuration: 1200, launchAutoHide: true, backgroundColor: "#155F65", showSpinner: false, androidScaleType: "CENTER_CROP" },
    SystemBars: { insetsHandling: "css", style: "LIGHT", initialViewportFitValueHint: "cover" },
  },
};

export default config;
