import { Routes } from '@angular/router';
import { HomeComponent } from './components/home/home.component';
import { PrivacyPolicyComponent } from './components/privacy-policy/privacy-policy.component';

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
  }
];
