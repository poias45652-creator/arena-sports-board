// Admin expiry fields always use Taiwan time, regardless of the browser's timezone.
const TAIPEI_OFFSET_MS = 8 * 60 * 60 * 1000;

export function accountExpiryInput(timestamp: number | null): string {
  return timestamp === null ? '' : new Date(timestamp + TAIPEI_OFFSET_MS).toISOString().slice(0, 19);
}

export function parseAccountExpiry(value: string): number | null {
  if (!value) return null;
  const normalized = value.length === 16 ? `${value}:00` : value;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(normalized)) {
    throw new Error('請輸入完整的日期、時、分、秒');
  }
  const timestamp = Date.parse(`${normalized}+08:00`);
  if (!Number.isSafeInteger(timestamp) || timestamp <= 0 || timestamp >= 4102444800000 || accountExpiryInput(timestamp) !== normalized) {
    throw new Error('請輸入有效的到期時間');
  }
  return timestamp;
}
