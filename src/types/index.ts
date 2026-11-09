export type RiskTier = 'Low' | 'Medium' | 'High' | 'Critical';

export interface CustomerRecord {
  // Core 38 schema columns
  customerId: string;
  customerSegment: 'Consumer' | 'Small Business';
  age: number;
  ageBand: string;
  gender: string;
  ukNation: string;
  city: string;
  acquisitionChannel: string;
  joinDate: string; // YYYY-MM-DD
  tenureMonths: number;
  serviceType: string;
  planName: string;
  contractType: string;
  contractStartDate: string;
  contractEndDate: string;
  autoRenew: 'Yes' | 'No';
  monthlyChargeGBP: number;
  averageMonthlyUsageGB: number;
  dataAllowanceGB: number;
  overageChargesGBP: number;
  discountPercent: number;
  paymentMethod: string;
  directDebit: 'Yes' | 'No';
  latePayments12M: number;
  failedPayments12M: number;
  supportTickets12M: number;
  complaints12M: number;
  averageResolutionHours: number;
  networkOutages12M: number;
  satisfactionScore: number; // 1-10
  npsScore: number;
  competitorOfferReceived: 'Yes' | 'No';
  churnStatus: 'Active' | 'Churned';
  churnDate?: string;
  churnReason?: string;
  lifetimeRevenueGBP: number;
  monthlyRevenueAtRiskGBP: number;
  churnFlag: 0 | 1;

  // Extra mapped fields or raw key-value store if present
  [key: string]: unknown;
}

export interface CleanedCustomerRecord extends CustomerRecord {
  // Engineered features
  usageRatio: number;
  overAllowanceFlag: 0 | 1;
  underUseFlag: 0 | 1;
  overageShare: number;
  effectivePrice: number;
  pricePerGB: number;
  priceVsPlanMedian: number;
  discountBand: string;
  tenureBand: string;
  daysToContractEnd: number;
  expiring30_60_90: string; // 'None' | '<30' | '30-60' | '60-90'
  outOfContractFlag: 0 | 1;
  autoRenewFlag: 0 | 1;
  paymentRiskScore: number;
  directDebitFlag: 0 | 1;
  complaintsPerTicket: number;
  slowResolutionFlag: 0 | 1;
  outageComplaintFlag: 0 | 1;
  frictionIndex: number;
  satisfactionBand: 'Low' | 'Medium' | 'High';
  npsCategory: 'Detractor' | 'Passive' | 'Promoter';
  competitorOfferFlag: 0 | 1;
  competitorXOutOfContract: 0 | 1;
  joinYear: number;
  joinQuarter: string;

  // Model scoring outcomes
  predictedProbability?: number;
  calibratedProbability?: number;
  predictedRiskTier?: RiskTier;
  expectedRevenueAtRiskGBP?: number;
  clusterId?: number;
  topDrivers?: { name: string; contribution: number; direction: 'increases_risk' | 'lowers_risk'; text: string }[];
}

export interface CleaningIssue {
  id: string;
  column: string;
  rule: string;
  severity: 'Error' | 'Warning' | 'Info';
  rowsAffected: number;
  actionTaken: string;
  exampleBefore: string;
  exampleAfter: string;
}

export interface CleaningReport {
  timestamp: string;
  totalRawRows: number;
  totalCleanedRows: number;
  duplicateRowsRemoved: number;
  missingValuesImputed: number;
  outliersWinsorized: number;
  qualityScore: number; // 0-100
  completenessScore: number;
  validityScore: number;
  uniquenessScore: number;
  consistencyScore: number;
  issues: CleaningIssue[];
  leakageWarnings: { column: string; roc: number; message: string; excluded: boolean }[];
  columnProfiles: ColumnProfile[];
}

export interface ColumnProfile {
  columnName: string;
  inferredType: 'text' | 'number' | 'date' | 'boolean';
  missingCount: number;
  missingPercent: number;
  distinctCount: number;
  min?: number | string;
  max?: number | string;
  mean?: number;
  median?: number;
  topValues?: { value: string; count: number }[];
}

export interface ModelMetrics {
  rocAuc: number;
  prAuc: number;
  accuracy: number;
  precision: number;
  recall: number;
  f1: number;
  f2: number;
  specificity: number;
  brierScore: number;
  logLoss: number;
  ksStatistic: number;
  confusionMatrix: {
    tp: number;
    fp: number;
    tn: number;
    fn: number;
  };
  rocCurve: { fpr: number; tpr: number; threshold: number }[];
  prCurve: { precision: number; recall: number; threshold: number }[];
  calibrationCurve: { meanPredicted: number; observedFrequency: number; count: number }[];
  liftTable: { decile: number; sampleShare: number; churnersCaught: number; cumulativeLift: number }[];
  top10Lift: number;
  top20Lift: number;
}

export interface TrainedModel {
  id: string;
  name: string;
  algorithm: 'logistic_regression' | 'random_forest' | 'gradient_boosted';
  version: string;
  createdAt: string;
  datasetVersion: string;
  featureNames: string[];
  metrics: ModelMetrics;
  cvMeanPrAuc: number;
  cvStdPrAuc: number;
  threshold: number;
  isChampion: boolean;
  featureImportance: { feature: string; importance: number; oddsRatio?: number }[];
  weights?: Record<string, number>;
  hyperparameters: Record<string, unknown>;
  calibrationMethod: 'platt' | 'isotonic';
  fairnessReport: {
    groupType: 'Gender' | 'Age Band' | 'UK Nation';
    groupValue: string;
    sampleSize: number;
    churnRate: number;
    modelErrorRate: number;
    flaggedGap: boolean;
  }[];
}

export interface GlobalFilterState {
  dateRange: { start: string; end: string } | null;
  customerSegment: string[];
  ukNation: string[];
  serviceType: string[];
  contractType: string[];
  acquisitionChannel: string[];
  riskTier: RiskTier[];
  searchQuery: string;
}

export interface CustomerAudience {
  id: string;
  name: string;
  createdAt: string;
  customerCount: number;
  filters: Partial<GlobalFilterState>;
  customerIds: string[];
}

export interface CampaignOutcome {
  customerId: string;
  contacted: boolean;
  responded: boolean;
  accepted: boolean;
  outcome: 'Retained' | 'Churned';
  outcomeDate?: string;
  notes?: string;
}

export interface RetentionCampaign {
  id: string;
  name: string;
  objective: 'reduce_churn' | 'renewal' | 'win_back' | 'stabilise';
  owner: string;
  startDate: string;
  endDate: string;
  status: 'Draft' | 'Scheduled' | 'Live' | 'Completed' | 'Cancelled';
  audienceId?: string;
  audienceName: string;
  interventionType: string;
  channel: 'SMS' | 'Email' | 'Outbound Call' | 'In-App' | 'Post';
  budgetGBP: number;
  costPerContactGBP: number;
  offerCostPerAcceptedGBP: number;
  holdoutPercentage: number; // e.g. 10
  targetedCustomers: {
    customerId: string;
    isControl: boolean;
    baselineProbability: number;
    baselineRiskTier: RiskTier;
    monthlyChargeGBP: number;
  }[];
  outcomes: Record<string, CampaignOutcome>;
  marketingConsentConfirmed: boolean;
  notes?: string;
  updatedAt: string;
}

export interface BehavioralCluster {
  id: number;
  personaName: string;
  description: string;
  recommendedFocus: string;
  size: number;
  percentOfBase: number;
  churnRate: number;
  arpuGBP: number;
  avgTenureMonths: number;
  topDistinguishingFeatures: { name: string; clusterMean: number; populationMean: number; difference: string }[];
}

export interface RecommendationPlan {
  scope: 'customer' | 'segment' | 'portfolio';
  subject: string;
  riskTier: RiskTier;
  churnProbability: number;
  headline: string;
  rootCauses: { driver: string; evidence: string; shareOfRisk: number }[];
  actions: {
    priority: 'P1' | 'P2' | 'P3';
    title: string;
    why: string;
    channel: string;
    offerGuidance: string;
    steps: { step: number; description: string; owner: string; dueInDays: number }[];
    expectedImpact: {
      churnReductionPoints: number;
      revenueSavedGBP: number;
      costGBP: number;
      netBenefitGBP: number;
      confidence: 'Low' | 'Medium' | 'High';
      basis: string;
    };
    kpis: {
      name: string;
      baseline: string;
      target: string;
      measurement: string;
      frequency: string;
      reviewDate: string;
    }[];
    risksAndDependencies: string[];
  }[];
  nextBestAction: string;
  complianceNotes: string[];
  assumptions: string[];
  method: 'AI-Generated (Gemini)' | 'Rule-based Plan (Deterministic Fallback)';
  generatedAt: string;
  dataVersion: string;
}

export interface AppSettings {
  geminiModel: string;
  sendRecordLevelDetail: boolean;
  snapshotDate: string;
  costMatrix: {
    retentionHorizonMonths: number;
    contactCostGBP: number;
    averageOfferCostGBP: number;
  };
  retentionAssumptions: {
    defaultSaveRate: number;
    retentionDurationMonths: number;
  };
  riskThresholds: {
    medium: number; // default 0.25
    high: number;   // default 0.50
    critical: number; // default 0.75
  };
  autoRetrainOnUpload: boolean;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  action: string;
  details: string;
  user: string;
}
