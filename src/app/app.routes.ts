import { inject } from '@angular/core';
import { CanMatchFn, RedirectFunction, Router, Routes } from '@angular/router';
import { HomeComponent } from './components/home/home.component';
import { PrivacyPolicyComponent } from './components/privacy-policy/privacy-policy.component';
import { SHARED_VIDEO_PARAM, isValidYouTubeVideoId, toShareableChannel } from './utils/share-link.utils';

/** Matches only real channel links such as /rock or /1990s */
export const channelLinkCanMatch: CanMatchFn = (_route, segments) =>
  toShareableChannel(segments[0]?.path) !== null;

/** Sends unknown paths home, keeping a shared clip (?v=<videoId>) if the link has one */
export const redirectHomeKeepingSharedClip: RedirectFunction = ({ queryParams }) => {
  const videoId = queryParams[SHARED_VIDEO_PARAM];
  return inject(Router).createUrlTree(['/'], {
    queryParams: isValidYouTubeVideoId(videoId) ? { [SHARED_VIDEO_PARAM]: videoId } : {}
  });
};

export const routes: Routes = [
  {
    path: '',
    component: HomeComponent,
    title: 'NMTV - Noa\'s Music Television'
  },
  {
    path: 'privacy-policy',
    component: PrivacyPolicyComponent,
    title: 'Privacy Policy - NMTV'
  },
  {
    // Channel links: /rock, /1990s, ... (optionally with ?v=<videoId> for a shared clip)
    path: ':channel',
    component: HomeComponent,
    title: 'NMTV - Noa\'s Music Television',
    canMatch: [channelLinkCanMatch]
  },
  {
    path: '**',
    redirectTo: redirectHomeKeepingSharedClip
  }
];
