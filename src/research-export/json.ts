/** Strict JSON helpers for research-export 0.1. No extra keys, no NaN, no duplicate keys. */

const ISO_Z = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?Z$/;
const SHA256 = /^[0-9a-f]{64}$/;
const COMMIT = /^[0-9a-f]{40}$/;
const HEX4 = /^[0-9a-fA-F]{4}$/;

function daysInMonth(year: number, month: number): number {
  if (month === 2) {
    const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    return leap ? 29 : 28;
  }
  return [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1] ?? 0;
}

export function isIsoZ(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const match = ISO_Z.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > daysInMonth(year, month)) return false;
  return hour <= 23 && minute <= 59 && second <= 59;
}

export function isSha256(value: unknown): value is string {
  return typeof value === 'string' && SHA256.test(value);
}

export function isCommit(value: unknown): value is string {
  return typeof value === 'string' && COMMIT.test(value);
}

export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

export function isInt(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && Number.isFinite(value);
}

export function keysOf(value: object): string[] {
  return Object.keys(value);
}

export function sameKeys(value: object, expected: readonly string[]): boolean {
  const got = keysOf(value);
  return got.length === expected.length && expected.every((key, i) => got[i] === key || got.includes(key)) && got.every(k => expected.includes(k));
}

export function exactKeys(value: object, expected: readonly string[]): boolean {
  const got = new Set(keysOf(value));
  return got.size === expected.length && expected.every(k => got.has(k));
}

export function encodeJson(value: unknown): string {
  return JSON.stringify(value, (_key, item) => {
    if (typeof item === 'number' && !Number.isFinite(item)) {
      throw new Error('NaN/Infinity is not allowed');
    }
    return item;
  });
}

export function parseJsonObject(text: string, label: string): Record<string, unknown> {
  if (text.charCodeAt(0) === 0xfeff) throw fail(label, '', 'BOM is not allowed');
  rejectDuplicateKeys(text, label);
  let value: unknown;
  try {
    value = JSON.parse(text, (_key, item) => {
      if (typeof item === 'number' && !Number.isFinite(item)) throw new Error('NaN/Infinity');
      return item;
    });
  } catch (error) {
    throw fail(label, '', error instanceof Error ? error.message : 'invalid JSON');
  }
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw fail(label, '', 'root must be an object');
  }
  return value as Record<string, unknown>;
}

export function fail(file: string, field: string, message: string, line?: number): Error {
  const where = line == null ? file : `${file}:${line}`;
  const at = field ? ` field=${field}` : '';
  return new Error(`${where}${at} ${message}`);
}

export function rejectDuplicateKeys(text: string, label: string): void {
  const stack: Set<string>[] = [];
  let i = 0;
  const n = text.length;
  const peek = () => text[i];
  const skipWs = () => { while (i < n && /\s/.test(text[i])) i++; };
  const readString = () => {
    i++;
    let out = '';
    while (i < n) {
      const c = text[i++];
      if (c === '"') return out;
      if (c.charCodeAt(0) < 0x20) throw fail(label, '', 'unescaped control character');
      if (c !== '\\') {
        out += c;
        continue;
      }
      if (i >= n) throw fail(label, '', 'unterminated string');
      const escaped = text[i++];
      if (escaped === 'u') {
        const hex = text.slice(i, i + 4);
        if (!HEX4.test(hex)) throw fail(label, '', 'invalid unicode escape');
        out += String.fromCharCode(parseInt(hex, 16));
        i += 4;
        continue;
      }
      const decoded = ({ '"': '"', '\\': '\\', '/': '/', b: '\b', f: '\f', n: '\n', r: '\r', t: '\t' } as Record<string, string>)[escaped];
      if (!decoded) throw fail(label, '', 'invalid escape');
      out += decoded;
    }
    throw fail(label, '', 'unterminated string');
  };
  const enter = (kind: '{' | '[') => {
    if (kind === '{') stack.push(new Set());
    else stack.push(null as unknown as Set<string>);
  };
  skipWs();
  if (peek() !== '{' && peek() !== '[') return;
  const start = peek();
  i++;
  enter(start as '{' | '[');
  while (i < n && stack.length) {
    skipWs();
    const c = peek();
    const frame = stack[stack.length - 1];
    if (c === '}' || c === ']') {
      i++;
      stack.pop();
      continue;
    }
    if (c === ',') { i++; continue; }
    if (frame) {
      if (c !== '"') throw fail(label, '', 'object key must be a string');
      const key = readString();
      if (frame.has(key)) throw fail(label, key, 'duplicate JSON key');
      frame.add(key);
      skipWs();
      if (text[i++] !== ':') throw fail(label, key, 'expected colon');
      skipWs();
    }
    const next = peek();
    if (next === '"') readString();
    else if (next === '{' || next === '[') { i++; enter(next); }
    else {
      while (i < n && !/[,\}\]\s]/.test(text[i])) i++;
    }
  }
}

export function posixSourcePath(path: string): boolean {
  return path.length > 0 && !path.startsWith('/') && !path.includes('\\') && !path.split('/').includes('..');
}
