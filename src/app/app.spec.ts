import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { App } from './app';
import { HelpersService } from './services/helpers.service';
import { TvPlatform } from './utils/tv-platform.utils';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideZonelessChangeDetection()]
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  describe('TV visit tracking', () => {
    let track: jasmine.Spy;
    let originalUmami: Window['umami'];

    function initApp(isAndroidTV: boolean, tvPlatform: TvPlatform | null): void {
      const helpers = TestBed.inject(HelpersService);
      spyOn(helpers, 'isAndroidTV').and.returnValue(isAndroidTV);
      spyOn(helpers, 'getTvPlatform').and.returnValue(tvPlatform);
      // Runs ngOnInit once (calling it by hand as well would track the visit twice)
      TestBed.createComponent(App).detectChanges();
    }

    beforeEach(() => {
      originalUmami = window.umami;
      track = jasmine.createSpy('track');
      window.umami = { track };
    });

    afterEach(() => {
      window.umami = originalUmami;
      document.body.classList.remove('android-tv-mode');
    });

    it('reports TV browsers with their platform', () => {
      initApp(false, 'samsung');
      expect(track).toHaveBeenCalledOnceWith('TV Visit', { platform: 'samsung', source: 'browser' });
    });

    it('reports the Android TV app', () => {
      initApp(true, null);
      expect(track).toHaveBeenCalledOnceWith('TV Visit', { platform: 'androidtv', source: 'app' });
    });

    it('does not report non-TV visitors', () => {
      initApp(false, null);
      expect(track).not.toHaveBeenCalled();
    });

    it('waits for the Umami script to load', () => {
      jasmine.clock().install();
      try {
        window.umami = undefined;
        initApp(false, 'lg');

        jasmine.clock().tick(1000);
        window.umami = { track };
        jasmine.clock().tick(500);

        expect(track).toHaveBeenCalledOnceWith('TV Visit', { platform: 'lg', source: 'browser' });
      } finally {
        jasmine.clock().uninstall();
      }
    });

    it('gives up quietly when Umami never loads (e.g. ad blocker)', () => {
      jasmine.clock().install();
      try {
        window.umami = undefined;
        initApp(false, 'firetv');
        jasmine.clock().tick(10000);

        window.umami = { track };
        jasmine.clock().tick(10000);
        expect(track).not.toHaveBeenCalled();
      } finally {
        jasmine.clock().uninstall();
      }
    });
  });
});
