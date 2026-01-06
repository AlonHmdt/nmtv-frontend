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

        // Check for our custom identifier from the Android TV app
        return ua.includes('nmtv_androidtv');
    }

    isDesktopDevice(): boolean {
        if (typeof window === 'undefined') {
            return false;
        }
        // Desktop devices have precise pointers (mouse/trackpad)
        return window.matchMedia('(pointer: fine)').matches;
    }

    isMobileDevice(): boolean {
        if (typeof window === 'undefined') {
            return false;
        }
        // Mobile devices have coarse pointers (touch)
        return window.matchMedia('(pointer: coarse)').matches;
    }

    getDeviceType(): 'androidtv' | 'desktop' | 'mobile' {
        if (this.isAndroidTV()) {
            return 'androidtv';
        }
        if (this.isDesktopDevice()) {
            return 'desktop';
        }
        return 'mobile';
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
        this.staticAudio.volume = 0.3; // Set volume to 30% to avoid being too loud

        // Play the sound
        this.staticAudio.play().catch(error => {
            // Silent error
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