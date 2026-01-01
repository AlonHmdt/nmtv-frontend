import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class ModalStateService {
  // Track if any modal is currently open
  private _isAnyModalOpen = signal(false);
  
  isAnyModalOpen = this._isAnyModalOpen.asReadonly();

  openModal(): void {
    this._isAnyModalOpen.set(true);
  }

  closeModal(): void {
    this._isAnyModalOpen.set(false);
  }
}
