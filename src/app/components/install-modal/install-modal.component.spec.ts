import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HelpersService } from '../../services/helpers.service';
import { TvPlatform } from '../../utils/tv-platform.utils';
import { InstallModalComponent } from './install-modal.component';

describe('InstallModalComponent', () => {
  let fixture: ComponentFixture<InstallModalComponent>;
  let tvPlatform: TvPlatform | null;

  async function openModal(): Promise<InstallModalComponent> {
    await TestBed.configureTestingModule({
      imports: [InstallModalComponent],
      providers: [
        provideZonelessChangeDetection(),
        {
          provide: HelpersService,
          useValue: { isTvBrowser: () => tvPlatform !== null, getTvPlatform: () => tvPlatform }
        }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(InstallModalComponent);
    fixture.componentInstance.open();
    await fixture.whenStable();
    return fixture.componentInstance;
  }

  function text(): string {
    return fixture.nativeElement.textContent.replace(/\s+/g, ' ');
  }

  afterEach(() => {
    fixture?.componentInstance.close();
    fixture?.destroy();
  });

  it('shows the install options on phones and desktops', async () => {
    tvPlatform = null;
    const modal = await openModal();

    expect(modal.currentView()).toBe('menu');
    expect(text()).toContain('Install on this device');
  });

  it('goes straight to the Downloader instructions on a TV browser', async () => {
    tvPlatform = 'firetv';
    const modal = await openModal();

    expect(modal.currentView()).toBe('tv-apk');
    expect(text()).toContain('Downloader');
    expect(text()).toContain('nmtv.online/apk');
    expect(text()).not.toContain('Install on this device');
  });

  it('closes with the Back button of a TV remote', async () => {
    tvPlatform = 'firetv';
    const modal = await openModal();

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'GoBack', keyCode: 461 } as KeyboardEventInit));

    expect(modal.isOpen()).toBeFalse();
  });
});
