import { CustomerRecord, CleanedCustomerRecord, RiskTier } from '../types';

/**
 * BritConnect Single Source of Truth for Business Metrics & Statistical Calculations
 * Guarded against division by zero, NaN, and null/undefined values.
 */

export function calculateTotalCustomers(rows: CustomerRecord[]): number {
  return rows.length;
}

export function filterActiveCustomers<T extends CustomerRecord>(rows: T[]): T[] {
  return rows.filter((r) => r.churnFlag === 0 || r.churnStatus?.toLowerCase() === 'active');
}

export function filterChurnedCustomers<T extends CustomerRecord>(rows: T[]): T[] {
  return rows.filter((r) => r.churnFlag === 1 || r.churnStatus?.toLowerCase() === 'churned');
}

export function calculateChurnRate(rows: CustomerRecord[]): number {
  if (!rows || rows.length === 0) return 0;
  const churned = filterChurnedCustomers(rows).length;
  return churned / rows.length;
}

export function calculateMRR(rows: CustomerRecord[]): number {
  if (!rows || rows.length === 0) return 0;
  const active = filterActiveCustomers(rows);
  return active.reduce((sum, r) => sum + (Number(r.monthlyChargeGBP) || 0), 0);
}

export function calculateARPU(rows: CustomerRecord[]): number {
  const active = filterActiveCustomers(rows);
  if (active.length === 0) return 0;
  const mrr = calculateMRR(rows);
  return mrr / active.length;
}

export function calculateMonthlyRevenueAtRisk(rows: CleanedCustomerRecord[]): number {
  if (!rows || rows.length === 0) return 0;
  const active = filterActiveCustomers(rows);
  
  // If calibrated probabilities exist, calculate probability * monthlyCharge
  const hasProbabilities = active.some((r) => typeof r.calibratedProbability === 'number');
  if (hasProbabilities) {
    return active.reduce((sum, r) => {
      const prob = typeof r.calibratedProbability === 'number' ? r.calibratedProbability : 0;
      const charge = Number(r.monthlyChargeGBP) || 0;
      return sum + prob * charge;
    }, 0);
  }

  // Fallback to the file's own Monthly Revenue At Risk if present
  return active.reduce((sum, r) => sum + (Number(r.monthlyRevenueAtRiskGBP) || 0), 0);
}

export function calculateAverageTenure(rows: CustomerRecord[]): number {
  if (!rows || rows.length === 0) return 0;
  const sum = rows.reduce((acc, r) => acc + (Number(r.tenureMonths) || 0), 0);
  return sum / rows.length;
}

export function calculateAverageSatisfaction(rows: CustomerRecord[]): number {
  const valid = rows.filter((r) => typeof r.satisfactionScore === 'number' && !isNaN(r.satisfactionScore));
  if (valid.length === 0) return 0;
  const sum = valid.reduce((acc, r) => acc + r.satisfactionScore, 0);
  return sum / valid.length;
}

export function calculateNPS(rows: CustomerRecord[]): {
  nps: number;
  promotersPct: number;
  passivesPct: number;
  detractorsPct: number;
  scaleDetected: '0-10' | '-100-100';
} {
  const valid = rows.filter((r) => typeof r.npsScore === 'number' && !isNaN(r.npsScore));
  if (valid.length === 0) {
    return { nps: 0, promotersPct: 0, passivesPct: 0, detractorsPct: 0, scaleDetected: '0-10' };
  }

  // Detect scale
  const hasNegative = valid.some((r) => r.npsScore < 0);
  const maxScore = Math.max(...valid.map((r) => r.npsScore));

  if (hasNegative || maxScore > 10) {
    // -100 to 100 scale: >0 is promoter, 0 passive, <0 detractor
    const promoters = valid.filter((r) => r.npsScore > 0).length;
    const passives = valid.filter((r) => r.npsScore === 0).length;
    const detractors = valid.filter((r) => r.npsScore < 0).length;
    const total = valid.length;
    const promotersPct = (promoters / total) * 100;
    const passivesPct = (passives / total) * 100;
    const detractorsPct = (detractors / total) * 100;
    const nps = promotersPct - detractorsPct;
    return { nps, promotersPct, passivesPct, detractorsPct, scaleDetected: '-100-100' };
  } else {
    // 0 to 10 scale: 9-10 promoter, 7-8 passive, 0-6 detractor
    const promoters = valid.filter((r) => r.npsScore >= 9).length;
    const passives = valid.filter((r) => r.npsScore >= 7 && r.npsScore <= 8).length;
    const detractors = valid.filter((r) => r.npsScore <= 6).length;
    const total = valid.length;
    const promotersPct = (promoters / total) * 100;
    const passivesPct = (passives / total) * 100;
    const detractorsPct = (detractors / total) * 100;
    const nps = promotersPct - detractorsPct;
    return { nps, promotersPct, passivesPct, detractorsPct, scaleDetected: '0-10' };
  }
}

export function calculateExpectedChurners(rows: CleanedCustomerRecord[]): number {
  const active = filterActiveCustomers(rows);
  return active.reduce((sum, r) => {
    const prob = typeof r.calibratedProbability === 'number' ? r.calibratedProbability : (r.churnFlag === 1 ? 1 : 0);
    return sum + prob;
  }, 0);
}

export function calculateRiskTierDistribution(rows: CleanedCustomerRecord[]): Record<
  RiskTier,
  { count: number; percent: number; revenueAtRisk: number }
> {
  const active = filterActiveCustomers(rows);
  const total = active.length || 1;

  const result: Record<RiskTier, { count: number; percent: number; revenueAtRisk: number }> = {
    Low: { count: 0, percent: 0, revenueAtRisk: 0 },
    Medium: { count: 0, percent: 0, revenueAtRisk: 0 },
    High: { count: 0, percent: 0, revenueAtRisk: 0 },
    Critical: { count: 0, percent: 0, revenueAtRisk: 0 },
  };

  for (const r of active) {
    const tier: RiskTier = r.predictedRiskTier || 'Low';
    const charge = Number(r.monthlyChargeGBP) || 0;
    const prob = typeof r.calibratedProbability === 'number' ? r.calibratedProbability : 0;
    const revRisk = prob * charge;

    result[tier].count += 1;
    result[tier].revenueAtRisk += revRisk;
  }

  for (const tier of Object.keys(result) as RiskTier[]) {
    result[tier].percent = (result[tier].count / total) * 100;
  }

  return result;
}

/**
 * Contract Expiration Analysis for Active Subscribers
 * Groups subscribers by days remaining until contract expiry:
 * - 0 to 30 days: immediate risk window requiring urgent renewal intervention
 * - 31 to 60 days: proactive outbound renewal negotiation window
 * - 61 to 90 days: early re-contracting and tariff upgrade discovery window
 */
export function calculateExpiringContracts(
  rows: CustomerRecord[],
  minDays: number,
  maxDays: number
): {
  subscribers: CustomerRecord[];
  count: number;
  totalMonthlyChargeGBP: number;
  averageMonthlyChargeGBP: number;
} {
  const active = filterActiveCustomers(rows);
  const subscribers = active.filter((r) => {
    const days = typeof r.daysToContractEnd === 'number' ? r.daysToContractEnd : null;
    if (days === null || isNaN(days)) return false;
    return days >= minDays && days <= maxDays;
  });

  const count = subscribers.length;
  const totalMonthlyChargeGBP = subscribers.reduce((sum, r) => sum + (Number(r.monthlyChargeGBP) || 0), 0);
  const averageMonthlyChargeGBP = count > 0 ? totalMonthlyChargeGBP / count : 0;

  return {
    subscribers,
    count,
    totalMonthlyChargeGBP,
    averageMonthlyChargeGBP,
  };
}

export function calculateCumulativeExpiringContracts(
  rows: CustomerRecord[],
  maxDays: number
): {
  count: number;
  totalMonthlyChargeGBP: number;
} {
  return calculateExpiringContracts(rows, 0, maxDays);
}

/**
 * Standard Normal Distribution cumulative distribution function (CDF) for p-value calculation
 */
function standardNormalCdf(z: number): number {
  const p = 0.3275911;
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;

  const sign = z < 0 ? -1 : 1;
  const absZ = Math.abs(z) / Math.SQRT2;

  const t = 1.0 / (1.0 + p * absZ);
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-absZ * absZ);

  return 0.5 * (1.0 + sign * y);
}

/**
 * Campaign Statistical Calculations and Uplift Analysis
 */
export function calculateCampaignMetrics(params: {
  targetedCount: number;
  contactedCount: number;
  respondedCount: number;
  acceptedCount: number;
  treatedSize: number;
  treatedChurners: number;
  controlSize: number;
  controlChurners: number;
  averageMonthlyChargeGBP: number;
  contactCostPerUserGBP: number;
  offerCostPerUserGBP: number;
  retentionMonths?: number;
}) {
  const retentionMonths = params.retentionMonths ?? 12;

  const reach = params.targetedCount > 0 ? params.contactedCount / params.targetedCount : 0;
  const responseRate = params.contactedCount > 0 ? params.respondedCount / params.contactedCount : 0;
  const acceptanceRate = params.contactedCount > 0 ? params.acceptedCount / params.contactedCount : 0;
  
  const treatedRetained = Math.max(0, params.treatedSize - params.treatedChurners);
  const saveRate = params.treatedSize > 0 ? treatedRetained / params.treatedSize : 0;

  const treatedChurnRate = params.treatedSize > 0 ? params.treatedChurners / params.treatedSize : 0;
  const controlChurnRate = params.controlSize > 0 ? params.controlChurners / params.controlSize : 0;

  // Absolute uplift = control churn rate - treated churn rate (percentage points saved)
  const absoluteUplift = controlChurnRate - treatedChurnRate;
  const relativeReduction = controlChurnRate > 0 ? absoluteUplift / controlChurnRate : 0;

  // Incremental customers saved
  const incrementalCustomersSaved = Math.max(0, absoluteUplift * params.treatedSize);

  // Revenue saved = customers saved * monthly charge * retention months
  const incrementalRevenueSaved = incrementalCustomersSaved * params.averageMonthlyChargeGBP * retentionMonths;

  // Costs
  const totalContactCost = params.contactedCount * params.contactCostPerUserGBP;
  const totalOfferCost = params.acceptedCount * params.offerCostPerUserGBP;
  const totalCost = totalContactCost + totalOfferCost;

  const netBenefit = incrementalRevenueSaved - totalCost;
  const roi = totalCost > 0 ? (netBenefit / totalCost) : 0;
  const costPerSavedCustomer = incrementalCustomersSaved > 0 ? totalCost / incrementalCustomersSaved : 0;

  // Two-proportion z-test
  let zScore = 0;
  let pValue = 1;
  let ciLower = 0;
  let ciUpper = 0;
  let isStatisticallySignificant = false;

  if (params.treatedSize > 0 && params.controlSize > 0) {
    const pooledP = (params.treatedChurners + params.controlChurners) / (params.treatedSize + params.controlSize);
    const standardError = Math.sqrt(
      pooledP * (1 - pooledP) * (1 / params.treatedSize + 1 / params.controlSize)
    );

    if (standardError > 0) {
      zScore = (controlChurnRate - treatedChurnRate) / standardError;
      // Two-tailed p-value
      pValue = 2 * (1 - standardNormalCdf(Math.abs(zScore)));
      isStatisticallySignificant = pValue < 0.05;

      const diffSE = Math.sqrt(
        (treatedChurnRate * (1 - treatedChurnRate)) / params.treatedSize +
        (controlChurnRate * (1 - controlChurnRate)) / params.controlSize
      );
      ciLower = absoluteUplift - 1.96 * diffSE;
      ciUpper = absoluteUplift + 1.96 * diffSE;
    }
  }

  const smallSampleWarning = params.treatedSize < 30 || params.controlSize < 30;

  return {
    reach,
    responseRate,
    acceptanceRate,
    saveRate,
    treatedChurnRate,
    controlChurnRate,
    absoluteUplift,
    relativeReduction,
    incrementalCustomersSaved,
    incrementalRevenueSaved,
    totalCost,
    totalContactCost,
    totalOfferCost,
    netBenefit,
    roi,
    costPerSavedCustomer,
    zScore,
    pValue,
    ciLower,
    ciUpper,
    isStatisticallySignificant,
    smallSampleWarning,
  };
}

/**
 * Clean Formatting Helpers meeting BritConnect UI Standards
 */
export function formatGBP(val: number, compact: boolean = false): string {
  if (isNaN(val) || val === null || val === undefined) return '£0';
  if (compact) {
    if (Math.abs(val) >= 1_000_000) {
      return `£${(val / 1_000_000).toFixed(1)}M`;
    }
    if (Math.abs(val) >= 1_000) {
      return `£${(val / 1_000).toFixed(1)}k`;
    }
  }
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: val % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(val);
}

export function formatPercent(val: number, decimals: number = 1): string {
  if (isNaN(val) || val === null || val === undefined) return '0.0%';
  const pct = val <= 1 && val >= -1 ? val * 100 : val;
  return `${pct.toFixed(decimals)}%`;
}

export function formatNumber(val: number): string {
  if (isNaN(val) || val === null || val === undefined) return '0';
  return new Intl.NumberFormat('en-GB').format(Math.round(val));
}

export function formatUKDate(dateStr: string | Date | undefined): string {
  if (!dateStr) return '—';
  const d = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
  if (isNaN(d.getTime())) return String(dateStr);
  return d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}
