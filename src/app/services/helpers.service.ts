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
        this.staticAudio.volume = 0.5; // Set volume to 50% to avoid being too loud
        
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