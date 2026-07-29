export interface JsonDocument {
  ok: true;
  command: string;
  data: unknown;
}

export interface JsonErrorDocument {
  ok: false;
  command: string;
  error: { kind: string; code: string; message: string };
}

export function renderJson(command: string, data: unknown): string {
  const document: JsonDocument = { ok: true, command, data };
  return JSON.stringify(document);
}

export function renderJsonError(
  command: string,
  kind: string,
  code: string,
  message: string,
): string {
  const document: JsonErrorDocument = { ok: false, command, error: { kind, code, message } };
  return JSON.stringify(document);
}

export function renderTable(rows: readonly Record<string, unknown>[]): string {
  if (rows.length === 0) return '(no results)';
  const keys = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  const columns = keys.map(sanitizeTerminal);
  const values = rows.map((row) => keys.map((column) => formatValue(row[column])));
  const widths = columns.map((column, index) =>
    Math.max(column.length, ...values.map((row) => row[index].length)),
  );
  const line = (row: readonly string[]) =>
    row.map((value, index) => value.padEnd(widths[index])).join('  ');
  return [line(columns), line(widths.map((width) => '-'.repeat(width))), ...values.map(line)].join(
    '\n',
  );
}

export function renderRelativeIndexChart(
  title: string,
  points: readonly { period: string; ratio: number }[],
): string {
  const safeTitle = sanitizeTerminal(title);
  if (points.length === 0) return `${safeTitle}\n(no data)`;
  const maximum = Math.max(...points.map((point) => point.ratio), 1);
  const labelWidth = Math.max(...points.map((point) => sanitizeTerminal(point.period).length));
  const barWidth = 40;
  const lines = points.map(({ period, ratio }) => {
    const length = ratio === 0 ? 0 : Math.max(1, Math.round((ratio / maximum) * barWidth));
    return `${sanitizeTerminal(period).padEnd(labelWidth)} | ${'#'.repeat(length)} ${ratio}`;
  });
  return [safeTitle, ...lines].join('\n');
}

export function renderTrendResults(
  results: readonly { title: string; data: readonly { period: string; ratio: number }[] }[],
): string {
  return (
    results
      .map((result) => {
        const table = renderTable(result.data.map(({ period, ratio }) => ({ period, ratio })));
        return `${sanitizeTerminal(result.title)}\nNormalized relative index (maximum 100; not volume)\n${table}\n${renderRelativeIndexChart('Normalized relative index (maximum 100; not volume)', result.data)}`;
      })
      .join('\n\n') || '(no results)'
  );
}

function formatValue(value: unknown): string {
  if (value === undefined || value === null) return '';
  return sanitizeTerminal(
    (typeof value === 'object' ? JSON.stringify(value) : String(value)).replace(/<\/?b>/g, ''),
  );
}

function sanitizeTerminal(value: string): string {
  let result = '';

  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);

    if (code === 27 && value[index + 1] === '[') {
      index += 2;
      while (
        index < value.length &&
        (value.charCodeAt(index) < 64 || value.charCodeAt(index) > 126)
      )
        index += 1;
      continue;
    }

    if (code === 27 && value[index + 1] === ']') {
      index += 2;
      while (index < value.length && value.charCodeAt(index) !== 7) {
        if (value.charCodeAt(index) === 27 && value[index + 1] === '\\') {
          index += 1;
          break;
        }
        index += 1;
      }
      continue;
    }

    if (code === 9 || code === 10 || code === 13) {
      result += ' ';
    } else if (code > 31 && (code < 127 || code > 159)) {
      result += value[index];
    }
  }

  return result.replace(/ {2,}/g, ' ');
}
