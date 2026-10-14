/**
 * Development checks. Bundlers replace `process.env.NODE_ENV`, as React
 * itself requires; where nothing replaces it and there is no `process` (a
 * plain `<script type="module">`), the read throws and warnings stay off.
 */

declare const process: { readonly env: { readonly NODE_ENV?: string } };

export function isDevelopment(): boolean {
  try {
    return process.env.NODE_ENV !== 'production';
  } catch {
    return false;
  }
}

/** Logs a development warning with the `[sous]` prefix. */
export function warn(message: string): void {
  if (isDevelopment()) console.warn(`[sous] ${message}`);
}
