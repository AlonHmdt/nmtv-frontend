import { Injectable, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { firstValueFrom } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class EasterEggService {
  private http = inject(HttpClient);
  private backendUrl = environment.backendUrl;

  private readonly REQUIRED_CLICKS = 5;

  // Signals for reactive state
  private clickCountSignal = signal<number>(0);
  private isUnlockedSignal = signal<boolean>(false);
  private isNoaChannelReadySignal = signal<boolean>(false);
  private isLoadingNoaSignal = signal<boolean>(false);

  // Public computed signals
  clickCount = this.clickCountSignal.asReadonly();
  isUnlocked = this.isUnlockedSignal.asReadonly();
  isNoaChannelReady = this.isNoaChannelReadySignal.asReadonly();
  isLoadingNoa = this.isLoadingNoaSignal.asReadonly();

  constructor() {
    // Easter egg starts fresh each session - no localStorage
  }

  /**
   * Handle logo click - increments count and checks for unlock
   */
  handleLogoClick(): void {
    // If already unlocked, do nothing
    if (this.isUnlockedSignal()) {
      return;
    }

    const newCount = this.clickCountSignal() + 1;
    this.clickCountSignal.set(newCount);

    // Check if we've reached the required clicks
    if (newCount >= this.REQUIRED_CLICKS) {
      this.unlock();
    }
  }

  /**
   * Unlock the NOA channel and trigger backend loading
   */
  private async unlock(): Promise<void> {
    this.isUnlockedSignal.set(true);

    // Trigger backend to load NOA channel
    await this.loadNoaChannel();
  }

  /**
   * Call backend to load NOA channel playlists
   */
  private async loadNoaChannel(): Promise<void> {
    this.isLoadingNoaSignal.set(true);

    try {
      const response = await firstValueFrom(
        this.http.post<{ success: boolean; message: string; totalVideos?: number }>(
          `${this.backendUrl}/channel/noa/load`,
          {}
        )
      );

      if (response.success) {
        this.isNoaChannelReadySignal.set(true);
      }
    } catch (error) {
    } finally {
      this.isLoadingNoaSignal.set(false);
    }
  }

  /**
   * Reset the easter egg (for testing purposes)
   */
  reset(): void {
    this.clickCountSignal.set(0);
    this.isUnlockedSignal.set(false);
    this.isNoaChannelReadySignal.set(false);
    this.isLoadingNoaSignal.set(false);
  }
}
