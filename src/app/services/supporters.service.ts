import { Injectable, computed, signal } from '@angular/core';

/** Someone who bought a coffee, as shown on screen */
export interface Supporter {
  /** Display name (private supporters already arrive as a generic name) */
  name: string;
}

/**
 * Everyone who bought a coffee, newest first (from the Buy Me a Coffee export of 2026-11-21).
 * Names only - emails and amounts are never shipped to the site.
 * Will be replaced by a backend call once the Buy Me a Coffee webhook is connected.
 */
export const SUPPORTERS: Supporter[] = [
  { name: 'Noa Begoun' },
  { name: 'Aviad' },
  { name: 'HulK' },
  { name: 'Ohad' },
  { name: 'Sheesh and Sean' },
  { name: 'Someone' },
  { name: 'Tudor' },
  { name: 'Sasha Rom' },
  { name: 'Nathan' },
  { name: 'Eran Nadav' },
  { name: 'Jeff R.' },
  { name: 'Thomas' },
  { name: "'@dj_asi_c" },
  { name: 'מעיין ספייר' },
  { name: 'יוסי וייס' },
  { name: 'yaron arditi' },
  { name: 'Z' },
  { name: 'Chen' },
  { name: 'Miriam' },
  { name: 'Noa' }
];

/** Buy Me a Coffee uses "Someone" for supporters who left no name; shown as this instead */
export const ANONYMOUS_SUPPORTER_NAME = 'A mystery supporter';

/** Names longer than this are cut short so they can't break the layout */
export const MAX_SUPPORTER_NAME_LENGTH = 24;

/**
 * The people who bought a coffee, for the power-screen thank-you and the ticker.
 * Currently serves the exported list above.
 */
@Injectable({ providedIn: 'root' })
export class SupportersService {
  /** Supporters to show (cleaned: trimmed, no blanks, length-capped, no duplicates) */
  readonly supporters = signal<Supporter[]>(cleanSupporters(SUPPORTERS));

  readonly hasSupporters = computed(() => this.supporters().length > 0);

  /** Replaces the list (used later by the backend call, and by tests) */
  setSupporters(list: Supporter[]): void {
    this.supporters.set(cleanSupporters(list));
  }

  /** One supporter picked at random, or null when there are none */
  pickRandom(random: () => number = Math.random): Supporter | null {
    const list = this.supporters();
    if (list.length === 0) {
      return null;
    }
    const index = Math.min(list.length - 1, Math.floor(random() * list.length));
    return list[index];
  }
}

/**
 * Makes names safe to show: trims spaces, removes the stray apostrophe spreadsheet exports
 * put before names starting with "@", shows "Someone" as a mystery supporter,
 * drops blanks and duplicates, and caps the length.
 */
export function cleanSupporters(list: Supporter[]): Supporter[] {
  const seen = new Set<string>();
  const result: Supporter[] = [];

  for (const supporter of list) {
    let name = (supporter?.name ?? '')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/^'(?=[@=+-])/, '');
    if (!name) {
      continue;
    }
    if (name.toLowerCase() === 'someone') {
      name = ANONYMOUS_SUPPORTER_NAME;
    }
    if (name.length > MAX_SUPPORTER_NAME_LENGTH) {
      name = name.slice(0, MAX_SUPPORTER_NAME_LENGTH - 1).trimEnd() + '…';
    }
    const key = name.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push({ name });
  }

  return result;
}
