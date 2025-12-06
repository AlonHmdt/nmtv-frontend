import { Component, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';

export type InstallPlatform = 'ios' | 'mac';

@Component({
    selector: 'app-install-modal',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './install-modal.component.html',
    styleUrls: ['./install-modal.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class InstallModalComponent {
    isOpen = signal(false);
    platform = signal<InstallPlatform>('ios');

    open(platform: InstallPlatform): void {
        this.platform.set(platform);
        this.isOpen.set(true);
    }

    close(): void {
        this.isOpen.set(false);
    }
}
