/**
 * Smart-TV browser detection, based on the user agent.
 *
 * Analytics tools group visitors by browser, so TV browsers hide inside generic rows:
 * Samsung TVs show up as "Samsung" (same as Samsung phones) and LG / Android TV browsers
 * as "Chrome". These patterns pick them out so we can tell how many TV visitors we have.
 */
export type TvPlatform = 'samsung' | 'lg' | 'firetv' | 'androidtv' | 'hisense' | 'other';

const TV_PATTERNS: ReadonlyArray<[TvPlatform, RegExp]> = [
  // Samsung Tizen: "(SMART-TV; LINUX; Tizen 6.0) ... TV Safari"
  ['samsung', /Tizen/i],
  // LG webOS ("Web0S; Linux/SmartTV") and older NetCast models
  ['lg', /Web0S|webOS|NetCast/i],
  // Amazon Fire TV devices report model codes like AFTMM, AFTKA, AFTSSS
  ['firetv', /\bAFT[A-Z0-9]+\b/],
  // Android TV / Google TV / Sony Bravia browsers
  ['androidtv', /Android TV|GoogleTV|Google TV|CrKey|Chromecast|BRAVIA/i],
  // Hisense VIDAA
  ['hisense', /VIDAA|Hisense/i],
  // Anything else that says it is a TV
  ['other', /SMART-?TV|SmartTV|HbbTV|Viera|PhilipsTV|\bTV Safari\b/i],
];

/** Android-based TVs, where our APK can be installed (via the Downloader app). */
export function canInstallApk(platform: TvPlatform | null): boolean {
  return platform === 'firetv' || platform === 'androidtv';
}

/**
 * Remote "Back" buttons. Our Android TV app turns Back into Escape itself, but TV browsers
 * send their own key codes: 10009 on Samsung (Tizen), 461 on LG (webOS).
 */
const TV_BACK_KEY_CODES = [4, 10009, 461];

/** True for Escape and for the Back button of TV remotes. */
export function isBackKey(event: Pick<KeyboardEvent, 'key' | 'keyCode'>): boolean {
  return event.key === 'Escape' || event.key === 'GoBack' || TV_BACK_KEY_CODES.includes(event.keyCode);
}

/** Returns the TV platform for a user agent, or null when it doesn't look like a TV. */
export function detectTvPlatform(userAgent: string | null | undefined): TvPlatform | null {
  if (!userAgent) return null;

  // Tizen also ran on Galaxy watches and phones; only count it as a TV when it says so
  if (/Tizen/i.test(userAgent) && !/SMART-?TV|\bTV\b/i.test(userAgent)) return null;

  for (const [platform, pattern] of TV_PATTERNS) {
    if (pattern.test(userAgent)) return platform;
  }
  return null;
}
