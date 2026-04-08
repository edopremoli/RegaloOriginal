// utils/assetUrl.ts
export function assetUrl(path: string) {
  const base = (import.meta as any)?.env?.BASE_URL || "/";
  return `${base.replace(/\/+$/,"")}/${path.replace(/^\/+/,"")}`;
}
