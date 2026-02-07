import { Component, signal, ChangeDetectionStrategy, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ModalStateService } from '../../services/modal-state.service';
import { PwaService } from '../../services/pwa.service';

export type InstallPlatform = 'ios' | 'mac' | 'android';
export type ModalView = 'menu' | 'instructions';

declare global {
    interface Window {
        umami?: {
            track: (eventName: string, eventData?: Record<string, any>) => void;
        };
    }
}

@Component({
    selector: 'app-install-modal',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './install-modal.component.html',
    styleUrls: ['./install-modal.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class InstallModalComponent implements OnInit, OnDestroy {
    private modalState = inject(ModalStateService);
    private pwaService = inject(PwaService);

    readonly ANDROID_TV_APK_URL = 'https://github.com/AlonHmdt/nmtv-android-tv/releases/download/v1.0.0/nmtv-app-release-1.apk';

    isOpen = signal(false);
    platform = signal<InstallPlatform>('ios');
    currentView = signal<ModalView>('menu');

    private track(eventName: string, eventData?: Record<string, any>): void {
        if (typeof window !== 'undefined' && window.umami) {
            window.umami.track(eventName, eventData);
        }
    }

    ngOnInit(): void {
        // Lifecycle method for cleanup
    }

    ngOnDestroy(): void {
        window.removeEventListener('keydown', this.handleEscapeKey);
        window.removeEventListener('keydown', this.handleArrowKeys);
    }

    open(): void {
        this.currentView.set('menu');
        this.isOpen.set(true);
        // Notify global modal state
        this.modalState.openModal();
        // Add event listeners when modal opens
        window.addEventListener('keydown', this.handleEscapeKey);
        window.addEventListener('keydown', this.handleArrowKeys);
    }

    close(): void {
        this.isOpen.set(false);
        this.currentView.set('menu');
        // Notify global modal state
        this.modalState.closeModal();
        // Remove event listeners when modal closes
        window.removeEventListener('keydown', this.handleEscapeKey);
        window.removeEventListener('keydown', this.handleArrowKeys);
    }

    selectThisDevice(): void {
        let platform = 'unknown';
        if (this.pwaService.installPrompt()) platform = 'native';
        else if (this.pwaService.isIOS()) platform = 'ios';
        else if (this.pwaService.isMac()) platform = 'mac';
        else if (this.pwaService.isAndroid()) platform = 'android';

        this.track('Install This Device', { platform });

        // If native PWA install is available, trigger it and close
        if (this.pwaService.installPrompt()) {
            this.pwaService.promptInstall();
            this.close();
            return;
        }

        // Otherwise show platform-specific instructions
        if (this.pwaService.isIOS()) {
            this.platform.set('ios');
        } else if (this.pwaService.isMac()) {
            this.platform.set('mac');
        } else if (this.pwaService.isAndroid()) {
            this.platform.set('android');
        } else {
            // Default to showing a generic message or close
            this.close();
            return;
        }
        this.currentView.set('instructions');
    }

    selectAndroidTV(): void {
        this.track('Install Android TV APK');
        window.open(this.ANDROID_TV_APK_URL, '_blank');
    }

    backToMenu(): void {
        this.currentView.set('menu');
    }

    private handleEscapeKey = (event: KeyboardEvent): void => {
        if (event.key === 'Escape' && this.isOpen()) {
            event.preventDefault();
            this.close();
        }
    };

    private handleArrowKeys = (event: KeyboardEvent): void => {
        // Stop arrow key propagation when modal is open to prevent video player control
        if (this.isOpen() && (event.key === 'ArrowUp' || event.key === 'ArrowDown' || event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
            event.stopPropagation();
            // Allow default scroll behavior
        }
    };
}
