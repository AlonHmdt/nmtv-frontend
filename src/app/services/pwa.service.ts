import { Injectable, signal } from '@angular/core';

@Injectable({
    providedIn: 'root'
})
export class PwaService {
    installPrompt = signal<any>(null);
    isIOS = signal(false);
    isMac = signal(false);
    isStandalone = signal(false);

    constructor() {
        this.checkPlatform();
        this.checkStandalone();

        if (typeof window !== 'undefined') {
            window.addEventListener('beforeinstallprompt', (e) => {
                // Prevent the mini-infobar from appearing on mobile
                e.preventDefault();
                // Stash the event so it can be triggered later.
                this.installPrompt.set(e);
                console.log('PWA Service: beforeinstallprompt captured');
            });

            window.addEventListener('appinstalled', () => {
                this.installPrompt.set(null);
                this.isStandalone.set(true);
                console.log('PWA Service: App installed');
            });
        }
    }

    private checkPlatform() {
        if (typeof window !== 'undefined' && typeof navigator !== 'undefined') {
            const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;
            const platform = (navigator as any).userAgentData?.platform || navigator.platform || 'unknown';

            if (/iPad|iPhone|iPod/.test(userAgent) && !(window as any).MSStream) {
                this.isIOS.set(true);
            } else if (platform.toUpperCase().indexOf('MAC') >= 0 || /Macintosh/.test(userAgent)) {
                this.isMac.set(true);
            }
        }
    }

    private checkStandalone() {
        if (typeof window !== 'undefined') {
            const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
                (navigator as any).standalone === true;
            this.isStandalone.set(isStandalone);
        }
    }

    async promptInstall() {
        const promptEvent = this.installPrompt();
        if (promptEvent) {
            promptEvent.prompt();
            const { outcome } = await promptEvent.userChoice;
            console.log(`User response to the install prompt: ${outcome}`);
            this.installPrompt.set(null);
        }
    }
}
