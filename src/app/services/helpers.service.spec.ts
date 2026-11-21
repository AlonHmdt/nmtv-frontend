import { HelpersService } from './helpers.service';

describe('HelpersService TV detection', () => {
  const SAMSUNG_TV = 'Mozilla/5.0 (SMART-TV; LINUX; Tizen 6.0) AppleWebKit/537.36 (KHTML, like Gecko) 76.0.3809.146/6.0 TV Safari/537.36';
  const ANDROID_TV_APP = 'Mozilla/5.0 (Linux; Android 11; BRAVIA 4K VH2; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/120.0 Safari/537.36 NMTV_AndroidTV';
  const DESKTOP = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0';

  let service: HelpersService;

  function withUserAgent(userAgent: string): void {
    spyOnProperty(navigator, 'userAgent', 'get').and.returnValue(userAgent);
  }

  beforeEach(() => {
    service = new HelpersService();
  });

  it('treats a smart TV browser as a TV browser', () => {
    withUserAgent(SAMSUNG_TV);

    expect(service.isAndroidTV()).toBeFalse();
    expect(service.isTvBrowser()).toBeTrue();
    expect(service.isTV()).toBeTrue();
    // TV browsers keep the desktop/mobile UI (they use an on-screen cursor, not a D-pad)
    expect(service.getDeviceType()).not.toBe('androidtv');
  });

  it('treats our Android TV app as a TV, but not as a TV browser', () => {
    withUserAgent(ANDROID_TV_APP);

    expect(service.isAndroidTV()).toBeTrue();
    expect(service.isTvBrowser()).toBeFalse();
    expect(service.isTV()).toBeTrue();
    expect(service.getDeviceType()).toBe('androidtv');
  });

  it('does not treat desktops as TVs', () => {
    withUserAgent(DESKTOP);

    expect(service.isTvBrowser()).toBeFalse();
    expect(service.isTV()).toBeFalse();
    expect(service.getDeviceType()).not.toBe('androidtv');
  });
});
