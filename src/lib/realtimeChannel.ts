export function createRealtimeChannelName(
  scope: string,
  ...parts: Array<string | number | null | undefined>
) {
  const safeParts = parts
    .filter((part): part is string | number => part !== null && part !== undefined && part !== '')
    .map((part) => String(part).replace(/[^a-zA-Z0-9_-]/g, '_'));

  const suffix =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  return [scope, ...safeParts, suffix].join('-');
}
