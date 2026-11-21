import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SupportersService } from '../../services/supporters.service';
import { SECONDS_PER_NAME, SupportersTickerComponent } from './supporters-ticker.component';

describe('SupportersTickerComponent', () => {
  let fixture: ComponentFixture<SupportersTickerComponent>;
  let supporters: SupportersService;

  function el(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SupportersTickerComponent],
      providers: [provideZonelessChangeDetection()]
    }).compileComponents();

    supporters = TestBed.inject(SupportersService);
    supporters.setSupporters([{ name: 'Dana' }, { name: 'Tal' }, { name: 'Noa' }]);
    fixture = TestBed.createComponent(SupportersTickerComponent);
    await fixture.whenStable();
  });

  it('shows every supporter, twice so the scroll loops without a gap', () => {
    const names = Array.from(el().querySelectorAll('.ticker-name')).map(n => n.textContent?.trim());

    expect(names).toEqual(['Dana', 'Tal', 'Noa', 'Dana', 'Tal', 'Noa']);
  });

  it('keeps each name in its own reading direction, so Hebrew names display correctly', async () => {
    supporters.setSupporters([{ name: 'Dana' }, { name: 'מעיין ספייר' }]);
    await fixture.whenStable();

    const isolated = Array.from(el().querySelectorAll('.ticker-name bdi')).map(n => n.textContent);
    expect(isolated).toEqual(['Dana', 'מעיין ספייר', 'Dana', 'מעיין ספייר']);
  });

  it('shows the thanks badge', () => {
    expect(el().querySelector('.ticker-badge')?.textContent).toContain('Thanks');
  });

  it('reads the names once to screen readers', () => {
    const ticker = el().querySelector('.ticker')!;

    expect(ticker.getAttribute('aria-label')).toBe('Thank you to our supporters: Dana, Tal, Noa');
    expect(el().querySelector('.ticker-window')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('is not shown when there is nobody to thank', async () => {
    supporters.setSupporters([]);
    await fixture.whenStable();

    expect(el().querySelector('.ticker')).toBeNull();
  });

  it('updates when the list changes', async () => {
    supporters.setSupporters([{ name: 'Yossi K.' }]);
    await fixture.whenStable();

    const names = Array.from(el().querySelectorAll('.ticker-name')).map(n => n.textContent?.trim());
    expect(names).toEqual(['Yossi K.', 'Yossi K.']);
  });

  describe('scroll speed', () => {
    it('never loops faster than 12 seconds', () => {
      expect(fixture.componentInstance.durationSeconds()).toBe(12);
      expect((el().querySelector('.ticker-track') as HTMLElement).style.animationDuration).toBe('12s');
    });

    it('gives every name the same time on screen as the list grows', async () => {
      supporters.setSupporters(Array.from({ length: 10 }, (_, i) => ({ name: `Supporter ${i}` })));
      await fixture.whenStable();

      expect(fixture.componentInstance.durationSeconds()).toBe(10 * SECONDS_PER_NAME);
    });
  });

  it('switches to the TV layout', async () => {
    expect(el().classList).not.toContain('tv');

    fixture.componentRef.setInput('tv', true);
    await fixture.whenStable();

    expect(el().classList).toContain('tv');
  });
});
