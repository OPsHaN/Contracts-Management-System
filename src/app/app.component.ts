import { CommonModule } from "@angular/common";
import { HttpErrorResponse } from "@angular/common/http";
import { Component, computed, inject, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { Observable, finalize } from "rxjs";

import {
  ChequeAllocation,
  ChequeDto,
  ChequePrepareResponse,
  ClaimDto,
  ClaimReviewRequest,
  ClaimReviewResponse,
  ClaimsPivotResponse,
  CompanyDto,
  CompanyInsightsResponse,
  CompanyRequest,
  CompanyRespons,
  CreateDepartmentRequest,
  CreateReviewerRequest,
  CreateUserRequest,
  DepartmentDto,
  ReviewerDto,
  SalesBatchStatus,
  SalesBatchUploadResponse,
  UserDto,
  UserRole,
} from "./core/api.models";
import { AuthService } from "./core/auth.service";
import { CompaniesService } from "./core/companies.service";
import { SalesClaimsService } from "./core/sales-claims.service";
import { UsersService } from "./core/users.service";

type PharmacyStep =
  | "companies"
  | "upload"
  | "claims-summary"
  | "claims"
  | "claim-review";

@Component({
  selector: "app-root",
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: "./app.component.html",
  styleUrl: "./app.component.scss",
})
export class AppComponent {
  private readonly authService = inject(AuthService);
  private readonly usersService = inject(UsersService);
  private readonly companiesService = inject(CompaniesService);
  private readonly salesClaimsService = inject(SalesClaimsService);

  readonly session = this.authService.session;
  readonly isSuperAdmin = computed(() => this.session()?.role === "SuperAdmin");
  readonly isPharmacy = computed(() => this.session()?.role === "Pharmacy");
  readonly isClaimsReviewer = computed(
    () => this.session()?.role === "ClaimsReviewer",
  );

  readonly loading = signal(false);
  readonly message = signal("");
  readonly users = signal<UserDto[]>([]);
  readonly reviewers = signal<ReviewerDto[]>([]);
  readonly companies = signal<CompanyDto[]>([]);
  readonly companiesRespons = signal<CompanyRespons[]>([]);
  readonly pageNumber = signal(1);
  readonly totalPages = signal(1);
  readonly editingCompanyId = signal<string | null>(null);
  readonly selectedCompanyForDepartments = signal<CompanyRespons | null>(null);
  readonly departments = signal<DepartmentDto[]>([]);
  readonly showDepartmentsModal = signal(false);
  readonly showCompanyForm = signal(false);
  readonly showUserForm = signal(false);
  readonly showReviewerTable = signal(false);
  readonly showReviewerForm = signal(false);
  readonly selectedSalesFile = signal<File | null>(null);
  readonly uploadResult = signal<SalesBatchUploadResponse | null>(null);
  readonly batchDetails = signal<SalesBatchStatus | null>(null);
  readonly pivotData = signal<ClaimsPivotResponse | null>(null);
  readonly claims = signal<ClaimDto[]>([]);
  readonly companyInsights = signal<CompanyInsightsResponse | null>(null);
  readonly selectedClaim = signal<ClaimDto | null>(null);
  readonly selectedClaimReview = signal<ClaimReviewResponse | null>(null);
  readonly preparedCheque = signal<ChequePrepareResponse | null>(null);
  readonly cheques = signal<ChequeDto[]>([]);
  readonly upcomingCheques = signal<ChequeDto[]>([]);
  readonly showUpcomingChequesModal = signal(false);
  readonly createdChequeClaimIds = signal<string[]>([]);
  readonly showChequeStatusModal = signal(false);
  readonly selectedChequeForStatus = signal<ChequeDto | null>(null);
  readonly pivotLoading = signal(false);
  readonly claimsLoading = signal(false);
  readonly batchPolling = signal(false);
  readonly uploadProgress = signal(0);
  readonly activePharmacyStep = signal<PharmacyStep>("companies");
  readonly appliedCompanyName = signal("");
  readonly showLoginPassword = signal(false);
  readonly showUserPassword = signal(false);
  readonly editingClaimReview = signal(false);
  readonly reviewFormError = signal("");
  readonly displayedCheques = computed(() => {
    const uniqueCheques = new Map<string, ChequeDto>();

    [...this.cheques(), ...this.upcomingCheques()].forEach((cheque) => {
      uniqueCheques.set(cheque.id, cheque);
    });

    return Array.from(uniqueCheques.values());
  });
  readonly pivotGrandTotal = computed(
    () => this.pivotTotalsRow()?.grandTotal ?? 0,
  );
  readonly filteredPivotRows = computed(() => {
    const pivot = this.pivotData();
    const companyName = this.appliedCompanyName().trim();

    if (!pivot) {
      return [];
    }

    if (!companyName) {
      return pivot.rows;
    }

    return pivot.rows.filter((row) => row.companyName.includes(companyName));
  });
  readonly pivotTotalsRow = computed(() => {
    const pivot = this.pivotData();

    if (!pivot) {
      return null;
    }

    if (!this.appliedCompanyName().trim() && pivot.totalsRow) {
      return pivot.totalsRow;
    }

    const rows = this.filteredPivotRows();
    const amountsByBranch = pivot.branches.reduce<Record<string, number>>(
      (totals, branch) => {
        totals[branch] = rows.reduce(
          (sum, row) => sum + (row.amountsByBranch[branch] || 0),
          0,
        );
        return totals;
      },
      {},
    );

    return {
      amountsByBranch,
      grandTotal: rows.reduce((sum, row) => sum + row.total, 0),
    };
  });
  readonly companyOptions = computed(() => {
    const names = this.pivotData()?.rows.map((row) => row.companyName) ?? [];

    return Array.from(new Set(names))
      .filter(Boolean)
      .sort((first, second) => first.localeCompare(second, "ar"));
  });
  readonly pharmacyOptions = computed(() => {
    const names = this.users()
      .map((user) => user.pharmacyName?.trim() ?? "")
      .filter(Boolean);

    return Array.from(new Set(names)).sort((first, second) =>
      first.localeCompare(second, "ar"),
    );
  });
  readonly batchProgressPercent = computed(() => {
    const batch = this.batchDetails();

    if (!batch?.totalRows) {
      return this.batchPolling() ? 35 : this.uploadProgress();
    }

    return Math.round((batch.processedRows / batch.totalRows) * 100);
  });
  readonly pharmacySteps: { key: PharmacyStep; label: string; hint: string }[] =
    [
      {
        key: "companies",
        label: "تسجيل الشركات",
        hint: "إضافة ومراجعة بيانات التعاقد",
      },
      { key: "upload", label: "رفع ملف المبيعات", hint: "اختيار ملف Excel" },
      {
        key: "claims-summary",
        label: "ملخص الشركات",
        hint: "جدول الشركات والصيدليات",
      },
      {
        key: "claims",
        label: "مطالبات الشركات",
        hint: "المبالغ بعد الخصم والمراجعة",
      },
      {
        key: "claim-review",
        label: "مراجعة المطالبة",
        hint: "المطالبة والشيكات",
      },
    ];

  loginForm = {
    email: "",
    password: "",
  };

  claimsFilter = {
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
    companyName: "",
  };

  reviewForm: ClaimReviewRequest = this.emptyReviewForm();

  chequeForm = {
    startDate: new Date().toISOString().slice(0, 10),
    ChequeNumber: "",
    BankName: "",
    allocations: [] as ChequeAllocation[],
  };

  chequeStatusForm = {
    chequeId: "",
    status: "PaidInFull" as "Pending" | "PaidInFull" | "PartiallyPaid",
    remainingAmount: null as number | null,
    chequeNumber: "",
    bankName: "",
  };

  userForm: CreateUserRequest = {
    email: "",
    password: "",
    role: "Pharmacy",
    pharmacyName: "",
  };

  reviewerForm: CreateReviewerRequest = {
    email: "",
    password: "",
    role: "ClaimsReviewer",
    isActive: true,
    pharmacyName: null,
  };

  companyForm: CompanyRequest = this.emptyCompanyForm();

  departmentForm: CreateDepartmentRequest = {
    name: "",
  };

  login(): void {
    this.withLoading(this.authService.login(this.loginForm)).subscribe({
      next: () => {
        this.message.set("تم تسجيل الدخول بنجاح.");
        this.loadRoleData();
      },
      error: (error) => this.showError(error),
    });
  }

  logout(): void {
    this.authService.logout();
    this.users.set([]);
    this.companies.set([]);
    this.clearSalesData();
    this.message.set("تم تسجيل الخروج.");
  }

  closeNotice(): void {
    this.message.set("");
  }

  closeClaimDetails(): void {
    this.selectedClaim.set(null);
    this.editingClaimReview.set(false);
    this.reviewFormError.set("");
  }

  closeCompanyForm(): void {
    this.showCompanyForm.set(false);
  }

  openDepartmentsModal(company: CompanyRespons): void {
    this.selectedCompanyForDepartments.set(company);
    this.departmentForm = { name: "" };
    this.showDepartmentsModal.set(true);
    this.loadDepartments(company.id);
  }

  closeDepartmentsModal(): void {
    this.showDepartmentsModal.set(false);
    this.selectedCompanyForDepartments.set(null);
    this.departments.set([]);
    this.departmentForm = { name: "" };
  }

  loadDepartments(companyId = this.selectedCompanyForDepartments()?.id): void {
    if (!companyId) {
      return;
    }

    this.withLoading(this.companiesService.getDepartments(companyId)).subscribe(
      {
        next: (departments) => this.departments.set(departments),
        error: (error) => this.showError(error),
      },
    );
  }

  createDepartment(): void {
    const companyId = this.selectedCompanyForDepartments()?.id;
    const name = this.departmentForm.name.trim();

    if (!companyId || !name) {
      this.message.set("اكتب اسم الإدارة أولًا.");
      return;
    }

    this.withLoading(
      this.companiesService.createDepartment(companyId, { name }),
    ).subscribe({
      next: (department) => {
        this.departments.update((departments) => [...departments, department]);
        this.departmentForm = { name: "" };
        this.message.set("تمت إضافة الإدارة.");
      },
      error: (error) => this.showError(error),
    });
  }

  deleteDepartment(department: DepartmentDto): void {
    const companyId = this.selectedCompanyForDepartments()?.id;

    if (!companyId) {
      return;
    }

    this.withLoading(
      this.companiesService.deleteDepartment(companyId, department.id),
    ).subscribe({
      next: () => {
        this.departments.update((departments) =>
          departments.filter(
            (currentDepartment) => currentDepartment.id !== department.id,
          ),
        );
        this.message.set("تم حذف الإدارة.");
      },
      error: (error) => this.showError(error),
    });
  }

  closeReviewerForm(): void {
    this.showReviewerForm.set(false);
  }

  togglePasswordVisibility(passwordType: "login" | "user"): void {
    if (passwordType === "login") {
      this.showLoginPassword.update((visible) => !visible);
      return;
    }

    this.showUserPassword.update((visible) => !visible);
  }

  loadRoleData(): void {
    if (this.isSuperAdmin()) {
      this.loadUsers();
    }

    if (this.isPharmacy()) {
      this.loadCompanies();
    }

    if (this.isClaimsReviewer()) {
      this.claimsFilter.companyName = "";
      this.appliedCompanyName.set("");
      this.activePharmacyStep.set("claims");
      this.loadClaims();
    }
  }

  canShowStep(step: PharmacyStep): boolean {
    return this.isPharmacy() || step === "claims";
  }

  setPharmacyStep(step: PharmacyStep): void {
    this.activePharmacyStep.set(step);
  }

  onSalesFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.selectedSalesFile.set(input.files?.[0] ?? null);
    this.uploadResult.set(null);
    this.batchDetails.set(null);
    this.pivotData.set(null);
    this.claims.set([]);
    this.uploadProgress.set(input.files?.[0] ? 15 : 0);
  }

  uploadSalesBatch(): void {
    const file = this.selectedSalesFile();
    const pharmacyId = this.session()?.userId;

    if (!file) {
      this.message.set("اختار ملف Excel الأول.");
      return;
    }

    if (!pharmacyId) {
      this.message.set("لا يمكن تحديد الصيدلية الحالية. سجّل الدخول مرة أخرى.");
      return;
    }

    this.withLoading(
      this.salesClaimsService.uploadSalesBatch(pharmacyId, file),
    ).subscribe({
      next: (response) => {
        this.uploadResult.set(response);
        this.uploadProgress.set(100);
        this.message.set("جاري رفع الملف والتأكد من بياناته.");
        this.pollSalesBatch(response.batchId);
      },
      error: (error) => this.showError(error),
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

        if (batch.status === "Completed") {
          this.batchPolling.set(false);
          this.message.set("تم رفع الملف بنجاح والتأكد من بياناته.");
          return;
        }

        if (batch.status === "Failed") {
          this.batchPolling.set(false);
          this.message.set(batch.errorLog || "فشلت معالجة الملف.");
          return;
        }

        window.setTimeout(() => this.pollSalesBatch(batch.id), 2500);
      },
      error: (error) => {
        this.batchPolling.set(false);
        this.showError(error);
      },
    });
  }

  applyClaimsFilters(): void {
    this.claimsFilter.companyName = "";
    this.appliedCompanyName.set("");
    this.companyInsights.set(null);
    this.preparedCheque.set(null);
    this.selectedClaim.set(null);
    this.selectedClaimReview.set(null);
    this.loadClaimsPivot();
    this.loadClaims();
    this.loadCheques();
  }

  applyCompanyFilter(): void {
    this.appliedCompanyName.set(this.claimsFilter.companyName.trim());
    this.loadClaims();

    if (this.claimsFilter.companyName.trim()) {
      this.loadCompanyInsights();
      this.prepareCheque();
      this.loadCheques();
      return;
    }

    this.companyInsights.set(null);
    this.preparedCheque.set(null);
    this.loadCheques();
  }

  downloadClaimsSummaryExcel(): void {
    const pivot = this.pivotData();

    if (!pivot) {
      this.message.set("حمّل ملخص الشركات أولًا قبل تنزيل ملف Excel.");
      return;
    }

    const headers = ["اسم الشركة", ...pivot.branches, "الإجمالي"];
    const rows = this.filteredPivotRows().map((row) => [
      row.companyName,
      ...pivot.branches.map((branch) => row.amountsByBranch[branch] || 0),
      row.total,
    ]);
    const totals = this.pivotTotalsRow();
    const tableRows = totals
      ? [
          ...rows,
          [
            "الإجمالي",
            ...pivot.branches.map(
              (branch) => totals.amountsByBranch[branch] || 0,
            ),
            totals.grandTotal,
          ],
        ]
      : rows;
    const escapeCell = (value: string | number) =>
      String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
    const table = `
      <table border="1">
        <thead><tr>${headers.map((header) => `<th>${escapeCell(header)}</th>`).join("")}</tr></thead>
        <tbody>${tableRows.map((row) => `<tr>${row.map((cell) => `<td>${escapeCell(cell)}</td>`).join("")}</tr>`).join("")}</tbody>
      </table>`;
    const excelDocument = `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body dir="rtl">${table}</body></html>`;
    const blob = new Blob([excelDocument], {
      type: "application/vnd.ms-excel;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `ملخص-الشركات-${this.claimsFilter.month}-${this.claimsFilter.year}.xls`;
    link.click();
    URL.revokeObjectURL(url);
  }

  generateClaims(): void {
    this.withLoading(
      this.salesClaimsService.generateClaims({
        month: this.claimsFilter.month,
        year: this.claimsFilter.year,
      }),
    ).subscribe({
      next: (claims) => {
        this.claims.set(claims);
        this.message.set("تم توليد المطالبات بنجاح.");
        this.loadClaimsPivot();
      },
      error: (error) => this.showError(error),
    });
  }

  loadClaimsPivot(): void {
    this.pivotLoading.set(true);
    this.salesClaimsService
      .getClaimsPivot(this.claimsFilter.month, this.claimsFilter.year)
      .pipe(finalize(() => this.pivotLoading.set(false)))
      .subscribe({
        next: (pivot) => this.pivotData.set(pivot),
        error: (error) => this.showError(error),
      });
  }

  loadClaims(): void {
    if (this.isClaimsReviewer()) {
      this.claimsFilter.companyName = "";
    }

    this.claimsLoading.set(true);
    this.salesClaimsService
      .getClaims(this.claimsFilter.month, this.claimsFilter.year)
      .pipe(finalize(() => this.claimsLoading.set(false)))
      .subscribe({
        next: (claims) =>
          this.claims.set(
            this.isClaimsReviewer()
              ? claims
              : this.filterClaimsByCompany(claims),
          ),
        error: (error) => this.showError(error),
      });
  }

  loadCompanyInsights(): void {
    const companyName = this.claimsFilter.companyName.trim();

    if (!companyName) {
      this.companyInsights.set(null);
      return;
    }

    this.salesClaimsService
      .getCompanyInsights(
        companyName,
        this.claimsFilter.month,
        this.claimsFilter.year,
      )
      .subscribe({
        next: (insights) => this.companyInsights.set(insights),
        error: (error) => this.showError(error),
      });
  }

  selectClaim(claim: ClaimDto): void {
    const wasAlreadyPending = claim.status === "Pending";
    const pendingClaim: ClaimDto = {
      ...claim,
      status: "Pending",
    };

    this.claims.update((claims) =>
      claims.map((currentClaim) =>
        currentClaim.id === claim.id ? pendingClaim : currentClaim,
      ),
    );
    this.selectedClaim.set(pendingClaim);
    this.claimsFilter.companyName = pendingClaim.companyName;
    this.reviewFormError.set("");
    this.reviewForm = {
      isAccurate: false,
      correctedAmount:
        pendingClaim.correctedAmount ?? pendingClaim.claimAmountAfterDiscount,
      correctedPrescriptionsCount:
        pendingClaim.correctedPrescriptionsCount ??
        pendingClaim.prescriptionsCount,
      discrepancyType: null,
      notes: "",
    };

    if (this.isPharmacy()) {
      this.message.set(
        wasAlreadyPending
          ? "تم إرسال المطالبة بالفعل للمراجعة، وهي في انتظار رد الفريق المختص."
          : "تم إرسال المطالبة للمراجعة للفريق المختص، وسيتم تجهيز الشيك بعد الرد.",
      );
      return;
    }

    this.message.set(
      "المطالبة في انتظار رد المراجع، وسيتم تجهيز الشيك بعد المراجعة.",
    );
    this.loadClaimReview(pendingClaim.id);
  }

  /**
   * Called from the "isAccurate" checkbox so the corrected fields are reset
   * as soon as the reviewer marks a claim accurate (they will be sent as
   * null regardless, but clearing them keeps the form consistent if the
   * reviewer toggles the checkbox back and forth).
   */
  onReviewAccuracyChange(isAccurate: boolean): void {
    this.reviewForm.isAccurate = isAccurate;
    this.reviewFormError.set("");

    if (isAccurate) {
      this.reviewForm.correctedAmount = null;
      this.reviewForm.correctedPrescriptionsCount = null;
      this.reviewForm.discrepancyType = null;
    }
  }

  saveClaimReview(): void {
    const claim = this.selectedClaim();

    if (!claim) {
      this.message.set("اختار مطالبة الأول.");
      return;
    }

    const validationError = this.validateReviewForm();

    if (validationError) {
      this.reviewFormError.set(validationError);
      return;
    }

    this.reviewFormError.set("");

    const reviewPayload = this.buildReviewPayload();

    const request$ = this.editingClaimReview()
      ? this.salesClaimsService.updateClaimReview(claim.id, reviewPayload)
      : this.salesClaimsService.saveClaimReview(claim.id, reviewPayload);

    this.withLoading(request$).subscribe({
      next: (review) => {
        this.selectedClaimReview.set(review);
        const reviewedClaim: ClaimDto = {
          ...(this.selectedClaim() ?? claim),
          status: "Reviewed",
          correctedAmount: review.correctedAmount,
          correctedPrescriptionsCount: review.correctedPrescriptionsCount,
          discrepancyType: review.discrepancyType,
          notes: review.notes,
        };
        this.selectedClaim.set(reviewedClaim);
        this.claims.update((claims) =>
          claims.map((currentClaim) =>
            currentClaim.id === reviewedClaim.id ? reviewedClaim : currentClaim,
          ),
        );
        this.message.set("تم حفظ مراجعة المطالبة.");
        this.editingClaimReview.set(false);
        if (this.isPharmacy()) {
          this.loadClaims();
        }
      },
      error: (error) => this.showError(error),
    });
  }

  editClaimReview(claim: ClaimDto): void {
    this.selectedClaim.set(claim);
    this.editingClaimReview.set(true);
    this.reviewFormError.set("");
    this.reviewForm = {
      isAccurate: false,
      correctedAmount: claim.correctedAmount ?? claim.claimAmountAfterDiscount,
      correctedPrescriptionsCount:
        claim.correctedPrescriptionsCount ?? claim.prescriptionsCount,
      discrepancyType: null,
      notes: "",
    };
    this.loadClaimReview(claim.id);
  }

  loadClaimReview(claimId = this.selectedClaim()?.id): void {
    if (!claimId) {
      return;
    }

    this.salesClaimsService.getClaimReview(claimId).subscribe({
      next: (review) => {
        this.selectedClaimReview.set(review);
        this.reviewForm = {
          isAccurate: review.isAccurate,
          correctedAmount: review.correctedAmount,
          correctedPrescriptionsCount: review.correctedPrescriptionsCount,
          discrepancyType: review.discrepancyType,
          notes: review.notes,
        };
      },
      error: () => this.selectedClaimReview.set(null),
    });
  }

  /**
   * The amount to act on (e.g. for cheque preparation): the reviewer's
   * corrected amount when available, otherwise the generated
   * claimAmountAfterDiscount. The original values are never overwritten.
   */
  effectiveClaimAmount(claim: ClaimDto): number {
    return claim.correctedAmount ?? claim.claimAmountAfterDiscount;
  }

  /**
   * The prescriptions count to act on: the reviewer's corrected count when
   * available, otherwise the originally generated prescriptionsCount.
   */
  effectivePrescriptionsCount(claim: ClaimDto): number {
    return claim.correctedPrescriptionsCount ?? claim.prescriptionsCount;
  }

  prepareCheque(claim?: ClaimDto): void {
    const companyName =
      claim?.companyName.trim() || this.claimsFilter.companyName.trim();

    if (claim) {
      this.claimsFilter.companyName = claim.companyName;
      this.claimsFilter.month = claim.month;
      this.claimsFilter.year = claim.year;
    }

    if (!companyName) {
      this.message.set("اكتب اسم الشركة لتجهيز الشيك.");
      return;
    }

    this.withLoading(
      this.salesClaimsService.prepareCheque(
        companyName,
        this.claimsFilter.month,
        this.claimsFilter.year,
      ),
    ).subscribe({
      next: (prepared) => {
        this.preparedCheque.set(prepared);
        this.chequeForm.allocations = this.createDefaultAllocations(prepared);
        this.activePharmacyStep.set("claim-review");
        this.message.set("تم تجهيز بيانات الشيك بنجاح.");
      },
      error: (error) => this.showError(error),
    });
  }

  createCheques(): void {
    const prepared = this.preparedCheque();

    if (!prepared) {
      this.message.set("جهّز الشيك الأول.");
      return;
    }

    const payload = {
      startDate: this.chequeForm.startDate,
      allocations: this.chequeForm.allocations.map((allocation) => ({
        ...allocation,
        departmentName: allocation.departmentName?.trim() || null,
        ChequeNumber: this.chequeForm.ChequeNumber.trim() || null,
        BankName: this.chequeForm.BankName.trim() || null,
      })),
    };

    this.withLoading(
      this.salesClaimsService.createCheques(prepared.claimId, payload),
    ).subscribe({
      next: (cheques) => {
        const mergeCheques = (existing: ChequeDto[]) => {
          const uniqueCheques = new Map<string, ChequeDto>();

          [...existing, ...cheques].forEach((cheque) => {
            uniqueCheques.set(cheque.id, cheque);
          });

          return Array.from(uniqueCheques.values());
        };

        this.cheques.update(mergeCheques);
        this.upcomingCheques.update(mergeCheques);
        this.createdChequeClaimIds.update((claimIds) =>
          claimIds.includes(prepared.claimId)
            ? claimIds
            : [...claimIds, prepared.claimId],
        );
        this.preparedCheque.set(null);
        this.message.set("تم إنشاء الشيكات.");
      },
      error: (error) => this.showError(error),
    });
  }

  hasChequeForClaim(claim: ClaimDto): boolean {
    return (
      this.createdChequeClaimIds().includes(claim.id) ||
      this.displayedCheques().some(
        (cheque) => cheque.companyName === claim.companyName,
      )
    );
  }

  loadCheques(): void {
    this.salesClaimsService
      .getCheques(
        this.claimsFilter.companyName.trim() || undefined,
        this.claimsFilter.month,
        this.claimsFilter.year,
      )
      .subscribe({
        next: (cheques) => this.cheques.set(cheques),
        error: (error) => this.showError(error),
      });
  }

  loadUpcomingCheques(): void {
    this.salesClaimsService.getUpcomingDueCheques().subscribe({
      next: (cheques) => {
        this.upcomingCheques.set(cheques);
        this.showUpcomingChequesModal.set(true);
      },
      error: (error) => this.showError(error),
    });
  }

  closeUpcomingChequesModal(): void {
    this.showUpcomingChequesModal.set(false);
  }

  openChequeStatusModal(cheque: ChequeDto): void {
    this.selectedChequeForStatus.set(cheque);
    this.chequeStatusForm = {
      chequeId: cheque.id,
      status: cheque.status as "Pending" | "PaidInFull" | "PartiallyPaid",
      remainingAmount: cheque.remainingAmount,
      chequeNumber: cheque.chequeNumber,
      bankName: cheque.bankName,
    };

    this.showChequeStatusModal.set(true);
  }

  closeChequeStatusModal(): void {
    this.showChequeStatusModal.set(false);
    this.selectedChequeForStatus.set(null);
  }

  updateChequeStatus(): void {
    if (!this.chequeStatusForm.chequeId) {
      this.message.set("اختار شيك لتحديث حالته.");
      return;
    }

    const payload = {
      chequeNumber: this.chequeStatusForm.chequeNumber,
      bankName: this.chequeStatusForm.bankName,
      status: this.chequeStatusForm.status,
      remainingAmount:
        this.chequeStatusForm.status === "PartiallyPaid"
          ? this.chequeStatusForm.remainingAmount
          : null,
    };

    this.withLoading(
      this.salesClaimsService.updateChequeStatus(
        this.chequeStatusForm.chequeId,
        payload,
      ),
    ).subscribe({
      next: () => {
        const updateCheque = (cheques: ChequeDto[]) =>
          cheques.map((cheque) =>
            cheque.id === this.chequeStatusForm.chequeId
              ? {
                  ...cheque,
                  chequeNumber: payload.chequeNumber,
                  bankName: payload.bankName,
                  status: payload.status,
                  remainingAmount: payload.remainingAmount,
                }
              : cheque,
          );

        this.cheques.update(updateCheque);
        this.upcomingCheques.update(updateCheque);

        this.message.set("تم تحديث بيانات الشيك بنجاح.");
        this.closeChequeStatusModal();
      },

      error: (error) => this.showError(error),
    });
  }

  loadUsers(): void {
    this.withLoading(this.usersService.getUsers()).subscribe({
      next: (users) => this.users.set(users),
      error: (error) => this.showError(error),
    });
  }

  loadReviewers(): void {
    this.withLoading(this.usersService.getReviewers()).subscribe({
      next: (reviewers) => this.reviewers.set(reviewers),
      error: (error) => this.showError(error),
    });
  }

  toggleReviewerTable(): void {
    const shouldShow = !this.showReviewerForm();
    this.showReviewerTable.set(true);
    this.showReviewerForm.set(shouldShow);

    if (shouldShow) {
      this.reviewerForm.pharmacyName = this.isPharmacy()
        ? (this.session()?.pharmacyName ?? null)
        : null;
    }
  }

  createReviewer(): void {
    this.withLoading(
      this.usersService.createReviewer(this.reviewerForm),
    ).subscribe({
      next: (reviewer) => {
        this.reviewers.update((reviewers) => [reviewer, ...reviewers]);
        this.reviewerForm = {
          email: "",
          password: "",
          role: "ClaimsReviewer",
          isActive: true,
          pharmacyName: null,
        };
        this.showReviewerForm.set(false);
        this.message.set("تم إنشاء المراجع بنجاح.");
      },
      error: (error) => this.showError(error),
    });
  }

  createUser(): void {
    const payload: CreateUserRequest = {
      ...this.userForm,
      pharmacyName:
        this.userForm.role === "Pharmacy" ? this.userForm.pharmacyName : null,
    };

    this.withLoading(this.usersService.createUser(payload)).subscribe({
      next: () => {
        this.message.set("تم إنشاء الحساب.");
        this.userForm = {
          email: "",
          password: "",
          role: "Pharmacy",
          pharmacyName: "",
        };
        this.loadUsers();
      },
      error: (error) => this.showError(error),
    });
  }

  updateUserStatus(user: UserDto): void {
    this.withLoading(
      this.usersService.updateStatus(user.id, { isActive: !user.isActive }),
    ).subscribe({
      next: () => {
        this.message.set(
          user.isActive ? "تم إيقاف الحساب." : "تم تفعيل الحساب.",
        );
        this.loadUsers();
      },
      error: (error) => this.showError(error),
    });
  }

  loadCompanies(pageNumber = this.pageNumber()): void {
    this.withLoading(
      this.companiesService.getCompanies(pageNumber, 10),
    ).subscribe({
      next: (page) => {
        const companyResponses = page.items as unknown as CompanyRespons[];
        this.companiesRespons.set(companyResponses);
        this.companies.set(
          companyResponses.map((company) => ({
            ...company,
            Discount: company.discount,
          })),
        );
        this.pageNumber.set(page.pageNumber);
        this.totalPages.set(page.totalPages);
      },
      error: (error) => this.showError(error),
    });
  }

  saveCompany(): void {
    const editingId = this.editingCompanyId();
    const request = editingId
      ? this.companiesService.updateCompany(editingId, this.companyForm)
      : this.companiesService.createCompany(this.companyForm);

    this.withLoading(request).subscribe({
      next: () => {
        this.message.set(editingId ? "تم تحديث الشركة." : "تم إنشاء الشركة.");
        this.showCompanyForm.set(false);
        this.cancelCompanyEdit();
        this.loadCompanies();
      },
      error: (error) => this.showError(error),
    });
  }

  editCompany(company: CompanyRespons): void {
    this.editingCompanyId.set(company.id);
    this.showCompanyForm.set(true);
    this.companyForm = {
      name: company.name,
      Discount: company.discount,
      localDiscountPercentage: company.localDiscountPercentage,
      importedDiscountPercentage: company.importedDiscountPercentage,
      taxPercentage: company.taxPercentage,
      administrativeExpensesPercentage:
        company.administrativeExpensesPercentage,
      chequeSettlementPeriodInDays: company.chequeSettlementPeriodInDays,
    };
  }

  cancelCompanyEdit(): void {
    this.editingCompanyId.set(null);
    this.companyForm = this.emptyCompanyForm();
    this.showCompanyForm.set(false);
  }

  onRoleChange(role: UserRole): void {
    this.userForm.role = role;
    this.userForm.pharmacyName =
      role === "Pharmacy" ? (this.userForm.pharmacyName ?? "") : null;
  }

  private withLoading<T>(source$: Observable<T>): Observable<T> {
    this.loading.set(true);
    this.message.set("");
    return source$.pipe(finalize(() => this.loading.set(false)));
  }

  private showError(error: HttpErrorResponse): void {
    const errors = error.error?.errors;
    this.message.set(
      Array.isArray(errors)
        ? errors.join(" ")
        : "فشل الطلب. تأكد من اتصال الـ API وحاول مرة أخرى.",
    );
  }

  private emptyCompanyForm(): CompanyRequest {
    return {
      name: "",
      Discount: 0,
      localDiscountPercentage: 0,
      importedDiscountPercentage: 0,
      taxPercentage: 14,
      administrativeExpensesPercentage: 0,
      chequeSettlementPeriodInDays: 30,
    };
  }

  private emptyReviewForm(): ClaimReviewRequest {
    return {
      isAccurate: false,
      correctedAmount: null,
      correctedPrescriptionsCount: null,
      discrepancyType: null,
      notes: "",
    };
  }

  /**
   * Builds the payload actually sent to the API: when the claim is marked
   * accurate, both corrected values and the discrepancy type are forced to
   * null regardless of whatever is left in the form fields.
   */
  private buildReviewPayload(): ClaimReviewRequest {
    const isAccurate = this.reviewForm.isAccurate === true;

    return {
      isAccurate,
      correctedAmount: isAccurate ? null : this.reviewForm.correctedAmount,
      correctedPrescriptionsCount: isAccurate
        ? null
        : this.reviewForm.correctedPrescriptionsCount,
      discrepancyType: isAccurate ? null : this.reviewForm.discrepancyType,
      notes: this.reviewForm.notes,
    };
  }

  /**
   * Client-side validation mirroring the API rules, so obviously invalid
   * submissions are caught before the request is sent. Server-side
   * validation errors (returned in error.error.errors) are still surfaced
   * via showError().
   */
  private validateReviewForm(): string | null {
    if (this.reviewForm.isAccurate === true) {
      return null;
    }

    if (
      this.reviewForm.correctedAmount === null ||
      this.reviewForm.correctedAmount === undefined
    ) {
      return "اكتب المبلغ المصحح.";
    }

    const correctedCount = this.reviewForm.correctedPrescriptionsCount;

    if (correctedCount === null || correctedCount === undefined) {
      return "اكتب عدد الروشتات المصحح.";
    }

    if (!Number.isInteger(correctedCount) || correctedCount < 0) {
      return "عدد الروشتات المصحح يجب أن يكون رقمًا صحيحًا أكبر من أو يساوي صفر.";
    }

    if (!this.reviewForm.discrepancyType) {
      return "اختار نوع الاختلاف.";
    }

    return null;
  }

  currentYear(): number {
    return new Date().getFullYear();
  }

  displayRole(role: UserRole): string {
    if (role === "SuperAdmin") {
      return "مدير نظام";
    }

    if (role === "ClaimsReviewer") {
      return "مراجع مطالبات";
    }

    return "صيدلية";
  }

  displayBatchStatus(status: string): string {
    const labels: Record<string, string> = {
      Pending: "قيد الانتظار",
      Processing: "جاري المعالجة",
      Completed: "مكتمل",
      Failed: "فشل",
    };

    return labels[status] ?? status;
  }

  displayChequeStatus(status: string): string {
    const labels: Record<string, string> = {
      Pending: "قيد الانتظار",
      PaidInFull: "مدفوع بالكامل",
      PartiallyPaid: "مدفوع جزئيًا",
    };

    return labels[status] ?? status;
  }

  displayDiscrepancyType(discrepancyType: string | null): string {
    const labels: Record<string, string> = {
      Other: "أخرى",
      ContractualDeduction: "خصم تعاقدات",
      DeferredToNextMonth: "مؤجل لشهر قادم",
      AccountingDeficit: "عجز محاسبي",
      None: "لايوجد",
    };

    if (!discrepancyType) {
      return "-";
    }

    return labels[discrepancyType] ?? discrepancyType;
  }

  formatMoney(value: number): string {
    const formattedValue = new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);

    return `${formattedValue} ج.م`;
  }

  private clearSalesData(): void {
    this.selectedSalesFile.set(null);
    this.uploadResult.set(null);
    this.batchDetails.set(null);
    this.pivotData.set(null);
    this.claims.set([]);
    this.companyInsights.set(null);
    this.selectedClaim.set(null);
    this.selectedClaimReview.set(null);
    this.preparedCheque.set(null);
    this.cheques.set([]);
    this.upcomingCheques.set([]);
    this.appliedCompanyName.set("");
    this.batchPolling.set(false);
    this.uploadProgress.set(0);
    this.reviewFormError.set("");
  }

  private filterClaimsByCompany(claims: ClaimDto[]): ClaimDto[] {
    const companyName = this.claimsFilter.companyName.trim();

    if (!companyName) {
      return claims;
    }

    return claims.filter((claim) => claim.companyName.includes(companyName));
  }

  private createDefaultAllocations(
    prepared: ChequePrepareResponse,
  ): ChequeAllocation[] {
    if (!prepared.departments.length) {
      return [
        {
          departmentName: "",
          amount: prepared.amount,
          ChequeNumber: null,
          BankName: null,
        },
      ];
    }

    const baseAmount =
      Math.floor((prepared.amount / prepared.departments.length) * 100) / 100;
    return prepared.departments.map((departmentName, index) => ({
      departmentName,
      amount:
        index === prepared.departments.length - 1
          ? Number((prepared.amount - baseAmount * index).toFixed(2))
          : baseAmount,
      ChequeNumber: null,
      BankName: null,
    }));
  }

  ngOnInit(): void {
    this.loadRoleData();
  }
}