/**
 * Case adapter for the API boundary.
 *
 * The frontend domain model (`domain/scenario.ts`) is camelCase, while the
 * backend's Pydantic models (`backend/app/models.py`) are snake_case. Rather
 * than leak snake_case into the app or rename the backend contract (and its
 * tests), we convert keys in one place: outbound payloads to snake_case,
 * inbound responses back to camelCase. Conversion is deep, so it handles
 * nested objects (`assumptions`, `valuation`) and arrays (`projection`).
 *
 * Only object *keys* are rewritten — string values such as the `"not-computed"`
 * valuation status or a `"bull"` kind are left exactly as they are.
 */

function snakeKey(key: string): string {
  return key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`)
}

function camelKey(key: string): string {
  return key.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase())
}

function convertKeys(value: unknown, convert: (key: string) => string): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => convertKeys(item, convert))
  }
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, val]) => [
        convert(key),
        convertKeys(val, convert),
      ]),
    )
  }
  return value
}

/** Deep-convert an outbound payload's keys to snake_case for the backend. */
export function toSnakeCase<T = unknown>(value: unknown): T {
  return convertKeys(value, snakeKey) as T
}

/** Deep-convert an inbound response's keys to camelCase for the frontend. */
export function toCamelCase<T = unknown>(value: unknown): T {
  return convertKeys(value, camelKey) as T
}
