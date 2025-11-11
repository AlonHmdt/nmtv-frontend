/**
 * Utilities for validating and parsing YouTube playlist URLs
 */

/**
 * Validates if a URL is a valid YouTube playlist URL
 * Supports formats:
 * - https://www.youtube.com/playlist?list=PLxxxxxx
 * - https://www.youtube.com/watch?v=xxxxx&list=PLxxxxxx
 * - https://youtube.com/playlist?list=PLxxxxxx
 */
export function isValidYouTubePlaylistUrl(url: string): boolean {
  if (!url || typeof url !== 'string') {
    return false;
  }

  try {
    const urlObj = new URL(url);
    
    // Must be youtube.com domain
    if (!urlObj.hostname.includes('youtube.com')) {
      return false;
    }

    // Must have 'list' parameter
    const listParam = urlObj.searchParams.get('list');
    if (!listParam) {
      return false;
    }

    // Validate playlist ID format (typically starts with PL, RD, UU, etc.)
    // YouTube playlist IDs are typically 34 characters long
    const playlistIdPattern = /^[a-zA-Z0-9_-]{13,}$/;
    return playlistIdPattern.test(listParam);
  } catch (error) {
    // Invalid URL format
    return false;
  }
}

/**
 * Extracts the playlist ID from a YouTube URL
 * Returns null if no valid playlist ID found
 */
export function extractPlaylistId(url: string): string | null {
  if (!url || typeof url !== 'string') {
    return null;
  }

  try {
    const urlObj = new URL(url);
    const listParam = urlObj.searchParams.get('list');
    
    if (listParam) {
      const playlistIdPattern = /^[a-zA-Z0-9_-]{13,}$/;
      return playlistIdPattern.test(listParam) ? listParam : null;
    }
    
    return null;
  } catch (error) {
    // Try regex fallback for malformed URLs
    const match = url.match(/[?&]list=([a-zA-Z0-9_-]{13,})/);
    return match ? match[1] : null;
  }
}

/**
 * Validates a playlist ID format
 */
export function isValidPlaylistId(playlistId: string): boolean {
  if (!playlistId || typeof playlistId !== 'string') {
    return false;
  }

  // YouTube playlist IDs are alphanumeric with dashes and underscores
  // Typically 13-34 characters long
  const playlistIdPattern = /^[a-zA-Z0-9_-]{13,}$/;
  return playlistIdPattern.test(playlistId);
}

/**
 * Gets a user-friendly error message for invalid URLs
 */
export function getPlaylistUrlError(url: string): string | null {
  if (!url || url.trim() === '') {
    return 'Please enter a URL';
  }

  try {
    const urlObj = new URL(url);
    
    if (!urlObj.hostname.includes('youtube.com')) {
      return 'URL must be from youtube.com';
    }

    const listParam = urlObj.searchParams.get('list');
    if (!listParam) {
      return 'URL must contain a playlist (list parameter)';
    }

    if (!isValidPlaylistId(listParam)) {
      return 'Invalid playlist ID format';
    }

    return null; // Valid
  } catch (error) {
    return 'Invalid URL format';
  }
}
