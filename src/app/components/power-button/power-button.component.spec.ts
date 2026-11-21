import { provideZonelessChangeDetection, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ShareLinkService } from '../../services/share-link.service';
import { SupportersService } from '../../services/supporters.service';
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

describe('PowerButtonComponent - supporter thank-you', () => {
  async function render(picked: { name: string } | null): Promise<ComponentFixture<PowerButtonComponent>> {
    await TestBed.configureTestingModule({
      imports: [PowerButtonComponent],
      providers: [
        provideZonelessChangeDetection(),
        { provide: ShareLinkService, useValue: { sharedClipPending: signal(false) } },
        { provide: SupportersService, useValue: { pickRandom: jasmine.createSpy('pickRandom').and.returnValue(picked) } }
      ]
    }).compileComponents();

    const fixture = TestBed.createComponent(PowerButtonComponent);
    await fixture.whenStable();
    return fixture;
  }

  function supportLine(fixture: ComponentFixture<PowerButtonComponent>): string {
    return (fixture.nativeElement.querySelector('.support-text')?.textContent ?? '').replace(/\s+/g, ' ').trim();
  }

  it('thanks one supporter by name on its own line between the credit and the invite', async () => {
    const fixture = await render({ name: 'Dana' });

    expect(fixture.nativeElement.querySelectorAll('.support-text').length).toBe(1);
    const lines = Array.from(fixture.nativeElement.querySelector('.support-text').children as HTMLCollection).map(
      line => (line.textContent ?? '').trim()
    );
    expect(lines).toEqual(['This broadcast is brought to you by', 'Dana', 'Your name here next?']);
    expect(fixture.nativeElement.querySelector('.support-cta')?.textContent.trim()).toBe('Your name here next?');
    expect(fixture.nativeElement.querySelector('.supporter-name')?.textContent.trim()).toBe('Dana');
  });

  it('picks the supporter once per visit', async () => {
    const fixture = await render({ name: 'Dana' });
    const service = TestBed.inject(SupportersService);

    fixture.detectChanges();
    await fixture.whenStable();

    expect(service.pickRandom).toHaveBeenCalledTimes(1);
  });

  it('falls back to the general line when there are no supporters', async () => {
    const fixture = await render(null);

    expect(supportLine(fixture)).toBe('Enjoying NMTV? Help keep the music playing!');
    expect(fixture.nativeElement.querySelector('.supporter-name')).toBeNull();
  });
});
