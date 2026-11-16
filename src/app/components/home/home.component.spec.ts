import { CUSTOM_ELEMENTS_SCHEMA, provideZonelessChangeDetection, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Channel } from '../../models/video.model';
import { QueueService } from '../../services/queue.service';
import { ShareLinkService } from '../../services/share-link.service';
import { YoutubeService } from '../../services/youtube.service';
import { ShareLink } from '../../utils/share-link.utils';
import { HomeComponent } from './home.component';

describe('HomeComponent - landing on a link', () => {
  let initializeQueue: jasmine.Spy;
  let resolveLandingChannel: jasmine.Spy;
  let markSharedClipOpened: jasmine.Spy;
  let landing: ShareLink;

  function createComponent(): HomeComponent {
    return TestBed.createComponent(HomeComponent).componentInstance;
  }

  beforeEach(async () => {
    landing = { channel: null, videoId: null };
    initializeQueue = jasmine.createSpy('initializeQueue').and.resolveTo();
    // Same rule as the real service: the link's channel wins over the fallback
    resolveLandingChannel = jasmine
      .createSpy('resolveLandingChannel')
      .and.callFake((fallback: Channel) => landing.channel ?? fallback);
    markSharedClipOpened = jasmine.createSpy('markSharedClipOpened');

    await TestBed.configureTestingModule({
      imports: [HomeComponent],
      providers: [
        provideZonelessChangeDetection(),
        {
          provide: QueueService,
          useValue: { initializeQueue, getLastSelectedChannel: () => Channel.DECADE_1990S }
        },
        {
          provide: YoutubeService,
          useValue: { checkBackendReady: () => Promise.resolve({ ready: true }), specialEventData: signal(null) }
        },
        {
          provide: ShareLinkService,
          useValue: { readLanding: () => landing, resolveLandingChannel, markSharedClipOpened }
        }
      ]
    })
      // Only the startup logic is under test - leave the child components out
      .overrideComponent(HomeComponent, { set: { imports: [], schemas: [CUSTOM_ELEMENTS_SCHEMA] } })
      .compileComponents();
  });

  it('starts on the last selected channel on a normal visit', async () => {
    await createComponent().ngOnInit();

    expect(initializeQueue).toHaveBeenCalledOnceWith(Channel.DECADE_1990S, undefined);
  });

  it('starts on the channel from the link', async () => {
    landing = { channel: Channel.ROCK, videoId: null };

    await createComponent().ngOnInit();

    expect(initializeQueue).toHaveBeenCalledOnceWith(Channel.ROCK, undefined);
  });

  it('starts on the channel from the link with the shared clip first', async () => {
    landing = { channel: Channel.ROCK, videoId: 'hTWKbfoikeg' };

    await createComponent().ngOnInit();

    expect(initializeQueue).toHaveBeenCalledOnceWith(Channel.ROCK, 'hTWKbfoikeg');
  });

  it('plays a clip-only link on the last selected channel', async () => {
    landing = { channel: null, videoId: 'hTWKbfoikeg' };

    await createComponent().ngOnInit();

    expect(initializeQueue).toHaveBeenCalledOnceWith(Channel.DECADE_1990S, 'hTWKbfoikeg');
  });

  it('marks the shared clip as opened when the TV is powered on', () => {
    const component = createComponent();

    component.onPowerOn();

    expect(component.isPoweredOn()).toBeTrue();
    expect(markSharedClipOpened).toHaveBeenCalledTimes(1);
  });
});
