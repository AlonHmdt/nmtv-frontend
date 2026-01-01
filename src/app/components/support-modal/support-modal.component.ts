import { Component, signal, ChangeDetectionStrategy, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ModalStateService } from '../../services/modal-state.service';

@Component({
  selector: 'app-support-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './support-modal.component.html',
  styleUrl: './support-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SupportModalComponent implements OnInit, OnDestroy {
  private modalState = inject(ModalStateService);

  isOpen = signal(false);

  ngOnInit(): void {
    // Lifecycle method for cleanup
  }

  ngOnDestroy(): void {
    window.removeEventListener('keydown', this.handleEscapeKey);
    window.removeEventListener('keydown', this.handleArrowKeys);
  }

  open(): void {
    this.isOpen.set(true);
    // Notify global modal state
    this.modalState.openModal();
    // Add event listeners when modal opens
    window.addEventListener('keydown', this.handleEscapeKey);
    window.addEventListener('keydown', this.handleArrowKeys);
  }

  close(): void {
    this.isOpen.set(false);
    // Notify global modal state
    this.modalState.closeModal();
    // Remove event listeners when modal closes
    window.removeEventListener('keydown', this.handleEscapeKey);
    window.removeEventListener('keydown', this.handleArrowKeys);
  }

  private handleEscapeKey = (event: KeyboardEvent): void => {
    if (event.key === 'Escape' && this.isOpen()) {
      event.preventDefault();
      this.close();
    }
  };

  private handleArrowKeys = (event: KeyboardEvent): void => {
    // Stop arrow key propagation when modal is open to prevent video player control
    if (this.isOpen() && (event.key === 'ArrowUp' || event.key === 'ArrowDown' || event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
      event.stopPropagation();
      // Allow default behavior
    }
  };
}
