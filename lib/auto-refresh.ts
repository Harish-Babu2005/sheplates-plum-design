export const AUTO_REFRESH_INTERVAL_MS = 30_000;

export function startAutoRefresh(refresh: () => void | Promise<void>, intervalMs = AUTO_REFRESH_INTERVAL_MS) {
  const refreshWhenVisible = () => {
    if (document.visibilityState === "visible") void refresh();
  };
  const timer = window.setInterval(refreshWhenVisible, intervalMs);
  window.addEventListener("focus", refreshWhenVisible);
  document.addEventListener("visibilitychange", refreshWhenVisible);
  return () => {
    window.clearInterval(timer);
    window.removeEventListener("focus", refreshWhenVisible);
    document.removeEventListener("visibilitychange", refreshWhenVisible);
  };
}
