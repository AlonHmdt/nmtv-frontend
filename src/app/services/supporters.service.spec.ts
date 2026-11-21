import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  ANONYMOUS_SUPPORTER_NAME,
  MAX_SUPPORTER_NAME_LENGTH,
  SUPPORTERS,
  SupportersService,
  cleanSupporters
} from './supporters.service';

describe('SupportersService', () => {
  let service: SupportersService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
    service = TestBed.inject(SupportersService);
  });

  describe('supporter list', () => {
    it('starts with every supporter from the export, newest first', () => {
      const names = service.supporters().map(s => s.name);

      expect(names.length).toBe(SUPPORTERS.length);
      expect(names[0]).toBe('Noa Begoun');
      expect(names[names.length - 1]).toBe('Noa');
      expect(service.hasSupporters()).toBeTrue();
    });

    it('shows the cleaned-up names', () => {
      const names = service.supporters().map(s => s.name);

      expect(names).toContain(ANONYMOUS_SUPPORTER_NAME);
      expect(names).not.toContain('Someone');
      expect(names).toContain('@dj_asi_c');
      expect(names).toContain('מעיין ספייר');
    });

    it('contains names only - no email addresses', () => {
      for (const supporter of SUPPORTERS) {
        expect(Object.keys(supporter)).toEqual(['name']);
        expect(supporter.name).not.toMatch(/\S+@\S+\.\S+/);
      }
    });

    it('fits every name without cutting it short', () => {
      for (const supporter of service.supporters()) {
        expect(supporter.name.endsWith('…')).withContext(supporter.name).toBeFalse();
      }
    });
  });

  it('replaces the list', () => {
    service.setSupporters([{ name: 'Dana' }]);
    expect(service.supporters()).toEqual([{ name: 'Dana' }]);
  });

  it('knows when there is nobody to thank', () => {
    service.setSupporters([]);
    expect(service.hasSupporters()).toBeFalse();
  });

  describe('pickRandom', () => {
    beforeEach(() => {
      service.setSupporters([{ name: 'A' }, { name: 'B' }, { name: 'C' }]);
    });

    it('picks according to the random number', () => {
      expect(service.pickRandom(() => 0)?.name).toBe('A');
      expect(service.pickRandom(() => 0.5)?.name).toBe('B');
      expect(service.pickRandom(() => 0.99)?.name).toBe('C');
    });

    it('stays inside the list even if the random number is 1', () => {
      expect(service.pickRandom(() => 1)?.name).toBe('C');
    });

    it('returns null when there are no supporters', () => {
      service.setSupporters([]);
      expect(service.pickRandom()).toBeNull();
    });
  });

  describe('cleanSupporters', () => {
    it('trims names and collapses extra spaces', () => {
      expect(cleanSupporters([{ name: '  Sarah   &  Ben ' }])).toEqual([{ name: 'Sarah & Ben' }]);
    });

    it('drops blank names', () => {
      expect(cleanSupporters([{ name: '' }, { name: '   ' }, { name: 'Tal' }])).toEqual([{ name: 'Tal' }]);
    });

    it('drops repeat supporters, ignoring letter case', () => {
      expect(cleanSupporters([{ name: 'Dana' }, { name: 'dana' }, { name: 'Tal' }])).toEqual([
        { name: 'Dana' },
        { name: 'Tal' }
      ]);
    });

    it('cuts very long names short', () => {
      const [supporter] = cleanSupporters([{ name: 'x'.repeat(80) }]);

      expect(supporter.name.length).toBe(MAX_SUPPORTER_NAME_LENGTH);
      expect(supporter.name.endsWith('…')).toBeTrue();
    });

    it('keeps names at the limit as they are', () => {
      const name = 'y'.repeat(MAX_SUPPORTER_NAME_LENGTH);
      expect(cleanSupporters([{ name }])).toEqual([{ name }]);
    });

    it('shows "Someone" as a mystery supporter', () => {
      expect(cleanSupporters([{ name: 'Someone' }, { name: ' someone ' }])).toEqual([{ name: ANONYMOUS_SUPPORTER_NAME }]);
    });

    it('keeps names that only contain "someone"', () => {
      expect(cleanSupporters([{ name: 'Someone Special' }])).toEqual([{ name: 'Someone Special' }]);
    });

    it('removes the apostrophe spreadsheets put before "@" names', () => {
      expect(cleanSupporters([{ name: "'@dj_asi_c" }])).toEqual([{ name: '@dj_asi_c' }]);
    });

    it('keeps apostrophes that are part of a name', () => {
      expect(cleanSupporters([{ name: "O'Brien" }, { name: "'Tal" }])).toEqual([{ name: "O'Brien" }, { name: "'Tal" }]);
    });

    it('keeps Hebrew names as they are', () => {
      expect(cleanSupporters([{ name: 'יוסי וייס' }])).toEqual([{ name: 'יוסי וייס' }]);
    });

    it('survives missing entries', () => {
      expect(cleanSupporters([null as any, { name: undefined as any }, { name: 'Noa' }])).toEqual([{ name: 'Noa' }]);
    });
  });
});
