import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { VideoBlock, Channel } from '../models/video.model';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class YoutubeService {
  private http = inject(HttpClient);
  private backendUrl = environment.backendUrl;

  getChannelVideos(channel: Channel, customPlaylists: string[] = []): Observable<VideoBlock> {
    let params = [];

    if (customPlaylists.length > 0) {
      params.push(`custom=${customPlaylists.join(',')}`);
    }

    const queryString = params.length > 0 ? `?${params.join('&')}` : '';
    return this.http.get<VideoBlock>(`${this.backendUrl}/channel/${channel}${queryString}`);
  }

  getNextVideos(channel: Channel, excludeVideoIds: string[], excludePlaylistIds: string[], customPlaylists: string[] = [], preferCustom: boolean = false): Observable<VideoBlock> {
    return this.http.post<VideoBlock>(`${this.backendUrl}/channel/${channel}/next`, {
      excludeIds: excludeVideoIds,
      excludePlaylistIds: excludePlaylistIds,
      customPlaylistIds: customPlaylists,
      preferCustom: preferCustom
    });
  }

  getVideoYear(title: string): Observable<{ year: number | null }> {
    return this.http.get<{ year: number | null }>(`${this.backendUrl}/video/year`, {
      params: { title }
    });
  }

  async checkBackendReady(): Promise<boolean | { ready: boolean; cacheSize: number; bumpersLoaded: boolean; bumpersCount: number }> {
    try {
      const response = await fetch(`${this.backendUrl}/ready`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000) // 5 second timeout
      });

      if (response.ok) {
        const data = await response.json();
        // Return full data object for progress tracking
        return data;
      }
      return false;
    } catch (error) {
      return false;
    }
  }
}
