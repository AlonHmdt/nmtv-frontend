import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { AdminService } from '../../services/admin.service';

@Component({
    selector: 'app-admin-login',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './admin-login.component.html',
    styleUrls: ['./admin-login.component.scss']
})
export class AdminLoginComponent implements OnInit {
    private adminService = inject(AdminService);
    private router = inject(Router);
    private route = inject(ActivatedRoute);

    password = signal('');
    isLoading = signal(false);
    errorMessage = signal('');
    infoMessage = signal('');

    ngOnInit() {
        // Check for redirect messages
        const expired = this.route.snapshot.queryParamMap.get('expired');
        const error = this.route.snapshot.queryParamMap.get('error');

        if (expired === 'true') {
            this.infoMessage.set('Your session has expired. Please login again.');
        } else if (error === 'connection') {
            this.errorMessage.set('Connection error. Please try again.');
        }
    }

    onSubmit() {
        const pwd = this.password();
        if (!pwd.trim()) {
            this.errorMessage.set('Password is required');
            return;
        }

        this.isLoading.set(true);
        this.errorMessage.set('');

        this.adminService.login(pwd).subscribe({
            next: (response) => {
                this.isLoading.set(false);
                if (response.success) {
                    this.router.navigate(['/admin']);
                } else {
                    this.errorMessage.set('Login failed');
                }
            },
            error: (err) => {
                this.isLoading.set(false);
                this.errorMessage.set(err.error?.error || 'Invalid password');
            }
        });
    }
}
