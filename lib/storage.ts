export function readLocal<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const v = localStorage.getItem("lakbay:" + key);
    return v ? JSON.parse(v) : fallback;
  } catch {
    return fallback;
  }
}
export function writeLocal(key: string, value: unknown) {
  try {
    localStorage.setItem("lakbay:" + key, JSON.stringify(value));
    return true;
  } catch {
    window.dispatchEvent(new CustomEvent("storage-failure"));
    return false;
  }
}
