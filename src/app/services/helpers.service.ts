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
        this.staticAudio.volume = 0.2; // Set volume to 30% to avoid being too loud

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

    isChromeForCasting(): boolean {
        if (typeof navigator === 'undefined' || typeof window === 'undefined') {
            return false;
        }
        
        const userAgent = navigator.userAgent;
        
        // Check for Chrome in user agent (more reliable than window.chrome)
        const isChrome = userAgent.includes('Chrome/') && !userAgent.includes('Chromium/');
        
        // Exclude Chrome-based browsers that don't support Cast
        const isEdgeChromium = userAgent.includes('Edg');
        const isOperaChromium = userAgent.includes('OPR');
        const isVivaldi = userAgent.includes('Vivaldi');
        const isBrave = userAgent.includes('Brave');
        
        // Also check for window.chrome as additional confirmation
        const hasChromeAPI = !!(window as any).chrome;
        
        const result = isChrome && !isEdgeChromium && !isOperaChromium && !isVivaldi && !isBrave;
        console.log('Chrome detection:', { 
            isChrome, 
            hasChromeAPI, 
            userAgent, 
            isEdgeChromium, 
            isOperaChromium, 
            isVivaldi, 
            isBrave, 
            result 
        });
        return result;
    }

    isCastSupported(): boolean {
        const hasPresentation = 'presentation' in navigator;
        const isChrome = this.isChromeForCasting();
        const result = hasPresentation && isChrome;
        console.log('Cast support:', { hasPresentation, isChrome, result });
        return result;
    }
}