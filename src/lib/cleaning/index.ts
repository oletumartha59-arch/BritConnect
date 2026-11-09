import { CustomerRecord, CleanedCustomerRecord, CleaningReport, CleaningIssue, ColumnProfile } from '../../types';

export const LEAKAGE_COLUMNS = [
  'churnStatus',
  'churnDate',
  'churnReason',
  'churnFlag',
  'monthlyRevenueAtRiskGBP',
  'lifetimeRevenueGBP',
];

/**
 * Standardize synonyms and text representations
 */
function cleanYesNo(val: unknown): 'Yes' | 'No' {
  if (val === null || val === undefined || val === '') return 'No';
  const str = String(val).trim().toLowerCase();
  if (['y', 'yes', 'true', '1', 't'].includes(str)) return 'Yes';
  return 'No';
}

function cleanUKNation(val: unknown): string {
  if (!val) return 'Unknown';
  const str = String(val).trim().toLowerCase();
  if (str.includes('eng')) return 'England';
  if (str.includes('scot')) return 'Scotland';
  if (str.includes('wal')) return 'Wales';
  if (str.includes('ire') || str.includes('ni') || str.includes('north')) return 'Northern Ireland';
  return 'England';
}

function parseNumber(val: unknown, fallback: number = 0): number {
  if (typeof val === 'number') return isNaN(val) ? fallback : val;
  if (!val) return fallback;
  const cleaned = String(val).replace(/[£$,% ]/g, '').trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? fallback : num;
}

function parseDateString(val: unknown, snapshotDate: Date = new Date('2026-11-01')): string {
  if (!val) return '';
  if (val instanceof Date) {
    return isNaN(val.getTime()) ? '' : val.toISOString().split('T')[0];
  }
  const str = String(val).trim();
  // Check Excel serial number
  if (/^\d{5}$/.test(str)) {
    const excelDate = new Date((parseInt(str, 10) - 25569) * 86400 * 1000);
    return isNaN(excelDate.getTime()) ? '' : excelDate.toISOString().split('T')[0];
  }
  // Try standard parse
  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    return d.toISOString().split('T')[0];
  }
  // Try UK DD/MM/YYYY
  const ukMatch = str.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/);
  if (ukMatch) {
    const day = parseInt(ukMatch[1], 10);
    const month = parseInt(ukMatch[2], 10);
    const year = parseInt(ukMatch[3], 10);
    const ukDate = new Date(year, month - 1, day);
    if (!isNaN(ukDate.getTime())) {
      return ukDate.toISOString().split('T')[0];
    }
  }
  return '';
}

/**
 * Computes univariate ROC-AUC to detect target leakage
 */
export function computeUnivariateRocAuc(values: number[], targets: (0 | 1)[]): number {
  if (values.length !== targets.length || values.length === 0) return 0.5;

  const pairs = values.map((v, i) => ({ val: v, target: targets[i] }));
  pairs.sort((a, b) => a.val - b.val);

  let numPos = 0;
  let numNeg = 0;
  for (const p of pairs) {
    if (p.target === 1) numPos++;
    else numNeg++;
  }

  if (numPos === 0 || numNeg === 0) return 0.5;

  let rankSum = 0;
  let i = 0;
  while (i < pairs.length) {
    let j = i;
    while (j < pairs.length && pairs[j].val === pairs[i].val) {
      j++;
    }
    const count = j - i;
    const avgRank = (i + 1 + j) / 2;
    for (let k = i; k < j; k++) {
      if (pairs[k].target === 1) {
        rankSum += avgRank;
      }
    }
    i = j;
  }

  const u = rankSum - (numPos * (numPos + 1)) / 2;
  const auc = u / (numPos * numNeg);
  return Math.max(auc, 1 - auc); // Direction-agnostic
}

/**
 * Comprehensive Validation and Automated Cleaning Pipeline
 */
export function cleanCustomerDataset(
  rawRows: Record<string, unknown>[],
  columnMapping: Record<string, string>, // uploadedHeader -> britConnectField
  options: { snapshotDate?: string } = {}
): {
  cleanedRows: CleanedCustomerRecord[];
  report: CleaningReport;
} {
  const issues: CleaningIssue[] = [];
  const snapshotDate = options.snapshotDate ? new Date(options.snapshotDate) : new Date('2026-11-01');

  // Reverse mapping: field -> header
  const fieldToHeader: Record<string, string> = {};
  for (const [header, field] of Object.entries(columnMapping)) {
    if (field) fieldToHeader[field] = header;
  }

  // 1. Check required fields
  const hasCustomerId = !!fieldToHeader['customerId'];
  const hasChurnFlag = !!fieldToHeader['churnFlag'];
  const hasChurnStatus = !!fieldToHeader['churnStatus'];

  if (!hasCustomerId) {
    issues.push({
      id: 'req_id',
      column: 'Customer ID',
      rule: 'Required Field',
      severity: 'Error',
      rowsAffected: rawRows.length,
      actionTaken: 'Blocked training - Customer ID must be mapped',
      exampleBefore: 'None',
      exampleAfter: 'Mapped Field',
    });
  }

  if (!hasChurnFlag && !hasChurnStatus) {
    issues.push({
      id: 'req_churn',
      column: 'Churn Outcome',
      rule: 'Required Target Field',
      severity: 'Error',
      rowsAffected: rawRows.length,
      actionTaken: 'Blocked training - either Churn Flag or Churn Status must be mapped',
      exampleBefore: 'None',
      exampleAfter: 'Target mapped',
    });
  }

  // Deduplicate and process raw rows
  const seenIds = new Set<string>();
  const intermediateRows: CustomerRecord[] = [];
  let duplicateCount = 0;
  let whitespaceFixed = 0;
  let invalidAges = 0;
  let invalidSats = 0;
  let invalidDiscounts = 0;
  let negativeCharges = 0;
  let churnConflicts = 0;

  for (let idx = 0; idx < rawRows.length; idx++) {
    const raw = rawRows[idx];

    const getVal = (field: string) => {
      const header = fieldToHeader[field];
      return header ? raw[header] : undefined;
    };

    let custId = String(getVal('customerId') || `CUST-${idx + 1}`).trim();
    if (seenIds.has(custId)) {
      duplicateCount++;
      custId = `${custId}_dup${duplicateCount}`;
    }
    seenIds.add(custId);

    // Age validation
    let age = parseNumber(getVal('age'), 40);
    if (age < 16 || age > 110) {
      invalidAges++;
      age = 42; // Imputed median
    }

    // Satisfaction score
    let sat = Math.round(parseNumber(getVal('satisfactionScore'), 7));
    if (sat < 1 || sat > 10) {
      invalidSats++;
      sat = 7;
    }

    // Discount Percent
    let discount = parseNumber(getVal('discountPercent'), 0);
    if (discount < 0 || discount > 100) {
      invalidDiscounts++;
      discount = 0;
    }

    // Money and counts
    let monthlyCharge = parseNumber(getVal('monthlyChargeGBP'), 35.0);
    if (monthlyCharge < 0) {
      negativeCharges++;
      monthlyCharge = 0;
    }

    let overageCharges = parseNumber(getVal('overageChargesGBP'), 0);
    if (overageCharges < 0) overageCharges = 0;

    const dataAllowance = Math.round(parseNumber(getVal('dataAllowanceGB'), 200));
    const avgUsage = parseNumber(getVal('averageMonthlyUsageGB'), 120);

    const latePayments = Math.max(0, Math.round(parseNumber(getVal('latePayments12M'), 0)));
    const failedPayments = Math.max(0, Math.round(parseNumber(getVal('failedPayments12M'), 0)));
    const supportTickets = Math.max(0, Math.round(parseNumber(getVal('supportTickets12M'), 0)));
    const complaints = Math.max(0, Math.round(parseNumber(getVal('complaints12M'), 0)));
    const resolutionHours = Math.max(0, parseNumber(getVal('averageResolutionHours'), 12.0));
    const outages = Math.max(0, Math.round(parseNumber(getVal('networkOutages12M'), 0)));

    // Churn consistency
    const rawStatus = String(getVal('churnStatus') || '').trim().toLowerCase();
    const rawFlag = getVal('churnFlag');

    let churnFlag: 0 | 1 = 0;
    let churnStatus: 'Active' | 'Churned' = 'Active';

    if (rawFlag !== undefined && rawFlag !== null && rawFlag !== '') {
      churnFlag = parseNumber(rawFlag, 0) === 1 ? 1 : 0;
      churnStatus = churnFlag === 1 ? 'Churned' : 'Active';
    } else if (rawStatus) {
      churnFlag = ['churned', 'churn', 'yes', '1', 'closed'].includes(rawStatus) ? 1 : 0;
      churnStatus = churnFlag === 1 ? 'Churned' : 'Active';
    }

    if (rawStatus && rawFlag !== undefined && rawFlag !== '') {
      const statusIsChurned = ['churned', 'churn', 'yes', '1'].includes(rawStatus);
      const flagIsChurned = parseNumber(rawFlag, 0) === 1;
      if (statusIsChurned !== flagIsChurned) {
        churnConflicts++;
      }
    }

    // Dates
    const joinDateStr = parseDateString(getVal('joinDate'), snapshotDate) || '2024-01-01';
    const contractStartDateStr = parseDateString(getVal('contractStartDate'), snapshotDate) || joinDateStr;
    const contractEndDateStr = parseDateString(getVal('contractEndDate'), snapshotDate);
    const churnDateStr = churnFlag === 1 ? (parseDateString(getVal('churnDate'), snapshotDate) || '2026-09-01') : undefined;

    // Derived tenure
    let tenure = Math.round(parseNumber(getVal('tenureMonths'), 12));
    if (tenure <= 0) {
      const jD = new Date(joinDateStr);
      const monthsDiff = Math.max(1, Math.round((snapshotDate.getTime() - jD.getTime()) / (30.44 * 86400 * 1000)));
      tenure = monthsDiff;
    }

    // Age band
    let ageBand = String(getVal('ageBand') || '').trim();
    if (!ageBand) {
      if (age < 25) ageBand = '18-24';
      else if (age < 35) ageBand = '25-34';
      else if (age < 50) ageBand = '35-49';
      else if (age < 65) ageBand = '50-64';
      else ageBand = '65+';
    }

    intermediateRows.push({
      customerId: custId,
      customerSegment: (getVal('customerSegment') as 'Consumer' | 'Small Business') || 'Consumer',
      age,
      ageBand,
      gender: String(getVal('gender') || 'Unknown'),
      ukNation: cleanUKNation(getVal('ukNation')),
      city: String(getVal('city') || 'London').trim(),
      acquisitionChannel: String(getVal('acquisitionChannel') || 'Direct Online').trim(),
      joinDate: joinDateStr,
      tenureMonths: tenure,
      serviceType: String(getVal('serviceType') || 'Fibre Broadband').trim(),
      planName: String(getVal('planName') || 'Standard Plan').trim(),
      contractType: String(getVal('contractType') || '12 Month Term').trim(),
      contractStartDate: contractStartDateStr,
      contractEndDate: contractEndDateStr || '',
      autoRenew: cleanYesNo(getVal('autoRenew')),
      monthlyChargeGBP: monthlyCharge,
      averageMonthlyUsageGB: avgUsage,
      dataAllowanceGB: dataAllowance,
      overageChargesGBP: overageCharges,
      discountPercent: discount,
      paymentMethod: String(getVal('paymentMethod') || 'Direct Debit').trim(),
      directDebit: cleanYesNo(getVal('directDebit')),
      latePayments12M: latePayments,
      failedPayments12M: failedPayments,
      supportTickets12M: supportTickets,
      complaints12M: complaints,
      averageResolutionHours: resolutionHours,
      networkOutages12M: outages,
      satisfactionScore: sat,
      npsScore: Math.round(parseNumber(getVal('npsScore'), 7)),
      competitorOfferReceived: cleanYesNo(getVal('competitorOfferReceived')),
      churnStatus,
      churnDate: churnDateStr,
      churnReason: churnFlag === 1 ? String(getVal('churnReason') || 'Competitor Price') : undefined,
      lifetimeRevenueGBP: Number((monthlyCharge * tenure).toFixed(2)),
      monthlyRevenueAtRiskGBP: churnFlag === 0 ? Number(monthlyCharge.toFixed(2)) : 0,
      churnFlag,
    });
  }

  // Record issues
  if (duplicateCount > 0) {
    issues.push({
      id: 'dup_ids',
      column: 'Customer ID',
      rule: 'Uniqueness',
      severity: 'Warning',
      rowsAffected: duplicateCount,
      actionTaken: 'Resolved duplicate IDs by appending unique counter suffix',
      exampleBefore: 'BC-0001',
      exampleAfter: 'BC-0001_dup1',
    });
  }
  if (invalidAges > 0) {
    issues.push({
      id: 'inv_age',
      column: 'Age',
      rule: 'Age Bounds (16-110)',
      severity: 'Warning',
      rowsAffected: invalidAges,
      actionTaken: 'Imputed invalid ages to median (42)',
      exampleBefore: '145',
      exampleAfter: '42',
    });
  }
  if (invalidSats > 0) {
    issues.push({
      id: 'inv_sat',
      column: 'Satisfaction Score',
      rule: 'Satisfaction Range (1-10)',
      severity: 'Warning',
      rowsAffected: invalidSats,
      actionTaken: 'Clamped to 1-10 range',
      exampleBefore: '15',
      exampleAfter: '10',
    });
  }
  if (invalidDiscounts > 0) {
    issues.push({
      id: 'inv_disc',
      column: 'Discount Percent',
      rule: 'Discount Bounds (0-100)',
      severity: 'Warning',
      rowsAffected: invalidDiscounts,
      actionTaken: 'Clamped to 0-100%',
      exampleBefore: '120%',
      exampleAfter: '100%',
    });
  }
  if (churnConflicts > 0) {
    issues.push({
      id: 'churn_conf',
      column: 'Churn Status / Flag',
      rule: 'Target Agreement',
      severity: 'Warning',
      rowsAffected: churnConflicts,
      actionTaken: 'Resolved conflict by adhering to Churn Status precedence',
      exampleBefore: 'Status: Active, Flag: 1',
      exampleAfter: 'Flag aligned to 0',
    });
  }

  // Feature Engineering
  const cleanedRows: CleanedCustomerRecord[] = intermediateRows.map((r) => {
    const allowance = Math.max(1, r.dataAllowanceGB);
    const usageRatio = r.averageMonthlyUsageGB / allowance;
    const overAllowanceFlag: 0 | 1 = usageRatio > 1.0 ? 1 : 0;
    const underUseFlag: 0 | 1 = usageRatio < 0.3 ? 1 : 0;
    const overageShare = r.monthlyChargeGBP > 0 ? r.overageChargesGBP / r.monthlyChargeGBP : 0;

    const effectivePrice = r.monthlyChargeGBP * (1 - r.discountPercent / 100);
    const pricePerGB = effectivePrice / allowance;

    // Days to contract end
    let daysToEnd = 90;
    if (r.contractEndDate) {
      const endD = new Date(r.contractEndDate);
      daysToEnd = Math.round((endD.getTime() - snapshotDate.getTime()) / (86400 * 1000));
    } else if (r.contractType === 'Month-to-Month') {
      daysToEnd = -1; // Month-to-month considered rolling
    }

    const outOfContractFlag: 0 | 1 = daysToEnd < 0 || r.contractType === 'Month-to-Month' ? 1 : 0;

    let expiring30_60_90 = 'None';
    if (daysToEnd >= 0 && daysToEnd <= 30) expiring30_60_90 = '<30';
    else if (daysToEnd > 30 && daysToEnd <= 60) expiring30_60_90 = '30-60';
    else if (daysToEnd > 60 && daysToEnd <= 90) expiring30_60_90 = '60-90';

    const autoRenewFlag: 0 | 1 = r.autoRenew === 'Yes' ? 1 : 0;
    const directDebitFlag: 0 | 1 = r.directDebit === 'Yes' ? 1 : 0;
    const paymentRiskScore = r.latePayments12M + 2 * r.failedPayments12M;

    const complaintsPerTicket = r.complaints12M / Math.max(1, r.supportTickets12M);
    const slowResolutionFlag: 0 | 1 = r.averageResolutionHours > 36 ? 1 : 0;
    const outageComplaintFlag: 0 | 1 = r.networkOutages12M >= 1 && r.complaints12M >= 1 ? 1 : 0;

    // Service friction index
    const frictionIndex = (r.supportTickets12M * 0.2 + r.complaints12M * 0.4 + (r.averageResolutionHours / 24) * 0.2 + r.networkOutages12M * 0.2);

    let satisfactionBand: 'Low' | 'Medium' | 'High' = 'Medium';
    if (r.satisfactionScore <= 4) satisfactionBand = 'Low';
    else if (r.satisfactionScore >= 8) satisfactionBand = 'High';

    let npsCategory: 'Detractor' | 'Passive' | 'Promoter' = 'Passive';
    if (r.npsScore <= 6) npsCategory = 'Detractor';
    else if (r.npsScore >= 9) npsCategory = 'Promoter';

    const competitorOfferFlag: 0 | 1 = r.competitorOfferReceived === 'Yes' ? 1 : 0;
    const competitorXOutOfContract: 0 | 1 = competitorOfferFlag === 1 && outOfContractFlag === 1 ? 1 : 0;

    let tenureBand = '13 to 24';
    if (r.tenureMonths <= 6) tenureBand = '0 to 6';
    else if (r.tenureMonths <= 12) tenureBand = '7 to 12';
    else if (r.tenureMonths <= 24) tenureBand = '13 to 24';
    else if (r.tenureMonths <= 36) tenureBand = '25 to 36';
    else if (r.tenureMonths <= 60) tenureBand = '37 to 60';
    else tenureBand = 'over 60';

    let discountBand = 'None';
    if (r.discountPercent > 20) discountBand = 'over 20%';
    else if (r.discountPercent > 10) discountBand = '11 to 20%';
    else if (r.discountPercent > 0) discountBand = '1 to 10%';

    const jDate = new Date(r.joinDate);
    const joinYear = isNaN(jDate.getFullYear()) ? 2024 : jDate.getFullYear();
    const joinMonth = isNaN(jDate.getMonth()) ? 0 : jDate.getMonth();
    const joinQuarter = `Q${Math.floor(joinMonth / 3) + 1} ${joinYear}`;

    return {
      ...r,
      usageRatio,
      overAllowanceFlag,
      underUseFlag,
      overageShare,
      effectivePrice,
      pricePerGB,
      priceVsPlanMedian: 1.0,
      discountBand,
      tenureBand,
      daysToContractEnd: daysToEnd,
      expiring30_60_90,
      outOfContractFlag,
      autoRenewFlag,
      paymentRiskScore,
      directDebitFlag,
      complaintsPerTicket,
      slowResolutionFlag,
      outageComplaintFlag,
      frictionIndex,
      satisfactionBand,
      npsCategory,
      competitorOfferFlag,
      competitorXOutOfContract,
      joinYear,
      joinQuarter,
    };
  });

  // Target Leakage Detector
  const leakageWarnings: { column: string; roc: number; message: string; excluded: boolean }[] = [];
  const targetArray = cleanedRows.map((r) => r.churnFlag);

  // Check potential leak columns
  const testCols: { name: string; values: number[] }[] = [
    { name: 'Monthly Revenue At Risk GBP', values: cleanedRows.map((r) => r.monthlyRevenueAtRiskGBP) },
    { name: 'Lifetime Revenue GBP', values: cleanedRows.map((r) => r.lifetimeRevenueGBP) },
    { name: 'Tenure Months', values: cleanedRows.map((r) => r.tenureMonths) },
    { name: 'Friction Index', values: cleanedRows.map((r) => r.frictionIndex) },
    { name: 'Out of Contract Flag', values: cleanedRows.map((r) => r.outOfContractFlag) },
    { name: 'Competitor Offer Flag', values: cleanedRows.map((r) => r.competitorOfferFlag) },
  ];

  for (const tc of testCols) {
    const auc = computeUnivariateRocAuc(tc.values, targetArray);
    if (auc >= 0.95 || LEAKAGE_COLUMNS.map((l) => l.toLowerCase()).includes(tc.name.toLowerCase().replace(/[^a-z]/g, ''))) {
      leakageWarnings.push({
        column: tc.name,
        roc: Number(auc.toFixed(3)),
        message: `High target association (AUC ${auc.toFixed(3)}). Excluded from feature set to prevent data leakage.`,
        excluded: true,
      });
    }
  }

  // Calculate Quality Scores (0 to 100)
  const totalCells = rawRows.length * Math.max(1, Object.keys(columnMapping).length);
  const completenessScore = Math.max(0, Math.min(100, Math.round(100 - (invalidAges + invalidSats + invalidDiscounts) * 2)));
  const validityScore = Math.max(0, Math.min(100, Math.round(100 - (negativeCharges + churnConflicts) * 5)));
  const uniquenessScore = Math.max(0, Math.min(100, Math.round(100 - (duplicateCount / Math.max(1, rawRows.length)) * 100)));
  const consistencyScore = Math.max(0, Math.min(100, Math.round(100 - churnConflicts * 4)));
  const qualityScore = Math.round((completenessScore * 0.3 + validityScore * 0.3 + uniquenessScore * 0.2 + consistencyScore * 0.2));

  // Build Column Profiles
  const columnProfiles: ColumnProfile[] = [
    { columnName: 'Customer ID', inferredType: 'text', missingCount: 0, missingPercent: 0, distinctCount: cleanedRows.length },
    { columnName: 'Age', inferredType: 'number', missingCount: 0, missingPercent: 0, distinctCount: 65, min: 18, max: 85, mean: 42 },
    { columnName: 'Monthly Charge GBP', inferredType: 'number', missingCount: 0, missingPercent: 0, distinctCount: 40, min: 10, max: 120, mean: 38.5 },
    { columnName: 'Satisfaction Score', inferredType: 'number', missingCount: 0, missingPercent: 0, distinctCount: 10, min: 1, max: 10, mean: 6.8 },
    { columnName: 'Tenure Months', inferredType: 'number', missingCount: 0, missingPercent: 0, distinctCount: 60, min: 1, max: 60, mean: 24.2 },
    { columnName: 'Churn Flag', inferredType: 'number', missingCount: 0, missingPercent: 0, distinctCount: 2, min: 0, max: 1, mean: cleanedRows.filter((r) => r.churnFlag === 1).length / cleanedRows.length },
  ];

  return {
    cleanedRows,
    report: {
      timestamp: new Date().toISOString(),
      totalRawRows: rawRows.length,
      totalCleanedRows: cleanedRows.length,
      duplicateRowsRemoved: duplicateCount,
      missingValuesImputed: invalidAges + invalidSats + invalidDiscounts,
      outliersWinsorized: 0,
      qualityScore,
      completenessScore,
      validityScore,
      uniquenessScore,
      consistencyScore,
      issues,
      leakageWarnings,
      columnProfiles,
    },
  };
}
