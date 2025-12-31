import { Injectable } from '@angular/core';

@Injectable({
    providedIn: 'root'
})
export class HelpersService {
    private staticAudio: HTMLAudioElement | null = null;

    constructor() { }

    isIOSDevice(): boolean {
        if (typeof navigator === 'undefined' || typeof window === 'undefined') {
            return false;
        }
        return /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    }

    isAndroidTV(): boolean {
        if (typeof navigator === 'undefined' || typeof window === 'undefined') {
            return false;
        }

        const ua = navigator.userAgent.toLowerCase();

        // 0. First check for our custom identifier from the Android TV app
        if (ua.includes('nmtv_androidtv')) {
            return true;
        }
        return false;
        // // 1. Basic Android Check
        // const isAndroid = ua.includes('android');
        // const isNotMobile = !ua.includes('mobile');
        // const noTouch = !('ontouchstart' in window) && navigator.maxTouchPoints === 0;

        // // 2. Specific TV Flags
        // // Even without a brand list, Android TVs almost always include these strings
        // const hasTVFlags = ua.includes('large screen') || ua.includes('googletv') || ua.includes('tv');

        // // 3. Bypass "Desktop Mode" (Chromebooks/Tablets)
        // // Most TVs have a fixed aspect ratio and identify as a "standalone" or "fullscreen" display
        // const isTVResolution = window.screen.width >= 1280;

        // // Final Logic: 
        // // It must be Android + Not Mobile + No Touch...
        // // AND it must either explicitly say "TV" OR have a TV-like hardware signature.
        // return isAndroid && isNotMobile && noTouch && (hasTVFlags || isTVResolution);
    }

    isMobileResolution(): boolean {
        return window.innerWidth < 1024;
    }

    playStaticSound(): void {
        // Stop and reset any currently playing static sound
        if (this.staticAudio) {
            this.staticAudio.pause();
            this.staticAudio.currentTime = 0;
        }

        // Create new audio element
        this.staticAudio = new Audio('/sfx/tv-static-noise.mp3');
        this.staticAudio.volume = 0.4; // Set volume to 50% to avoid being too loud

        // Play the sound
        this.staticAudio.play().catch(error => {
            console.warn('Failed to play static sound:', error);
        });
    }

    stopStaticSound(): void {
        if (this.staticAudio) {
            this.staticAudio.pause();
            this.staticAudio.currentTime = 0;
            this.staticAudio = null;
        }
    }
}