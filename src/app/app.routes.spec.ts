import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { routes } from './app.routes';

describe('app routes - channel links', () => {
  let router: Router;

  // No <router-outlet> is rendered here, so navigation resolves routes without creating components
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), provideRouter(routes)]
    });
    router = TestBed.inject(Router);
  });

  it('keeps channel links as they are', async () => {
    for (const url of ['/rock', '/hiphop', '/2000s', '/1990s', '/1980s', '/live', '/shows', '/random', '/special']) {
      await router.navigateByUrl(url);
      expect(router.url).withContext(url).toBe(url);
    }
  });

  it('keeps the shared clip on a channel link', async () => {
    await router.navigateByUrl('/rock?v=hTWKbfoikeg');
    expect(router.url).toBe('/rock?v=hTWKbfoikeg');
  });

  it('keeps the shared clip on the home page', async () => {
    await router.navigateByUrl('/?v=hTWKbfoikeg');
    expect(router.url).toBe('/?v=hTWKbfoikeg');
  });

  it('sends unknown paths home', async () => {
    await router.navigateByUrl('/polka');
    expect(router.url).toBe('/');
  });

  it('sends the hidden NOA channel home', async () => {
    await router.navigateByUrl('/noa');
    expect(router.url).toBe('/');
  });

  it('sends unknown paths home but keeps the shared clip', async () => {
    await router.navigateByUrl('/polka?v=hTWKbfoikeg');
    expect(router.url).toBe('/?v=hTWKbfoikeg');
  });

  it('drops an invalid clip when sending unknown paths home', async () => {
    await router.navigateByUrl('/polka?v=nope&utm_source=x');
    expect(router.url).toBe('/');
  });

  it('does not treat deeper paths as channel links', async () => {
    await router.navigateByUrl('/rock/extra');
    expect(router.url).toBe('/');
  });

  it('still opens the privacy policy', async () => {
    await router.navigateByUrl('/privacy-policy');
    expect(router.url).toBe('/privacy-policy');
  });
});
