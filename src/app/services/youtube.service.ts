import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Video, Channel } from '../models/video.model';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class YoutubeService {
  private http = inject(HttpClient);
  private backendUrl = environment.backendUrl;

  getChannelVideos(channel: Channel, customPlaylists: string[] = [], skipCustom: boolean = false): Observable<Video[]> {
    let params = [];
    
    if (customPlaylists.length > 0) {
      params.push(`custom=${customPlaylists.join(',')}`);
    }
    
    if (skipCustom) {
      params.push('skipCustom=true');
    }
    
    const queryString = params.length > 0 ? `?${params.join('&')}` : '';
    return this.http.get<Video[]>(`${this.backendUrl}/channel/${channel}${queryString}`);
  }

  getNextVideos(channel: Channel, excludeIds: string[], customPlaylists: string[] = []): Observable<Video[]> {
    return this.http.post<Video[]>(`${this.backendUrl}/channel/${channel}/next`, {
      excludeIds,
      customPlaylistIds: customPlaylists
    });
  }

  getVideoYear(title: string): Observable<{ year: number | null }> {
    return this.http.get<{ year: number | null }>(`${this.backendUrl}/video/year`, {
      params: { title }
    });
  }

  async checkBackendReady(): Promise<boolean> {
    try {
      const response = await fetch(`${this.backendUrl}/ready`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000) // 5 second timeout
      });
      
      if (response.ok) {
        const data = await response.json();
        return data.ready === true;
      }
      return false;
    } catch (error) {
      console.error('Backend readiness check failed:', error);
      return false;
    }
  }
}
