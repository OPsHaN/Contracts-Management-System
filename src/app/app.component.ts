import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Observable, finalize } from 'rxjs';

import {
  ClaimsPivotResponse,
  CompanyDto,
  CompanyRequest,
  CreateUserRequest,
  SalesBatchStatus,
  SalesBatchUploadResponse,
  UserDto,
  UserRole
} from './core/api.models';
import { AuthService } from './core/auth.service';
import { CompaniesService } from './core/companies.service';
import { SalesClaimsService } from './core/sales-claims.service';
import { UsersService } from './core/users.service';

type PharmacyStep = 'companies' | 'upload' | 'processing' | 'claims';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  private readonly authService = inject(AuthService);
  private readonly usersService = inject(UsersService);
  private readonly companiesService = inject(CompaniesService);
  private readonly salesClaimsService = inject(SalesClaimsService);

  readonly session = this.authService.session;
  readonly isSuperAdmin = computed(() => this.session()?.role === 'SuperAdmin');
  readonly isPharmacy = computed(() => this.session()?.role === 'Pharmacy');

  readonly loading = signal(false);
  readonly message = signal('');
  readonly users = signal<UserDto[]>([]);
  readonly companies = signal<CompanyDto[]>([]);
  readonly pageNumber = signal(1);
  readonly totalPages = signal(1);
  readonly editingCompanyId = signal<string | null>(null);
  readonly showCompanyForm = signal(false);
  readonly showUserForm = signal(false);
  readonly selectedSalesFile = signal<File | null>(null);
  readonly uploadResult = signal<SalesBatchUploadResponse | null>(null);
  readonly batchDetails = signal<SalesBatchStatus | null>(null);
  readonly pivotData = signal<ClaimsPivotResponse | null>(null);
  readonly pivotLoading = signal(false);
  readonly batchPolling = signal(false);
  readonly activePharmacyStep = signal<PharmacyStep>('companies');
  readonly pivotGrandTotal = computed(() =>
    this.pivotData()?.rows.reduce((sum, row) => sum + row.total, 0) ?? 0
  );
  readonly pharmacySteps: { key: PharmacyStep; label: string; hint: string }[] = [
    { key: 'companies', label: 'تسجيل الشركات', hint: 'إضافة ومراجعة بيانات التعاقد' },
    { key: 'upload', label: 'رفع ملف المبيعات', hint: 'اختيار ملف Excel والشهر والسنة' },
    { key: 'processing', label: 'متابعة المعالجة', hint: 'مراجعة حالة Batch' },
    { key: 'claims', label: 'عرض المطالبات', hint: 'جدول Pivot حسب الفروع' }
  ];

  loginForm = {
    email: 'admin@pharmacycontracts.com',
    password: 'ChangeThisP@ssw0rd123'
  };

  claimsFilter = {
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear()
  };

  userForm: CreateUserRequest = {
    email: '',
    password: '',
    role: 'Pharmacy',
    pharmacyName: ''
  };

  companyForm: CompanyRequest = this.emptyCompanyForm();

  login(): void {
    this.withLoading(this.authService.login(this.loginForm)).subscribe({
        next: () => {
          this.message.set('تم تسجيل الدخول بنجاح.');
          this.loadRoleData();
        },
        error: (error) => this.showError(error)
      });
  }

  logout(): void {
    this.authService.logout();
    this.users.set([]);
    this.companies.set([]);
    this.clearSalesData();
    this.message.set('تم تسجيل الخروج.');
  }

  loadRoleData(): void {
    if (this.isSuperAdmin()) {
      this.loadUsers();
    }

    if (this.isPharmacy()) {
      this.loadCompanies();
    }
  }

  setPharmacyStep(step: PharmacyStep): void {
    this.activePharmacyStep.set(step);

    if (step === 'claims') {
      this.loadClaimsPivot();
    }
  }

  onSalesFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.selectedSalesFile.set(input.files?.[0] ?? null);
  }

  uploadSalesBatch(): void {
    const file = this.selectedSalesFile();
    const pharmacyId = this.session()?.userId;

    if (!file) {
      this.message.set('اختار ملف Excel الأول.');
      return;
    }

    if (!pharmacyId) {
      this.message.set('لا يمكن تحديد الصيدلية الحالية. سجّل الدخول مرة أخرى.');
      return;
    }

    this.withLoading(this.salesClaimsService.uploadSalesBatch(pharmacyId, file)).subscribe({
      next: (response) => {
        this.uploadResult.set(response);
        this.activePharmacyStep.set('processing');
        this.message.set('تم رفع الملف وبدأت المعالجة.');
        this.pollSalesBatch(response.batchId);
      },
      error: (error) => this.showError(error)
    });
  }

  pollSalesBatch(batchId = this.uploadResult()?.batchId): void {
    if (!batchId) {
      return;
    }

    this.batchPolling.set(true);
    this.salesClaimsService.getSalesBatch(batchId).subscribe({
      next: (batch) => {
        this.batchDetails.set(batch);

        if (batch.status === 'Completed') {
          this.batchPolling.set(false);
          this.activePharmacyStep.set('claims');
          this.message.set('تمت معالجة الملف بنجاح.');
          this.loadClaimsPivot();
          return;
        }

        if (batch.status === 'Failed') {
          this.batchPolling.set(false);
          this.message.set(batch.errorLog || 'فشلت معالجة الملف.');
          return;
        }

        window.setTimeout(() => this.pollSalesBatch(batch.id), 2500);
      },
      error: (error) => {
        this.batchPolling.set(false);
        this.showError(error);
      }
    });
  }

  loadClaimsPivot(): void {
    this.pivotLoading.set(true);
    this.salesClaimsService.getClaimsPivot(this.claimsFilter.month, this.claimsFilter.year)
      .pipe(finalize(() => this.pivotLoading.set(false)))
      .subscribe({
        next: (pivot) => this.pivotData.set(pivot),
        error: (error) => this.showError(error)
      });
  }

  loadUsers(): void {
    this.withLoading(this.usersService.getUsers()).subscribe({
        next: (users) => this.users.set(users),
        error: (error) => this.showError(error)
      });
  }

  createUser(): void {
    const payload: CreateUserRequest = {
      ...this.userForm,
      pharmacyName: this.userForm.role === 'Pharmacy' ? this.userForm.pharmacyName : null
    };

    this.withLoading(this.usersService.createUser(payload)).subscribe({
        next: () => {
          this.message.set('تم إنشاء الحساب.');
          this.userForm = { email: '', password: '', role: 'Pharmacy', pharmacyName: '' };
          this.loadUsers();
        },
        error: (error) => this.showError(error)
      });
  }

  updateUserStatus(user: UserDto): void {
    this.withLoading(this.usersService.updateStatus(user.id, { isActive: !user.isActive })).subscribe({
        next: () => {
          this.message.set(user.isActive ? 'تم إيقاف الحساب.' : 'تم تفعيل الحساب.');
          this.loadUsers();
        },
        error: (error) => this.showError(error)
      });
  }

  loadCompanies(pageNumber = this.pageNumber()): void {
    this.withLoading(this.companiesService.getCompanies(pageNumber, 10)).subscribe({
        next: (page) => {
          this.companies.set(page.items);
          this.pageNumber.set(page.pageNumber);
          this.totalPages.set(page.totalPages);
        },
        error: (error) => this.showError(error)
      });
  }

  saveCompany(): void {
    const editingId = this.editingCompanyId();
    const request = editingId
      ? this.companiesService.updateCompany(editingId, this.companyForm)
      : this.companiesService.createCompany(this.companyForm);

    this.withLoading(request).subscribe({
        next: () => {
          this.message.set(editingId ? 'تم تحديث الشركة.' : 'تم إنشاء الشركة.');
          this.showCompanyForm.set(false);
          this.cancelCompanyEdit();
          this.loadCompanies();
        },
        error: (error) => this.showError(error)
      });
  }

  editCompany(company: CompanyDto): void {
    this.editingCompanyId.set(company.id);
    this.showCompanyForm.set(true);
    this.companyForm = {
      name: company.name,
      localDiscountPercentage: company.localDiscountPercentage,
      importedDiscountPercentage: company.importedDiscountPercentage,
      taxPercentage: company.taxPercentage,
      administrativeExpensesPercentage: company.administrativeExpensesPercentage,
      chequeSettlementPeriodInDays: company.chequeSettlementPeriodInDays
    };
  }

  cancelCompanyEdit(): void {
    this.editingCompanyId.set(null);
    this.companyForm = this.emptyCompanyForm();
    this.showCompanyForm.set(false);
  }

  onRoleChange(role: UserRole): void {
    this.userForm.role = role;
    this.userForm.pharmacyName = role === 'Pharmacy' ? this.userForm.pharmacyName ?? '' : null;
  }

  private withLoading<T>(source$: Observable<T>): Observable<T> {
    this.loading.set(true);
    this.message.set('');
    return source$.pipe(finalize(() => this.loading.set(false)));
  }

  private showError(error: HttpErrorResponse): void {
    const errors = error.error?.errors;
    this.message.set(Array.isArray(errors) ? errors.join(' ') : 'فشل الطلب. تأكد من اتصال الـ API وحاول مرة أخرى.');
  }

  private emptyCompanyForm(): CompanyRequest {
    return {
      name: '',
      localDiscountPercentage: 0,
      importedDiscountPercentage: 0,
      taxPercentage: 14,
      administrativeExpensesPercentage: 0,
      chequeSettlementPeriodInDays: 30
    };
  }

  currentYear(): number {
    return new Date().getFullYear();
  }

  displayRole(role: UserRole): string {
    return role === 'SuperAdmin' ? 'مدير نظام' : 'صيدلية';
  }

  displayBatchStatus(status: string): string {
    const labels: Record<string, string> = {
      Pending: 'قيد الانتظار',
      Processing: 'جاري المعالجة',
      Completed: 'مكتمل',
      Failed: 'فشل'
    };

    return labels[status] ?? status;
  }

  formatMoney(value: number): string {
    return new Intl.NumberFormat('ar-EG', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  }

  private clearSalesData(): void {
    this.selectedSalesFile.set(null);
    this.uploadResult.set(null);
    this.batchDetails.set(null);
    this.pivotData.set(null);
    this.batchPolling.set(false);
  }

  ngOnInit(): void {
    this.loadRoleData();
  }
}
