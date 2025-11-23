import { Injectable } from '@angular/core';

@Injectable({
    providedIn: 'root'
})
export class HelpersService {
    constructor() {}

    isIOSDevice(): boolean {
        if (typeof navigator === 'undefined' || typeof window === 'undefined') {
            return false;
        }
        return /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    }
}