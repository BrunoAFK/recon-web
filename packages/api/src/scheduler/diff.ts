export type Severity = 'info' | 'warning' | 'critical';

export interface Change {
  handler: string;
  field: string;
  oldValue: unknown;
  newValue: unknown;
  severity: Severity;
}

/** Fields whose removal or change signals a critical problem. */
const CRITICAL_FIELDS = new Set([
  'ssl-certificate',
  'security-headers',
  'threats',
]);

/** Fields whose change warrants a warning. */
const WARNING_FIELDS = new Set([
  'dns',
  'tech-stack',
  'whois',
]);

/**
 * Compare two scan result sets and return an array of detected changes.
 *
 * Each result set is a `Record<handlerName, { data?, error?, skipped? }>`.
 */
export function detectChanges(
  oldResults: Record<string, { data?: unknown; error?: string }>,
  newResults: Record<string, { data?: unknown; error?: string }>,
): Change[] {
  const changes: Change[] = [];

  const allHandlers = new Set([...Object.keys(oldResults), ...Object.keys(newResults)]);

  for (const handler of allHandlers) {
    const oldEntry = oldResults[handler];
    const newEntry = newResults[handler];

    // Handler appeared or disappeared
    if (!oldEntry && newEntry) {
      changes.push({
        handler,
        field: 'presence',
        oldValue: null,
        newValue: 'added',
        severity: classifySeverity(handler, 'presence'),
      });
      continue;
    }

    if (oldEntry && !newEntry) {
      changes.push({
        handler,
        field: 'presence',
        oldValue: 'present',
        newValue: null,
        severity: classifySeverity(handler, 'presence'),
      });
      continue;
    }

    // Error state changed
    if (oldEntry!.error !== newEntry!.error) {
      changes.push({
        handler,
        field: 'error',
        oldValue: oldEntry!.error ?? null,
        newValue: newEntry!.error ?? null,
        severity: newEntry!.error ? 'warning' : 'info',
      });
    }

    // Compare data
    const oldData = oldEntry!.data;
    const newData = newEntry!.data;

    if (oldData === undefined && newData === undefined) continue;
    if (oldData === undefined || newData === undefined) {
      changes.push({
        handler,
        field: 'data',
        oldValue: oldData ?? null,
        newValue: newData ?? null,
        severity: classifySeverity(handler, 'data'),
      });
      continue;
    }

    // Deep-compare via JSON serialisation (simple but effective for our use case)
    const oldJson = JSON.stringify(oldData);
    const newJson = JSON.stringify(newData);

    if (oldJson !== newJson) {
      // Try to produce field-level diffs for object data
      if (isRecord(oldData) && isRecord(newData)) {
        const fieldChanges = diffObjects(handler, oldData, newData);
        changes.push(...fieldChanges);
      } else {
        changes.push({
          handler,
          field: 'data',
          oldValue: oldData,
          newValue: newData,
          severity: classifySeverity(handler, 'data'),
        });
      }
    }
  }

  return changes;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function diffObjects(
  handler: string,
  oldObj: Record<string, unknown>,
  newObj: Record<string, unknown>,
): Change[] {
  const changes: Change[] = [];
  const allKeys = new Set([...Object.keys(oldObj), ...Object.keys(newObj)]);

  for (const key of allKeys) {
    const oldVal = oldObj[key];
    const newVal = newObj[key];

    if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
      changes.push({
        handler,
        field: key,
        oldValue: oldVal ?? null,
        newValue: newVal ?? null,
        severity: classifySeverity(handler, key),
      });
    }
  }

  return changes;
}

function classifySeverity(handler: string, field: string): Severity {
  if (CRITICAL_FIELDS.has(handler) || CRITICAL_FIELDS.has(field)) return 'critical';
  if (WARNING_FIELDS.has(handler) || WARNING_FIELDS.has(field)) return 'warning';
  return 'info';
}
