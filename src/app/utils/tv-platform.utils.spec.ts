import { canInstallApk, detectTvPlatform, isBackKey } from './tv-platform.utils';

describe('isBackKey', () => {
  it('accepts Escape and the TV remote Back buttons', () => {
    expect(isBackKey({ key: 'Escape', keyCode: 27 })).toBeTrue();
    expect(isBackKey({ key: 'GoBack', keyCode: 0 })).toBeTrue();
    expect(isBackKey({ key: 'Unidentified', keyCode: 4 })).toBeTrue(); // Android
    expect(isBackKey({ key: 'XF86Back', keyCode: 10009 })).toBeTrue(); // Samsung
    expect(isBackKey({ key: 'GoBack', keyCode: 461 })).toBeTrue(); // LG
  });

  it('ignores other keys', () => {
    expect(isBackKey({ key: 'Enter', keyCode: 13 })).toBeFalse();
    expect(isBackKey({ key: 'Backspace', keyCode: 8 })).toBeFalse();
    expect(isBackKey({ key: 'ArrowLeft', keyCode: 37 })).toBeFalse();
  });
});

describe('canInstallApk', () => {
  it('is true only for Android-based TVs', () => {
    expect(canInstallApk('firetv')).toBeTrue();
    expect(canInstallApk('androidtv')).toBeTrue();
    expect(canInstallApk('samsung')).toBeFalse();
    expect(canInstallApk('lg')).toBeFalse();
    expect(canInstallApk('other')).toBeFalse();
    expect(canInstallApk(null)).toBeFalse();
  });
});

describe('detectTvPlatform', () => {
  it('detects Samsung Tizen TVs', () => {
    expect(detectTvPlatform(
      'Mozilla/5.0 (SMART-TV; LINUX; Tizen 6.0) AppleWebKit/537.36 (KHTML, like Gecko) 76.0.3809.146/6.0 TV Safari/537.36'
    )).toBe('samsung');
    expect(detectTvPlatform(
      'Mozilla/5.0 (SMART-TV; Linux; Tizen 4.0) AppleWebKit/538.1 (KHTML, like Gecko) Version/4.0 SamsungBrowser/2.1 TV Safari/538.1'
    )).toBe('samsung');
  });

  it('detects LG webOS and NetCast TVs', () => {
    expect(detectTvPlatform(
      'Mozilla/5.0 (Web0S; Linux/SmartTV) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/79.0.3945.79 Safari/537.36 WebAppManager'
    )).toBe('lg');
    expect(detectTvPlatform(
      'Mozilla/5.0 (Linux; NetCast; U) AppleWebKit/537.31 (KHTML, like Gecko) Chrome/26.0.1410.33 Safari/537.31 SmartTV/6.0'
    )).toBe('lg');
  });

  it('detects Fire TV', () => {
    expect(detectTvPlatform(
      'Mozilla/5.0 (Linux; Android 9; AFTKA Build/PS7633.3445N; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/120.0.6099.230 Mobile Safari/537.36 Silk/120.3.3'
    )).toBe('firetv');
  });

  it('detects Android TV and Google TV browsers', () => {
    expect(detectTvPlatform(
      'Mozilla/5.0 (Linux; Android 12; Chromecast) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    )).toBe('androidtv');
    expect(detectTvPlatform(
      'Mozilla/5.0 (Linux; Android 10; BRAVIA 4K VH2) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36'
    )).toBe('androidtv');
  });

  it('detects Hisense VIDAA', () => {
    expect(detectTvPlatform(
      'Mozilla/5.0 (Linux; VIDAA 7.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/89.0.4389.90 Safari/537.36'
    )).toBe('hisense');
  });

  it('falls back to "other" for generic smart TVs', () => {
    expect(detectTvPlatform(
      'Mozilla/5.0 (Linux; U; HbbTV/1.5.1 (+DRM; Philips; TPM191E) ) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/85.0 Safari/537.36'
    )).toBe('other');
  });

  it('ignores phones, tablets and desktops', () => {
    // Samsung Internet on a phone (shows as "Samsung" in analytics, like the TV)
    expect(detectTvPlatform(
      'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0.0.0 Mobile Safari/537.36'
    )).toBeNull();
    // Silk on a Fire tablet
    expect(detectTvPlatform(
      'Mozilla/5.0 (Linux; Android 11; KFTRWI) AppleWebKit/537.36 (KHTML, like Gecko) Silk/120.3.3 like Chrome/120.0.6099.230 Safari/537.36'
    )).toBeNull();
    expect(detectTvPlatform(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'
    )).toBeNull();
    expect(detectTvPlatform(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
    )).toBeNull();
    // Tizen phone, not a TV
    expect(detectTvPlatform(
      'Mozilla/5.0 (Linux; Tizen 2.3; SAMSUNG SM-Z130H) AppleWebKit/537.3 (KHTML, like Gecko) SamsungBrowser/1.0 Mobile Safari/537.3'
    )).toBeNull();
  });

  it('handles missing user agents', () => {
    expect(detectTvPlatform('')).toBeNull();
    expect(detectTvPlatform(null)).toBeNull();
    expect(detectTvPlatform(undefined)).toBeNull();
  });
});
