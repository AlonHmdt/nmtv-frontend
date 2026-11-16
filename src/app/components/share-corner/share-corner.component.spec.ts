import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HelpersService } from '../../services/helpers.service';
import { ShareLinkService, ShareResult } from '../../services/share-link.service';
import { ShareCornerComponent } from './share-corner.component';

describe('ShareCornerComponent', () => {
  let fixture: ComponentFixture<ShareCornerComponent>;
  let share: jasmine.Spy;
  let isAndroidTV: boolean;

  function button(): HTMLButtonElement | null {
    return fixture.nativeElement.querySelector('button.share-corner');
  }

  function labelText(): string {
    return fixture.nativeElement.querySelector('.label')?.textContent.replace(/\s+/g, ' ').trim() ?? '';
  }

  async function create(shareResult: ShareResult = 'copied'): Promise<void> {
    share = jasmine.createSpy('share').and.resolveTo(shareResult);

    await TestBed.configureTestingModule({
      imports: [ShareCornerComponent],
      providers: [
        provideZonelessChangeDetection(),
        { provide: ShareLinkService, useValue: { share } },
        { provide: HelpersService, useValue: { isAndroidTV: () => isAndroidTV } }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ShareCornerComponent);
    await fixture.whenStable();
  }

  beforeEach(() => {
    isAndroidTV = false;
  });

  afterEach(() => {
    fixture?.destroy();
  });

  it('shows the share corner', async () => {
    await create();

    expect(button()).not.toBeNull();
    expect(labelText()).toContain('Share this clip');
  });

  it('is hidden on Android TV', async () => {
    isAndroidTV = true;
    await create();

    expect(button()).toBeNull();
  });

  it('shares what is playing when clicked', async () => {
    await create();

    button()!.click();
    await fixture.whenStable();

    expect(share).toHaveBeenCalledOnceWith('corner');
  });

  it('confirms when the link was copied', async () => {
    await create('copied');

    await fixture.componentInstance.onClick();
    await fixture.whenStable();

    expect(labelText()).toContain('Link copied!');
    expect(button()!.classList).toContain('copied');
  });

  it('goes back to the share label after two seconds', async () => {
    await create('copied');
    jasmine.clock().install();

    try {
      await fixture.componentInstance.onClick();
      expect(fixture.componentInstance.copied()).toBeTrue();

      jasmine.clock().tick(2000);
      expect(fixture.componentInstance.copied()).toBeFalse();
    } finally {
      jasmine.clock().uninstall();
    }
  });

  it('shows no "copied" confirmation after the native share sheet', async () => {
    await create('shared');

    await fixture.componentInstance.onClick();
    await fixture.whenStable();

    expect(labelText()).toContain('Share this clip');
    expect(labelText()).not.toContain('Link copied!');
  });

  it('shows no confirmation when sharing was cancelled or failed', async () => {
    await create('cancelled');
    await fixture.componentInstance.onClick();
    expect(fixture.componentInstance.copied()).toBeFalse();
  });
});
