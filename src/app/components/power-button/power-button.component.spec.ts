import { provideZonelessChangeDetection, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ShareLinkService } from '../../services/share-link.service';
import { PowerButtonComponent } from './power-button.component';

describe('PowerButtonComponent - shared clip notice', () => {
  let fixture: ComponentFixture<PowerButtonComponent>;
  let sharedClipPending: ReturnType<typeof signal<boolean>>;

  function noticeText(): string | null {
    const notice = fixture.nativeElement.querySelector('.shared-clip-notice');
    return notice ? notice.textContent.trim() : null;
  }

  beforeEach(async () => {
    sharedClipPending = signal(false);

    await TestBed.configureTestingModule({
      imports: [PowerButtonComponent],
      providers: [
        provideZonelessChangeDetection(),
        { provide: ShareLinkService, useValue: { sharedClipPending } }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(PowerButtonComponent);
  });

  it('shows no notice on a normal visit', async () => {
    await fixture.whenStable();
    expect(noticeText()).toBeNull();
  });

  it('tells the visitor a clip was shared with them', async () => {
    sharedClipPending.set(true);
    await fixture.whenStable();

    expect(noticeText()).toBe('Someone taped this one for you');
  });

  it('hides the notice once the clip is no longer waiting', async () => {
    sharedClipPending.set(true);
    await fixture.whenStable();
    expect(noticeText()).not.toBeNull();

    sharedClipPending.set(false);
    await fixture.whenStable();
    expect(noticeText()).toBeNull();
  });
});
