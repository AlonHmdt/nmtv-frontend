import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HelpersService } from '../../services/helpers.service';
import { SupportCornerComponent } from './support-corner.component';

describe('SupportCornerComponent', () => {
  let fixture: ComponentFixture<SupportCornerComponent>;

  async function create(isTV: boolean): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [SupportCornerComponent],
      providers: [
        provideZonelessChangeDetection(),
        { provide: HelpersService, useValue: { isTV: () => isTV } }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(SupportCornerComponent);
    await fixture.whenStable();
  }

  afterEach(() => {
    fixture?.destroy();
  });

  it('shows the "Buy me a coffee" link on phones and desktops', async () => {
    await create(false);

    expect(fixture.nativeElement.querySelector('a.support-corner')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.support-qr')).toBeNull();
  });

  it('shows a QR code instead of the link on TVs', async () => {
    await create(true);

    const qr = fixture.nativeElement.querySelector('.support-qr img') as HTMLImageElement | null;
    expect(qr?.getAttribute('src')).toBe('/images/qr-code.png');
    expect(fixture.nativeElement.querySelector('a.support-corner')).toBeNull();
  });
});
