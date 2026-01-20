import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap, catchError, of, map } from 'rxjs';
import { environment } from '../../environments/environment';

// Auth response interfaces
export interface LoginResponse {
    success: boolean;
    message: string;
}

export interface SessionResponse {
    valid: boolean;
    expiresAt?: number;
}

export interface YoutubeMetadata {
    id: string;
    title: string;
    artist?: string;
    song?: string;
    parsedTitle?: string;
    duration: number;
    channelTitle: string;
    thumbnail: string;
}

export interface VideoExistenceCheck {
    [videoId: string]: {
        exists: boolean;
        title?: string;
        playlists: {
            id: number;
            name: string;
            channelId: string;
            channelName: string;
        }[];
    };
}

export interface Channel {
    id: string;
    name: string;
    icon?: string;
}

export interface Playlist {
    id: number;
    name: string;
    description?: string;
}

@Injectable({
    providedIn: 'root'
})
export class AdminService {
    private http = inject(HttpClient);
    private backendUrl = environment.backendUrl;

    // Auth state
    isAuthenticated = signal<boolean>(false);

    // HTTP options with credentials for cookie auth
    private httpOptions = { withCredentials: true };

    // ============================================
    // AUTHENTICATION METHODS
    // ============================================

    /**
     * Login with password
     */
    login(password: string): Observable<LoginResponse> {
        return this.http.post<LoginResponse>(
            `${this.backendUrl}/admin/login`,
            { password },
            this.httpOptions
        ).pipe(
            tap(response => {
                if (response.success) {
                    this.isAuthenticated.set(true);
                }
            })
        );
    }

    /**
     * Logout and clear session
     */
    logout(): Observable<{ success: boolean }> {
        return this.http.post<{ success: boolean }>(
            `${this.backendUrl}/admin/logout`,
            {},
            this.httpOptions
        ).pipe(
            tap(() => this.isAuthenticated.set(false))
        );
    }

    /**
     * Check if current session is valid
     */
    checkSession(): Observable<boolean> {
        return this.http.get<SessionResponse>(
            `${this.backendUrl}/admin/session`,
            this.httpOptions
        ).pipe(
            map(response => response.valid),
            tap(valid => this.isAuthenticated.set(valid)),
            catchError(() => {
                this.isAuthenticated.set(false);
                return of(false);
            })
        );
    }

    // ============================================
    // EXISTING ADMIN METHODS (with credentials)
    // ============================================

    // Check if videos exist in DB
    checkVideosExistence(videoIds: string[]): Observable<VideoExistenceCheck> {
        return this.http.post<VideoExistenceCheck>(
            `${this.backendUrl}/admin/check-videos`,
            { videoIds },
            this.httpOptions
        );
    }

    // Fetch YouTube metadata for videos
    fetchYoutubeMetadata(videoIds: string[]): Observable<YoutubeMetadata[]> {
        return this.http.post<YoutubeMetadata[]>(
            `${this.backendUrl}/admin/fetch-youtube-metadata`,
            { videoIds },
            this.httpOptions
        );
    }

    // Get all channels
    getChannels(): Observable<Channel[]> {
        return this.http.get<Channel[]>(
            `${this.backendUrl}/channels`,
            this.httpOptions
        );
    }

    // Get playlists for a channel
    getPlaylistsForChannel(channelId: string): Observable<Playlist[]> {
        return this.http.get<Playlist[]>(
            `${this.backendUrl}/channels/${channelId}/playlists`,
            this.httpOptions
        );
    }

    // Create a new playlist
    createPlaylist(name: string, description: string, channelId: string): Observable<{ success: boolean; id: number }> {
        return this.http.post<{ success: boolean; id: number }>(
            `${this.backendUrl}/admin/playlist`,
            { name, description, channelId },
            this.httpOptions
        );
    }

    // Add video to playlist
    addVideoToPlaylist(playlistId: number, videoData: any): Observable<{ success: boolean; videoId: number }> {
        return this.http.post<{ success: boolean; videoId: number }>(
            `${this.backendUrl}/admin/playlist/video`,
            { playlistId, videoData },
            this.httpOptions
        );
    }

    // Remove video from playlist
    removeVideoFromPlaylist(playlistId: number, videoId: string): Observable<{ success: boolean }> {
        return this.http.delete<{ success: boolean }>(
            `${this.backendUrl}/admin/playlist/${playlistId}/video/${encodeURIComponent(videoId)}`,
            this.httpOptions
        );
    }

    // Fetch video year
    fetchVideoYear(title: string, videoId?: string): Observable<{ year: number | null }> {
        return this.http.post<{ year: number | null }>(
            `${this.backendUrl}/admin/fetch-year`,
            { title, videoId },
            this.httpOptions
        );
    }

    // ============================================
    // LISTS BROWSER METHODS
    // ============================================

    /**
     * Scan videos - fetches YouTube metadata, checks DB existence, and bumper status
     */
    scanVideos(videoIds: string[]): Observable<{
        videos: YoutubeMetadata[];
        dbStatus: VideoExistenceCheck;
        bumperStatus: { [videoId: string]: { isBumper: boolean; title?: string; duration?: number } };
    }> {
        return this.http.post<{
            videos: YoutubeMetadata[];
            dbStatus: VideoExistenceCheck;
            bumperStatus: { [videoId: string]: { isBumper: boolean; title?: string; duration?: number } };
        }>(
            `${this.backendUrl}/admin/scan-videos`,
            { videoIds },
            this.httpOptions
        );
    }

    /**
     * Add video to bumpers
     */
    addBumper(youtube_video_id: string, title: string, duration_seconds: number): Observable<{ success: boolean; id?: number; error?: string }> {
        return this.http.post<{ success: boolean; id?: number; error?: string }>(
            `${this.backendUrl}/admin/bumper`,
            { youtube_video_id, title, duration_seconds },
            this.httpOptions
        );
    }

    /**
     * Remove video from bumpers
     */
    removeBumper(videoId: string): Observable<{ success: boolean; error?: string }> {
        return this.http.delete<{ success: boolean; error?: string }>(
            `${this.backendUrl}/admin/bumper/${encodeURIComponent(videoId)}`,
            this.httpOptions
        );
    }

    /**
     * Get all list categories with their video counts
     */
    getListCategories(): Observable<{ categories: { name: string; count: number }[] }> {
        return this.http.get<{ categories: { name: string; count: number }[] }>(
            `${this.backendUrl}/admin/lists`,
            this.httpOptions
        );
    }

    /**
     * Get paginated videos from a list category
     */
    getListVideos(category: string, page: number = 1, pageSize: number = 50): Observable<{
        category: string;
        page: number;
        pageSize: number;
        totalPages: number;
        totalItems: number;
        videoIds: string[];
    }> {
        return this.http.get<{
            category: string;
            page: number;
            pageSize: number;
            totalPages: number;
            totalItems: number;
            videoIds: string[];
        }>(
            `${this.backendUrl}/admin/lists/${encodeURIComponent(category)}?page=${page}&pageSize=${pageSize}`,
            this.httpOptions
        );
    }

    /**
     * Get paginated videos from a YouTube playlist
     */
    getYoutubePlaylistVideos(playlistId: string, page: number = 1, pageSize: number = 50): Observable<{
        playlistId: string;
        title: string;
        page: number;
        pageSize: number;
        totalPages: number;
        totalItems: number;
        videoIds: string[];
    }> {
        return this.http.get<{
            playlistId: string;
            title: string;
            page: number;
            pageSize: number;
            totalPages: number;
            totalItems: number;
            videoIds: string[];
        }>(
            `${this.backendUrl}/admin/youtube-playlist/${encodeURIComponent(playlistId)}?page=${page}&pageSize=${pageSize}`,
            this.httpOptions
        );
    }
}
