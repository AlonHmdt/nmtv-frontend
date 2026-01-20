import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AdminService } from '../services/admin.service';
import { map, catchError } from 'rxjs/operators';
import { of } from 'rxjs';

/**
 * Guard to protect admin routes
 * Checks session validity and redirects to login if not authenticated
 */
export const adminAuthGuard: CanActivateFn = (route, state) => {
    const adminService = inject(AdminService);
    const router = inject(Router);

    return adminService.checkSession().pipe(
        map(isValid => {
            if (isValid) {
                return true;
            }
            // Session expired or invalid - redirect to login with message
            router.navigate(['/admin/login'], {
                queryParams: { expired: 'true' }
            });
            return false;
        }),
        catchError(() => {
            // Network error or server down - redirect to login
            router.navigate(['/admin/login'], {
                queryParams: { error: 'connection' }
            });
            return of(false);
        })
    );
};
