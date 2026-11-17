/**
 * Device Notifications client helper
 * Handles permission requests, state detection (enabled, blocked, unsupported, iOS home-screen note),
 * token registration, and deregistration on logout.
 */

export type DeviceNotificationStatus =
  | "granted"
  | "denied"
  | "default"
  | "unsupported"
  | "ios_pwa_required";

export function getDeviceNotificationStatus(): DeviceNotificationStatus {
  if (typeof window === "undefined") return "unsupported";

  // Check iOS Safari standalone requirement
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
  const isStandalone = (window.navigator as any).standalone || window.matchMedia("(display-mode: standalone)").matches;
  if (isIOS && !isStandalone && !("Notification" in window)) {
    return "ios_pwa_required";
  }

  if (!("Notification" in window)) {
    return "unsupported";
  }

  return Notification.permission as DeviceNotificationStatus;
}

export async function requestAndRegisterDeviceNotifications(user?: { userId?: string; email?: string; role?: string }): Promise<{
  status: DeviceNotificationStatus;
  message: string;
}> {
  if (typeof window === "undefined") {
    return { status: "unsupported", message: "Device notifications are unavailable in this environment." };
  }

  const current = getDeviceNotificationStatus();
  if (current === "ios_pwa_required") {
    return {
      status: "ios_pwa_required",
      message: "On iPhone, web push notifications require adding Sheplates to your Home Screen first (Share > Add to Home Screen).",
    };
  }

  if (current === "unsupported") {
    return { status: "unsupported", message: "Notifications are not supported in this browser." };
  }

  if (Notification.permission === "denied") {
    return { status: "denied", message: "Notifications are blocked. Please enable them in your browser or device settings." };
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      return { status: permission as DeviceNotificationStatus, message: "Notification permission was not granted." };
    }

    // Attempt to register with ServiceWorker if available
    let endpoint = "";
    let p256dh = "";
    let authSecret = "";

    if ("serviceWorker" in navigator) {
      try {
        const registration = await navigator.serviceWorker.ready;
        if (registration.pushManager) {
          let subscription = await registration.pushManager.getSubscription();
          if (!subscription) {
            // Subscribe with application server key if provided, or default
            const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
            const subOptions: PushSubscriptionOptionsInit = {
              userVisibleOnly: true,
              ...(vapidKey ? { applicationServerKey: vapidKey } : {}),
            };
            subscription = await registration.pushManager.subscribe(subOptions).catch(() => null);
          }
          if (subscription) {
            endpoint = subscription.endpoint;
            const p256 = subscription.getKey("p256dh");
            const auth = subscription.getKey("auth");
            if (p256) p256dh = btoa(String.fromCharCode(...new Uint8Array(p256)));
            if (auth) authSecret = btoa(String.fromCharCode(...new Uint8Array(auth)));
          }
        }
      } catch {}
    }

    // Register with server
    const tokenPayload = {
      action: "register",
      endpoint: endpoint || `browser-${navigator.userAgent.slice(0, 30)}-${Date.now()}`,
      p256dh,
      authSecret,
      platform: "web",
      userId: user?.userId,
      role: user?.role,
    };

    try {
      await fetch("/api/device-tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(tokenPayload),
      });
    } catch {}

    // Show confirmation local test notification
    try {
      new Notification("Sheplates notifications enabled", {
        body: "Order, delivery, schedule and quotation updates can now reach this device.",
        icon: "/icon-192.png",
      });
    } catch {}

    return { status: "granted", message: "Device notifications enabled successfully." };
  } catch (err: any) {
    return { status: "denied", message: err?.message || "Could not enable device notifications." };
  }
}

export async function deregisterDeviceNotifications(user?: { userId?: string }): Promise<void> {
  if (typeof window === "undefined") return;

  try {
    let endpoint = "";
    if ("serviceWorker" in navigator) {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager?.getSubscription();
      if (sub) {
        endpoint = sub.endpoint;
        await sub.unsubscribe().catch(() => {});
      }
    }

    await fetch("/api/device-tokens", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "deregister", endpoint, userId: user?.userId }),
    }).catch(() => {});
  } catch {}
}
