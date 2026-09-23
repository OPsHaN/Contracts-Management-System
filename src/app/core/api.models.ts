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

export interface CompanyProfileRow {
  saleDate: string;
  importedItemsTotal: number;
  localItemsTotal: number;
  grossTotal: number;
  discountOnTotal: number;
  discountOnItems: number;
  subTotal: number;
  remainingAmount: number;
}

/**
 * A generated claim.
 *
 * - `claimAmount` / `prescriptionsCount` are the originally generated values,
 *   before any contract discount / reviewer correction, and are never
 *   overwritten once a review is saved.
 * - `claimAmountAfterDiscount` is the calculated amount after contract
 *   discounts are applied.
 * - `correctedAmount` / `correctedPrescriptionsCount` are the reviewer's
 *   final figures, set once the claim has been reviewed. Use
 *   `correctedAmount ?? claimAmountAfterDiscount` and
 *   `correctedPrescriptionsCount ?? prescriptionsCount` to get the
 *   "effective" values to act on (e.g. cheque preparation).
 */
export interface ClaimDto {
  id: string;
  companyName: string;
  month: number;
  year: number;
  claimAmount: number;
  claimAmountAfterDiscount: number;
  prescriptionsCount: number;
  correctedAmount: number | null;
  correctedPrescriptionsCount: number | null;
  notes: string | null;
  discrepancyType: string | null;
  status: string;
  createdAt: string;
}

export interface GenerateClaimsRequest {
  month: number;
  year: number;
}

/**
 * When `isAccurate` is `true`, `correctedAmount`, `correctedPrescriptionsCount`
 * and `discrepancyType` must be sent as `null` (the generated values are
 * approved as-is). When `isAccurate` is `false`, all three are required:
 * `correctedPrescriptionsCount` must additionally be a whole number >= 0.
 */
export interface ClaimReviewRequest {
  isAccurate: boolean;
  correctedAmount: number | null;
  correctedPrescriptionsCount: number | null;
  discrepancyType: string | null;
  notes: string | null;
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
  amountBeforeDiscount: number;
  amountAfterDiscount: number;
  discountDifference: number;
  taxPercentage: number;
  administrativeExpensesPercentage: number;
  finalAmount: number;
  settlementDays: number;
  departments: string[];
}

export interface ChequeAllocation {
  departmentName: string | null;
  amount: number;
  chequeNumber: string | null;
  bankName: string | null;
}

export interface CreateChequesRequest {
  startDate: string;
  allocations: ChequeAllocation[];
}

export type PaymentDifferenceType = 'Increase' | 'Decrease' | 'Equal';

export interface ChequeDto {
  id: string;
  companyName: string;
  chequeNumber: string | null;
  bankName: string | null;
  departmentName: string | null;
  amount: number;
  amountBeforeDiscount: number;
  amountAfterDiscount: number;
  discountDifference: number;
  taxPercentage: number;
  administrativeExpensesPercentage: number;
  finalAmount: number;
  paidAmount: number;
  paymentDifference: number;
  paymentDifferenceType: PaymentDifferenceType;
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

export type DifferenceType = 'Increase' | 'Decrease' | 'NoDifference';

export type DifferenceReason =
  | 'ContractualDeduction'
  | 'DeferredToNextMonth'
  | 'AccountingDeficit'
  | 'Other';

export interface ClaimDifferenceItem {
  id: string;
  value: number;
  reason: DifferenceReason;
  reviewId: string;
  pharmacyId: string;
}

export interface ClaimDifferencesResponse {
  claimId: string;
  reviewId: string;
  differenceAmount: number;
  differenceType: DifferenceType;
  differences: ClaimDifferenceItem[];
}

export interface CompanyBalance {
  companyName: string;
  totalClaimed: number;
  totalCollected: number;
  balance: number;
}

export interface TotalBalance {
  totalClaimed: number;
  totalCollected: number;
  balance: number;
}

export interface AgingReport {
  notYetDue: number;
  overdue0To30: number;
  overdue31To60: number;
  overdue60Plus: number;
  totalOutstanding: number;
}

export interface UpcomingDueCheque extends ChequeDto {}
