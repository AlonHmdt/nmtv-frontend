import { Injectable, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Channel } from '../models/video.model';
import { environment } from '../../environments/environment';
import { firstValueFrom } from 'rxjs';

export interface PlaylistInfo {
  id: string;
  name: string;
}

export interface CustomPlaylists {
  [channel: string]: PlaylistInfo[]; // Array of playlist info (max 5 per channel)
}

export interface PlaylistValidation {
  isValid: boolean;
  videoCount?: number;
  playlistName?: string;
  error?: string;
}

@Injectable({
  providedIn: 'root'
})
export class CustomPlaylistService {
  private http = inject(HttpClient);
  private readonly STORAGE_KEY = 'nmtv_custom_playlists';
  private readonly MAX_PLAYLISTS_PER_CHANNEL = 5;
  private backendUrl = environment.backendUrl;

  // Signal to track changes
  private customPlaylistsSignal = signal<CustomPlaylists>(this.loadFromStorage());

  constructor() {
  }

  /**
   * Get all custom playlists
   */
  getAll(): CustomPlaylists {
    return this.customPlaylistsSignal();
  }

  /**
   * Get custom playlists for a specific channel
   */
  getForChannel(channel: Channel): PlaylistInfo[] {
    const playlists = this.customPlaylistsSignal();
    return playlists[channel] || [];
  }

  /**
   * Get playlist IDs for a specific channel (for backward compatibility)
   */
  getPlaylistIds(channel: Channel): string[] {
    return this.getForChannel(channel).map(p => p.id);
  }

  /**
   * Get playlist name by ID
   */
  getPlaylistName(playlistId: string): string | undefined {
    const allPlaylists = this.customPlaylistsSignal();
    for (const channel in allPlaylists) {
      const found = allPlaylists[channel].find(p => p.id === playlistId);
      if (found) {
        return found.name;
      }
    }
    return undefined;
  }

  /**
   * Add a playlist to a channel
   */
  async addPlaylist(channel: Channel, playlistId: string, playlistName?: string): Promise<boolean> {
    const current = this.customPlaylistsSignal();
    const channelPlaylists = current[channel] || [];

    // Check if already exists
    if (channelPlaylists.some(p => p.id === playlistId)) {
      return false;
    }

    // Check max limit
    if (channelPlaylists.length >= this.MAX_PLAYLISTS_PER_CHANNEL) {
      return false;
    }

    // If name not provided, validate and get it
    let name = playlistName;
    if (!name) {
      const validation = await this.validatePlaylist(playlistId);
      if (!validation.isValid) {
        return false;
      }
      name = validation.playlistName || playlistId;
    }

    // Add playlist
    const updated = {
      ...current,
      [channel]: [...channelPlaylists, { id: playlistId, name }]
    };

    this.saveToStorage(updated);
    this.customPlaylistsSignal.set(updated);
    return true;
  }

  /**
   * Remove a playlist from a channel
   */
  removePlaylist(channel: Channel, playlistId: string): boolean {
    const current = this.customPlaylistsSignal();
    const channelPlaylists = current[channel] || [];

    const filtered = channelPlaylists.filter(p => p.id !== playlistId);

    if (filtered.length === channelPlaylists.length) {
      return false;
    }

    const updated = {
      ...current,
      [channel]: filtered
    };

    this.saveToStorage(updated);
    this.customPlaylistsSignal.set(updated);
    return true;
  }

  /**
   * Remove all playlists from a channel
   */
  clearChannel(channel: Channel): void {
    const current = this.customPlaylistsSignal();
    const updated = {
      ...current,
      [channel]: []
    };

    this.saveToStorage(updated);
    this.customPlaylistsSignal.set(updated);
  }

  /**
   * Check if channel has reached max playlists
   */
  isChannelFull(channel: Channel): boolean {
    const channelPlaylists = this.getForChannel(channel);
    return channelPlaylists.length >= this.MAX_PLAYLISTS_PER_CHANNEL;
  }

  /**
   * Get the count of playlists for a channel
   */
  getChannelCount(channel: Channel): number {
    return this.getForChannel(channel).length;
  }

  /**
   * Validate a playlist by checking if it exists and getting its video count
   */
  async validatePlaylist(playlistId: string): Promise<PlaylistValidation> {
    try {
      const response = await firstValueFrom(
        this.http.get<{ videoCount: number; playlistName: string }>(`${this.backendUrl}/validate-playlist/${playlistId}`)
      );

      return {
        isValid: true,
        videoCount: response.videoCount,
        playlistName: response.playlistName
      };
    } catch (error: any) {

      if (error.status === 404) {
        return {
          isValid: false,
          error: 'Playlist not found or is private'
        };
      }

      return {
        isValid: false,
        error: 'Failed to validate playlist. Please check the URL and try again.'
      };
    }
  }

  /**
   * Load playlists from localStorage
   */
  private loadFromStorage(): CustomPlaylists {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      // Silent fail
    }
    return {};
  }

  /**
   * Save playlists to localStorage
   */
  private saveToStorage(playlists: CustomPlaylists): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(playlists));
    } catch (error) {
      // Silent fail
    }
  }
}
