import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { AdminService, YoutubeMetadata, VideoExistenceCheck, Channel, Playlist } from '../../services/admin.service';

interface VideoUIState {
    id: string; // YouTube ID
    metadata?: YoutubeMetadata;
    existsInDb?: boolean;
    dbInfo?: VideoExistenceCheck['videoId'];
    isBumper?: boolean;
    bumperProcessing?: boolean;
    safeUrl: SafeResourceUrl;
    selectedChannelId?: string;
    selectedPlaylistIds: number[]; // Multiple playlists
    newPlaylistName?: string;
    newPlaylistDesc?: string;
    isProcessing?: boolean;
    message?: string;
    messageType?: 'success' | 'error';
    year?: number | null;
    yearFetching?: boolean;
    showPreview?: boolean;
}

@Component({
    selector: 'app-admin',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './admin.component.html',
    styleUrls: ['./admin.component.scss']
})
export class AdminComponent {
    private adminService = inject(AdminService);
    private sanitizer = inject(DomSanitizer);
    private router = inject(Router);

    // Input
    inputList = signal<string>('');

    // State
    processedVideos = signal<VideoUIState[]>([]);
    isLoading = signal<boolean>(false);
    copiedId = signal<string | null>(null);

    // Data for dropdowns
    channels = signal<Channel[]>([]);
    playlistsByChannel = signal<Record<string, Playlist[]>>({});

    // Lists browser state
    listCategories = signal<{ name: string; count: number }[]>([]);
    selectedListCategory = signal<string>('');
    listCurrentPage = signal<number>(1);
    listTotalPages = signal<number>(0);
    listTotalItems = signal<number>(0);
    isLoadingList = signal<boolean>(false);

    // YouTube playlist browser state
    ytPlaylistInput = signal<string>('');
    ytPlaylistTitle = signal<string>('');
    ytPlaylistId = signal<string>('');
    ytPlaylistError = signal<string>('');
    isLoadingYtPlaylist = signal<boolean>(false);

    constructor() {
        this.loadChannels();
        this.loadListCategories();
    }

    copyToClipboard(text: string) {
        navigator.clipboard.writeText(text).then(() => {
            this.copiedId.set(text);
            setTimeout(() => this.copiedId.set(null), 2000);
        });
    }

    loadChannels() {
        this.adminService.getChannels().subscribe({
            next: (data) => this.channels.set(data),
            error: (err) => console.error('Failed to load channels', err)
        });
    }

    onChannelSelect(video: VideoUIState, channelId: string) {
        video.selectedChannelId = channelId;
        video.selectedPlaylistIds = []; // Reset playlists

        if (!this.playlistsByChannel()[channelId]) {
            this.adminService.getPlaylistsForChannel(channelId).subscribe({
                next: (playlists) => {
                    this.playlistsByChannel.update(map => ({
                        ...map,
                        [channelId]: playlists
                    }));
                },
                error: (err) => console.error('Failed to load playlists', err)
            });
        }
    }

    getPlaylists(channelId?: string): Playlist[] {
        if (!channelId) return [];
        return this.playlistsByChannel()[channelId] || [];
    }

    // Error message for input validation
    inputError = signal<string>('');

    async processInput() {
        const rawInput = this.inputList();
        if (!rawInput.trim()) return;

        this.inputError.set('');

        // Clear list browser state when manually processing
        this.selectedListCategory.set('');
        this.listCurrentPage.set(1);
        this.listTotalPages.set(0);
        this.listTotalItems.set(0);

        // Clear YouTube playlist state
        this.ytPlaylistId.set('');
        this.ytPlaylistTitle.set('');
        this.ytPlaylistError.set('');

        // Parse IDs (handle commas, newlines, quotes)
        const ids = rawInput
            .split(/[\n,]+/)
            .map(id => id.trim().replace(/['"]/g, ''))
            .filter(id => id.length > 0);

        // Dedupe
        const uniqueIds = [...new Set(ids)];

        if (uniqueIds.length === 0) {
            return;
        }

        // Limit to 50 video IDs
        if (uniqueIds.length > 50) {
            this.inputError.set(`Maximum 50 video IDs allowed. You entered ${uniqueIds.length}.`);
            return;
        }

        this.isLoading.set(true);
        this.processedVideos.set([]);

        try {
            // Single request to fetch YouTube metadata AND check DB existence
            const response = await this.adminService.scanVideos(uniqueIds).toPromise();

            const uiStates: VideoUIState[] = uniqueIds.map(id => {
                const meta = response?.videos.find(m => m.id === id);
                const dbInfo = response?.dbStatus?.[id];
                const bumperInfo = response?.bumperStatus?.[id];

                return {
                    id,
                    metadata: meta,
                    existsInDb: dbInfo?.exists || false,
                    dbInfo: dbInfo,
                    isBumper: bumperInfo?.isBumper || false,
                    safeUrl: this.sanitizer.bypassSecurityTrustResourceUrl(`https://www.youtube.com/embed/${id}`),
                    selectedChannelId: '',
                    selectedPlaylistIds: []
                };
            });

            this.processedVideos.set(uiStates);
        } catch (error) {
            console.error('Error scanning videos:', error);
        } finally {
            this.isLoading.set(false);
        }
    }

    togglePlaylistSelection(video: VideoUIState, playlistId: number) {
        const index = video.selectedPlaylistIds.indexOf(playlistId);
        if (index === -1) {
            video.selectedPlaylistIds.push(playlistId);
        } else {
            video.selectedPlaylistIds.splice(index, 1);
        }
    }

    isPlaylistSelected(video: VideoUIState, playlistId: number): boolean {
        return video.selectedPlaylistIds.includes(playlistId);
    }

    async addToPlaylists(video: VideoUIState) {
        if (!video.selectedChannelId || video.selectedPlaylistIds.length === 0) return;

        // 1. Start processing
        this.updateVideoState(video.id, { isProcessing: true, message: '' });

        try {
            // Get current state of this video
            let currentVideo = this.processedVideos().find(v => v.id === video.id);
            if (!currentVideo) return;

            // Ensure we have metadata before adding
            let metadata = currentVideo.metadata;
            if (!metadata || !metadata.duration) {
                // Fetch metadata on demand
                const fetched = await this.adminService.fetchYoutubeMetadata([video.id]).toPromise();
                if (fetched && fetched.length > 0) {
                    metadata = fetched[0];
                    this.updateVideoState(video.id, { metadata });
                } else {
                    throw new Error('Could not fetch video metadata from YouTube');
                }
            }

            // Prepare video data
            const videoData = {
                youtube_video_id: metadata!.id,
                title: metadata!.title,
                artist: metadata!.artist,
                song: metadata!.song,
                duration_seconds: metadata!.duration
            };

            // Add to each selected playlist
            const playlistIds = currentVideo.selectedPlaylistIds;
            let successCount = 0;
            let errors: string[] = [];

            for (const playlistId of playlistIds) {
                try {
                    const addRes = await this.adminService.addVideoToPlaylist(playlistId, videoData).toPromise();
                    if (addRes?.success) {
                        successCount++;
                    }
                } catch (e: any) {
                    errors.push(e.error?.error || `Playlist ${playlistId} failed`);
                }
            }

            // Refresh DB info
            const newCheck = await this.adminService.checkVideosExistence([video.id]).toPromise();

            if (successCount === playlistIds.length) {
                this.updateVideoState(video.id, {
                    message: `Added to ${successCount} playlist${successCount > 1 ? 's' : ''}!`,
                    messageType: 'success',
                    existsInDb: true,
                    isProcessing: false,
                    selectedPlaylistIds: [],
                    dbInfo: (newCheck && newCheck[video.id]) ? newCheck[video.id] : undefined
                });
            } else if (successCount > 0) {
                this.updateVideoState(video.id, {
                    message: `Added to ${successCount}/${playlistIds.length} playlists`,
                    messageType: 'success',
                    existsInDb: true,
                    isProcessing: false,
                    selectedPlaylistIds: [],
                    dbInfo: (newCheck && newCheck[video.id]) ? newCheck[video.id] : undefined
                });
            } else {
                throw new Error(errors[0] || 'Failed to add to playlists');
            }

        } catch (err: any) {
            this.updateVideoState(video.id, {
                message: err.message || 'Error occurred',
                messageType: 'error',
                isProcessing: false
            });
        }
    }


    async fetchYear(video: VideoUIState) {
        this.updateVideoState(video.id, { yearFetching: true });

        try {
            // If we don't have metadata (title) yet, fetch it from YouTube first
            if (!video.metadata?.title) {
                const fetched = await this.adminService.fetchYoutubeMetadata([video.id]).toPromise();
                if (fetched && fetched.length > 0) {
                    const metadata = fetched[0];
                    // Update state with new metadata
                    this.updateVideoState(video.id, { metadata });
                    // Update local reference for the next step
                    video.metadata = metadata;
                } else {
                    throw new Error('Could not fetch video metadata (needed for year)');
                }
            }

            // Now we definitely have a title
            if (video.metadata?.title) {
                const res = await this.adminService.fetchVideoYear(video.metadata.title, video.id).toPromise();
                this.updateVideoState(video.id, {
                    year: res?.year,
                    yearFetching: false
                });
            } else {
                this.updateVideoState(video.id, { yearFetching: false });
            }

        } catch (error) {
            console.error('Error fetching year:', error);
            this.updateVideoState(video.id, { yearFetching: false });
        }
    }

    togglePreview(video: VideoUIState) {
        this.updateVideoState(video.id, { showPreview: true });
    }

    // Helper to update a specific video's state in the signal array
    private updateVideoState(id: string, partialState: Partial<VideoUIState>) {
        this.processedVideos.update(videos =>
            videos.map(v => v.id === id ? { ...v, ...partialState } : v)
        );
    }

    refreshPlaylists(channelId: string) {
        this.adminService.getPlaylistsForChannel(channelId).subscribe({
            next: (playlists) => {
                this.playlistsByChannel.update(map => ({
                    ...map,
                    [channelId]: playlists
                }));
            }
        });
    }

    logout() {
        this.adminService.logout().subscribe({
            next: () => this.router.navigate(['/admin/login']),
            error: () => this.router.navigate(['/admin/login'])
        });
    }

    // ============================================
    // LISTS BROWSER METHODS
    // ============================================

    loadListCategories() {
        this.adminService.getListCategories().subscribe({
            next: (response) => {
                this.listCategories.set(response.categories);
            },
            error: (err) => {
                console.error('Failed to load list categories:', err);
            }
        });
    }

    onListCategorySelect(categoryName: string) {
        if (!categoryName) return;

        // Clear YouTube playlist state
        this.ytPlaylistId.set('');
        this.ytPlaylistTitle.set('');
        this.ytPlaylistError.set('');

        this.selectedListCategory.set(categoryName);
        this.listCurrentPage.set(1);
        this.loadListPage(categoryName, 1);
    }

    loadListPage(category: string, page: number) {
        this.isLoadingList.set(true);
        this.isLoading.set(true);
        this.processedVideos.set([]);

        this.adminService.getListVideos(category, page).subscribe({
            next: async (response) => {
                this.listCurrentPage.set(response.page);
                this.listTotalPages.set(response.totalPages);
                this.listTotalItems.set(response.totalItems);

                // Single request to fetch YouTube metadata AND check DB existence
                try {
                    const scanResult = await this.adminService.scanVideos(response.videoIds).toPromise();

                    const uiStates: VideoUIState[] = response.videoIds.map(id => {
                        const meta = scanResult?.videos.find(m => m.id === id);
                        const dbInfo = scanResult?.dbStatus?.[id];
                        const bumperInfo = scanResult?.bumperStatus?.[id];

                        return {
                            id,
                            metadata: meta,
                            existsInDb: dbInfo?.exists || false,
                            dbInfo: dbInfo,
                            isBumper: bumperInfo?.isBumper || false,
                            safeUrl: this.sanitizer.bypassSecurityTrustResourceUrl(`https://www.youtube.com/embed/${id}`),
                            selectedChannelId: '',
                            selectedPlaylistIds: []
                        };
                    });

                    this.processedVideos.set(uiStates);
                } catch (error) {
                    console.error('Failed to scan videos:', error);
                    // Still show video IDs even if scan fails
                    const uiStates: VideoUIState[] = response.videoIds.map(id => ({
                        id,
                        metadata: undefined,
                        existsInDb: false,
                        isBumper: false,
                        safeUrl: this.sanitizer.bypassSecurityTrustResourceUrl(`https://www.youtube.com/embed/${id}`),
                        selectedChannelId: '',
                        selectedPlaylistIds: []
                    }));
                    this.processedVideos.set(uiStates);
                }

                this.isLoadingList.set(false);
                this.isLoading.set(false);
            },
            error: (err) => {
                console.error('Failed to load list videos:', err);
                this.isLoadingList.set(false);
                this.isLoading.set(false);
            }
        });
    }

    onListPageChange(page: number) {
        const category = this.selectedListCategory();
        if (!category || page < 1 || page > this.listTotalPages()) return;

        this.loadListPage(category, page);
    }

    onJumpToPage(event: Event) {
        const input = event.target as HTMLInputElement;
        const page = parseInt(input.value, 10);
        if (!isNaN(page)) {
            if (this.ytPlaylistId()) {
                this.onYtPlaylistPageChange(page);
            } else {
                this.onListPageChange(page);
            }
        }
    }

    onJumpToPageFromInput(event: Event) {
        const button = event.target as HTMLButtonElement;
        const input = button.previousElementSibling as HTMLInputElement;
        const page = parseInt(input.value, 10);
        if (!isNaN(page)) {
            if (this.ytPlaylistId()) {
                this.onYtPlaylistPageChange(page);
            } else {
                this.onListPageChange(page);
            }
        }
    }

    getPageNumbers(): number[] {
        const current = this.listCurrentPage();
        const total = this.listTotalPages();

        if (total <= 7) {
            return Array.from({ length: total }, (_, i) => i + 1);
        }

        // Show: 1 ... current-1, current, current+1 ... total
        const pages: number[] = [];

        pages.push(1);

        if (current > 3) {
            pages.push(-1); // -1 represents "..."
        }

        for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) {
            pages.push(i);
        }

        if (current < total - 2) {
            pages.push(-1); // -1 represents "..."
        }

        if (total > 1) {
            pages.push(total);
        }

        return pages;
    }

    // ============================================
    // YOUTUBE PLAYLIST BROWSER
    // ============================================

    extractPlaylistId(input: string): string | null {
        const trimmed = input.trim();
        
        // Direct playlist ID (starts with PL, UU, etc.)
        if (/^[A-Za-z0-9_-]{10,}$/.test(trimmed) && !trimmed.includes('/')) {
            return trimmed;
        }

        // URL patterns
        const patterns = [
            /[?&]list=([A-Za-z0-9_-]+)/,  // ?list=XXX or &list=XXX
            /\/playlist\/([A-Za-z0-9_-]+)/ // /playlist/XXX
        ];

        for (const pattern of patterns) {
            const match = trimmed.match(pattern);
            if (match) {
                return match[1];
            }
        }

        return null;
    }

    loadYoutubePlaylist() {
        const input = this.ytPlaylistInput();
        if (!input.trim()) return;

        const playlistId = this.extractPlaylistId(input);
        if (!playlistId) {
            this.ytPlaylistError.set('Invalid playlist URL or ID');
            return;
        }

        this.ytPlaylistError.set('');
        this.ytPlaylistId.set(playlistId);
        
        // Clear lists.js browser state
        this.selectedListCategory.set('');
        
        // Load first page
        this.loadYtPlaylistPage(playlistId, 1);
    }

    loadYtPlaylistPage(playlistId: string, page: number) {
        this.isLoadingYtPlaylist.set(true);
        this.isLoading.set(true);
        this.processedVideos.set([]);

        this.adminService.getYoutubePlaylistVideos(playlistId, page).subscribe({
            next: async (response) => {
                this.ytPlaylistTitle.set(response.title);
                this.listCurrentPage.set(response.page);
                this.listTotalPages.set(response.totalPages);
                this.listTotalItems.set(response.totalItems);

                // Scan videos for metadata
                try {
                    const scanResult = await this.adminService.scanVideos(response.videoIds).toPromise();

                    const uiStates: VideoUIState[] = response.videoIds.map(id => {
                        const meta = scanResult?.videos.find(m => m.id === id);
                        const dbInfo = scanResult?.dbStatus?.[id];
                        const bumperInfo = scanResult?.bumperStatus?.[id];

                        return {
                            id,
                            metadata: meta,
                            existsInDb: dbInfo?.exists || false,
                            dbInfo: dbInfo,
                            isBumper: bumperInfo?.isBumper || false,
                            safeUrl: this.sanitizer.bypassSecurityTrustResourceUrl(`https://www.youtube.com/embed/${id}`),
                            selectedChannelId: '',
                            selectedPlaylistIds: []
                        };
                    });

                    this.processedVideos.set(uiStates);
                } catch (error) {
                    console.error('Failed to scan videos:', error);
                    const uiStates: VideoUIState[] = response.videoIds.map(id => ({
                        id,
                        metadata: undefined,
                        existsInDb: false,
                        isBumper: false,
                        safeUrl: this.sanitizer.bypassSecurityTrustResourceUrl(`https://www.youtube.com/embed/${id}`),
                        selectedChannelId: '',
                        selectedPlaylistIds: []
                    }));
                    this.processedVideos.set(uiStates);
                }

                this.isLoadingYtPlaylist.set(false);
                this.isLoading.set(false);
            },
            error: (err) => {
                console.error('Failed to load YouTube playlist:', err);
                this.ytPlaylistError.set(err.error?.error || 'Failed to load playlist');
                this.isLoadingYtPlaylist.set(false);
                this.isLoading.set(false);
            }
        });
    }

    onYtPlaylistPageChange(page: number) {
        const playlistId = this.ytPlaylistId();
        if (!playlistId || page < 1 || page > this.listTotalPages()) return;

        this.loadYtPlaylistPage(playlistId, page);
    }

    // ============================================
    // BUMPER MANAGEMENT
    // ============================================

    toggleBumper(video: VideoUIState) {
        if (video.isBumper) {
            this.removeBumper(video);
        } else {
            this.addBumper(video);
        }
    }

    addBumper(video: VideoUIState) {
        if (!video.metadata) {
            this.updateVideoState(video.id, {
                message: 'Need metadata to add as bumper',
                messageType: 'error'
            });
            return;
        }

        this.updateVideoState(video.id, { bumperProcessing: true, message: '' });

        this.adminService.addBumper(
            video.id,
            video.metadata.title,
            video.metadata.duration
        ).subscribe({
            next: (res) => {
                if (res.success) {
                    this.updateVideoState(video.id, {
                        isBumper: true,
                        bumperProcessing: false,
                        message: 'Added to bumpers',
                        messageType: 'success'
                    });
                } else {
                    this.updateVideoState(video.id, {
                        bumperProcessing: false,
                        message: res.error || 'Failed to add',
                        messageType: 'error'
                    });
                }
            },
            error: (err) => {
                this.updateVideoState(video.id, {
                    bumperProcessing: false,
                    message: err.error?.error || 'Failed to add bumper',
                    messageType: 'error'
                });
            }
        });
    }

    removeBumper(video: VideoUIState) {
        this.updateVideoState(video.id, { bumperProcessing: true, message: '' });

        this.adminService.removeBumper(video.id).subscribe({
            next: (res) => {
                if (res.success) {
                    this.updateVideoState(video.id, {
                        isBumper: false,
                        bumperProcessing: false,
                        message: 'Removed from bumpers',
                        messageType: 'success'
                    });
                } else {
                    this.updateVideoState(video.id, {
                        bumperProcessing: false,
                        message: res.error || 'Failed to remove',
                        messageType: 'error'
                    });
                }
            },
            error: (err) => {
                this.updateVideoState(video.id, {
                    bumperProcessing: false,
                    message: err.error?.error || 'Failed to remove bumper',
                    messageType: 'error'
                });
            }
        });
    }

    // ============================================
    // REMOVE FROM PLAYLIST
    // ============================================

    removeFromPlaylist(video: VideoUIState, playlistId: number) {
        this.updateVideoState(video.id, { isProcessing: true, message: '' });

        this.adminService.removeVideoFromPlaylist(playlistId, video.id).subscribe({
            next: async (res) => {
                if (res.success) {
                    // Refresh DB info to update the playlist tags
                    const newCheck = await this.adminService.checkVideosExistence([video.id]).toPromise();
                    const dbInfo = newCheck?.[video.id];

                    this.updateVideoState(video.id, {
                        isProcessing: false,
                        message: 'Removed from playlist',
                        messageType: 'success',
                        existsInDb: dbInfo?.exists || false,
                        dbInfo: dbInfo
                    });
                } else {
                    this.updateVideoState(video.id, {
                        isProcessing: false,
                        message: 'Failed to remove',
                        messageType: 'error'
                    });
                }
            },
            error: (err) => {
                this.updateVideoState(video.id, {
                    isProcessing: false,
                    message: err.error?.error || 'Failed to remove from playlist',
                    messageType: 'error'
                });
            }
        });
    }
}
