import { Component, inject, signal, computed, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CustomPlaylistService } from '../../services/custom-playlist.service';
import { QueueService } from '../../services/queue.service';
import { Channel } from '../../models/video.model';
import { 
  isValidYouTubePlaylistUrl, 
  extractPlaylistId, 
  getPlaylistUrlError 
} from '../../utils/youtube-url.utils';

interface ChannelData {
  id: Channel;
  name: string;
  icon: string;
}

@Component({
  selector: 'app-settings-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './settings-modal.component.html',
  styleUrls: ['./settings-modal.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SettingsModalComponent {
  customPlaylistService = inject(CustomPlaylistService);
  private queueService = inject(QueueService);

  isOpen = signal(false);
  selectedChannel = signal<Channel>(Channel.DECADE_1990S);
  
  // Input states
  playlistUrl = signal('');
  errorMessage = signal<string | null>(null);
  isAdding = signal(false);
  isApplying = signal(false);

  channels: ChannelData[] = [
    { id: Channel.ROCK, name: 'Rock', icon: '🎸' },
    { id: Channel.HIP_HOP, name: 'Hip Hop / Rap', icon: '🎤' },
    { id: Channel.DECADE_2000S, name: '2000s', icon: '💿' },
    { id: Channel.DECADE_1990S, name: '1990s', icon: '🎧' },
    { id: Channel.DECADE_1980S, name: '1980s', icon: '📻' }
  ];

  // Computed values
  currentPlaylists = computed(() => {
    return this.customPlaylistService.getForChannel(this.selectedChannel());
  });

  canAddMore = computed(() => {
    return !this.customPlaylistService.isChannelFull(this.selectedChannel());
  });

  playlistCount = computed(() => {
    return this.customPlaylistService.getChannelCount(this.selectedChannel());
  });

  open(): void {
    // Pre-select the current channel
    const currentChannel = this.queueService.currentChannel();
    this.selectedChannel.set(currentChannel);
    this.isOpen.set(true);
    this.resetForm();
  }

  close(): void {
    this.isOpen.set(false);
    this.resetForm();
  }

  selectChannel(channel: Channel): void {
    this.selectedChannel.set(channel);
    this.resetForm();
  }

  isChannelActive(channel: Channel): boolean {
    return channel === this.selectedChannel();
  }

  async validateAndAdd(): Promise<void> {
    const url = this.playlistUrl().trim();
    
    // Validate URL
    const error = getPlaylistUrlError(url);
    if (error) {
      this.errorMessage.set(error);
      return;
    }

    // Extract playlist ID
    const playlistId = extractPlaylistId(url);
    if (!playlistId) {
      this.errorMessage.set('Could not extract playlist ID');
      return;
    }

    // Validate playlist (check if it exists and size)
    this.isAdding.set(true);
    this.errorMessage.set(null);

    try {
      const validation = await this.customPlaylistService.validatePlaylist(playlistId);
      
      if (!validation.isValid) {
        this.errorMessage.set(validation.error || 'Invalid playlist');
        this.isAdding.set(false);
        return;
      }

      // Show warning if playlist is large but still add it
      if (validation.videoCount && validation.videoCount > 100) {
        this.errorMessage.set(
          `⚠️ Note: This playlist has ${validation.videoCount} videos, but only the first 100 will be used for better performance.`
        );
        // Clear warning after 5 seconds
        setTimeout(() => {
          if (this.errorMessage() === `⚠️ Note: This playlist has ${validation.videoCount} videos, but only the first 100 will be used for better performance.`) {
            this.errorMessage.set(null);
          }
        }, 5000);
      }

      // Add to service (includes playlist name from validation)
      const success = await this.customPlaylistService.addPlaylist(
        this.selectedChannel(), 
        playlistId,
        validation.playlistName
      );

      if (success) {
        this.resetForm();
        // Don't clear the warning message if it was set above
        if (!this.errorMessage()?.includes('⚠️')) {
          this.errorMessage.set(null);
        }
      } else {
        this.errorMessage.set('Could not add playlist. It may already exist or limit reached.');
      }
    } catch (error) {
      console.error('Error validating playlist:', error);
      this.errorMessage.set('Failed to validate playlist. Please check the URL and try again.');
    } finally {
      this.isAdding.set(false);
    }
  }

  removePlaylist(playlistId: string): void {
    this.customPlaylistService.removePlaylist(this.selectedChannel(), playlistId);
  }

  async applyChanges(): Promise<void> {
    this.isApplying.set(true);
    this.errorMessage.set(null);
    
    try {
      const currentChannel = this.queueService.currentChannel();
      
      // Only reload if user made changes to the current channel
      if (currentChannel === this.selectedChannel()) {
        await this.queueService.switchChannel(currentChannel);
      }
      
      // Close the modal after successful apply
      this.close();
    } catch (error) {
      console.error('Error applying changes:', error);
      this.errorMessage.set('Failed to reload videos. Please try again.');
    } finally {
      this.isApplying.set(false);
    }
  }

  private resetForm(): void {
    this.playlistUrl.set('');
    this.errorMessage.set(null);
    this.isAdding.set(false);
  }

  // Helper to get YouTube thumbnail (optional)
  getPlaylistThumbnail(playlistId: string): string {
    return `https://img.youtube.com/vi/${playlistId}/default.jpg`;
  }
}
