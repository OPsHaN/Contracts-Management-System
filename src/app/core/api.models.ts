export type UserRole = 'SuperAdmin' | 'Pharmacy' | 'ClaimsReviewer';

export interface ApiErrorResponse {
  errors: string[];
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  userId: string;
  role: UserRole;
  pharmacyName: string | null;
}

export interface CreateUserRequest {
  email: string;
  password: string;
  role: UserRole;
  pharmacyName: string | null;
}

export interface UserDto {
  id: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  pharmacyName: string | null;
  createdAt: string;
}

export interface ReviewerDto {
  id: string;
  email: string;
  role: 'ClaimsReviewer';
  isActive: boolean;
  pharmacyName: string | null;
  createdAt: string;
}

export interface CreateReviewerRequest {
  email: string;
  password: string;
  role: 'ClaimsReviewer';
  isActive: boolean;
  pharmacyName: string | null;
}

export interface UpdateUserStatusRequest {
  isActive: boolean;
}

export interface CompanyRequest {
  name: string;
  Discount: number;
  localDiscountPercentage: number;
  importedDiscountPercentage: number;
  taxPercentage: number;
  administrativeExpensesPercentage: number;
  chequeSettlementPeriodInDays: number;
}

export interface CompanyDto extends CompanyRequest {
  id: string;
  createdAt: string;
}

export interface CompanyRespons extends Omit<CompanyDto, 'Discount'> {
  discount: number;
}

export interface DepartmentDto {
  id: string;
  name: string;
}

export interface CreateDepartmentRequest {
  name: string;
}

export interface PagedResponse<T> {
  items: T[];
  pageNumber: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
}

export type SalesBatchStatusValue = 'Pending' | 'Processing' | 'Completed' | 'Failed';

export interface SalesBatchUploadResponse {
  batchId: string;
  status: SalesBatchStatusValue;
}

export interface SalesBatchStatus {
  id: string;
  status: SalesBatchStatusValue;
  totalRows: number;
  processedRows: number;
  failedRows: number;
  errorLog: string | null;
  createdAt: string;
  completedAt: string | null;
}

export interface ClaimsPivotRow {
  companyName: string;
  amountsByBranch: Record<string, number>;
  total: number;
}

export interface ClaimsPivotTotalsRow {
  amountsByBranch: Record<string, number>;
  grandTotal: number;
}

export interface ClaimsPivotResponse {
  branches: string[];
  rows: ClaimsPivotRow[];
  totalsRow?: ClaimsPivotTotalsRow;
}

export interface CompanyInsightsResponse {
  companyName: string;
  prescriptionsCount: number;
  totalRemainingAmount: number;
  totalLocalItemsAmount: number;
  totalImportedItemsAmount: number;
  discountPercentage: number;
  amountAfterDiscount: number;
}

export interface ClaimDto {
  id: string;
  companyName: string;
  month: number;
  year: number;
  claimAmountAfterDiscount: number;
  correctedAmount: number | null;
  notes: string | null;
  discrepancyType: string | null;
  status: string;
  createdAt: string;
}

export interface GenerateClaimsRequest {
  month: number;
  year: number;
}

export interface ClaimReviewRequest {
  isAccurate: boolean;
  correctedAmount: number;
  discrepancyType: string;
  notes: string;
}

export interface ClaimReviewResponse extends ClaimReviewRequest {
  id: string;
  claimId: string;
  reviewedByUserId: string;
  wasEditedByPharmacy: boolean;
  createdAt: string;
  lastEditedAt: string | null;
}

export interface ChequePrepareResponse {
  claimId: string;
  companyName: string;
  amount: number;
  settlementDays: number;
  departments: string[];
}

export interface ChequeAllocation {
  departmentName: string | null;
  amount: number;
  ChequeNumber: string | null;
  BankName: string | null;
}

export interface CreateChequesRequest {
  startDate: string;
  allocations: ChequeAllocation[];
}

export interface ChequeDto {
  id: string;
  companyName: string;
  chequeNumber: string;
  bankName: string;
  departmentName: string | null;
  amount: number;
  startDate: string;
  endDate: string;
  status: string;
  remainingAmount: number | null;
  createdAt: string;
}

export interface UpdateChequeStatusRequest {
  status: 'Pending' | 'PaidInFull' | 'PartiallyPaid';
  remainingAmount?: number | null;
}
