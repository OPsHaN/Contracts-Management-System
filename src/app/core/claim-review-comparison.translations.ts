export type ClaimReviewComparisonLanguage = "ar" | "en";

export type ClaimReviewComparisonTranslationKey =
  | "amountComparison"
  | "prescriptionsComparison"
  | "originalAmount"
  | "correctedAmount"
  | "absoluteDifference"
  | "direction"
  | "originalPrescriptionsCount"
  | "correctedPrescriptionsCount"
  | "prescriptionsDeltaColumn"
  | "amountDeltaColumn"
  | "Increase"
  | "Decrease"
  | "NoDifference";

const translations: Record<
  ClaimReviewComparisonLanguage,
  Record<ClaimReviewComparisonTranslationKey, string>
> = {
  ar: {
    amountComparison: "مقارنة قيمة المطالبة",
    prescriptionsComparison: "مقارنة عدد الروشتات",
    originalAmount: "قيمة فارما فلاي قبل الخصم",
    correctedAmount: "قيمة المطالبة الفعلية",
    absoluteDifference: "الفرق المطلق",
    direction: "اتجاه الفرق",
    originalPrescriptionsCount: "عدد روشتات فارما فلاي",
    correctedPrescriptionsCount: "عدد الروشتات الفعلية",
    prescriptionsDeltaColumn: "-/+ عدد الروشتات",
    amountDeltaColumn: "-/+ قيمة المطالبة",
    Increase: "زيادة",
    Decrease: "نقص",
    NoDifference: "لا يوجد فرق",
  },
  en: {
    amountComparison: "Claim amount comparison",
    prescriptionsComparison: "Prescription count comparison",
    originalAmount: "Original amount before discount",
    correctedAmount: "Corrected amount",
    absoluteDifference: "Absolute difference",
    direction: "Difference direction",
    originalPrescriptionsCount: "Original prescription count",
    correctedPrescriptionsCount: "Corrected prescription count",
    prescriptionsDeltaColumn: "+/- Prescriptions",
    amountDeltaColumn: "+/- Claim amount",
    Increase: "Increase",
    Decrease: "Decrease",
    NoDifference: "No difference",
  },
};

export function claimReviewComparisonTranslation(
  key: ClaimReviewComparisonTranslationKey,
  language: ClaimReviewComparisonLanguage,
): string {
  return translations[language][key];
}