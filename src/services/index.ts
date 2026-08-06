// Barrel export for services
export {
  login,
  logout,
  getSession,
  getUserRole,
  getRemainingLockoutMinutes,
} from './auth.service'

export type { LoginResult, SessionResult } from './auth.service'

export {
  createPlan,
  updatePlan,
  deletePlan,
  getPlans,
  getPlanById,
  getActivePlans,
  PlanNotFoundError,
  PlanOwnershipError,
  PlanHasActiveAffiliatesError,
  PlanValidationError,
} from './plan.service'

export {
  registerAffiliate,
  searchAffiliates,
  updatePin,
  getAffiliateProfile,
  AffiliateValidationError,
  DuplicateDocumentError,
  AffiliateNotFoundError,
  InvalidPlanError,
} from './affiliate.service'

export type { RegisterAffiliateResult } from './affiliate.service'

export {
  getEntryHistory,
  getRenewalHistory,
  getExpiredAffiliates,
  getActiveAffiliates,
  getExpiringAffiliates,
  getEntriesByDay,
  getEntriesByMonth,
} from './report.service'

export type {
  ReportFilters,
  EntryHistoryRow,
  RenewalHistoryRow,
  AffiliateStatusRow,
  DailyEntryCount,
  MonthlyEntryCount,
} from './report.service'
