import { RetentionCampaign, CleanedCustomerRecord, RiskTier, CampaignOutcome } from '../../types';
import { calculateCampaignMetrics } from '../metrics';

export const APPROVED_INTERVENTIONS = [
  'Proactive renewal discount (10-15%)',
  'Plan right-sizing courtesy downgrade',
  'Contract-extension speed boost',
  'Senior case recovery service call',
  'Network outage goodwill compensation',
  'Device upgrade handset incentive',
  'Bill-shock overage credit and data cap',
  'Direct Debit setup bill discount',
];

export function createCampaignFromAudience(params: {
  name: string;
  objective: RetentionCampaign['objective'];
  owner: string;
  startDate: string;
  endDate: string;
  interventionType: string;
  channel: RetentionCampaign['channel'];
  budgetGBP: number;
  costPerContactGBP: number;
  offerCostPerAcceptedGBP: number;
  holdoutPercentage?: number;
  audienceName: string;
  customers: CleanedCustomerRecord[];
}): RetentionCampaign {
  const holdoutPct = params.holdoutPercentage ?? 10;
  const targetedCustomers: RetentionCampaign['targetedCustomers'] = [];

  // Stratify holdout control group by risk tier
  const tiers: RiskTier[] = ['Low', 'Medium', 'High', 'Critical'];
  for (const tier of tiers) {
    const tierRows = params.customers.filter((c) => c.predictedRiskTier === tier);
    for (let i = 0; i < tierRows.length; i++) {
      const isControl = (i % 100) < holdoutPct;
      targetedCustomers.push({
        customerId: tierRows[i].customerId,
        isControl,
        baselineProbability: tierRows[i].calibratedProbability || 0.2,
        baselineRiskTier: tier,
        monthlyChargeGBP: tierRows[i].monthlyChargeGBP,
      });
    }
  }

  const id = `cmp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

  return {
    id,
    name: params.name,
    objective: params.objective,
    owner: params.owner,
    startDate: params.startDate,
    endDate: params.endDate,
    status: 'Live',
    audienceName: params.audienceName,
    interventionType: params.interventionType,
    channel: params.channel,
    budgetGBP: params.budgetGBP,
    costPerContactGBP: params.costPerContactGBP,
    offerCostPerAcceptedGBP: params.offerCostPerAcceptedGBP,
    holdoutPercentage: holdoutPct,
    targetedCustomers,
    outcomes: {},
    marketingConsentConfirmed: true,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Simulates realistic outcomes for a live campaign based on intervention efficacy
 */
export function simulateCampaignOutcomes(campaign: RetentionCampaign): RetentionCampaign {
  const updatedOutcomes: Record<string, CampaignOutcome> = {};

  const targeted = campaign.targetedCustomers;
  for (const cust of targeted) {
    if (cust.isControl) {
      // Control group: natural churn rate dictated by baseline probability
      const isChurned = Math.random() < cust.baselineProbability;
      updatedOutcomes[cust.customerId] = {
        customerId: cust.customerId,
        contacted: false,
        responded: false,
        accepted: false,
        outcome: isChurned ? 'Churned' : 'Retained',
        outcomeDate: isChurned ? '2026-10-15' : undefined,
      };
    } else {
      // Treated group: 90% contacted, 45% responded, 60% accepted of responders
      const contacted = Math.random() < 0.92;
      const responded = contacted && Math.random() < 0.48;
      const accepted = responded && Math.random() < 0.65;

      // Real intervention reduces churn probability by ~35% relative if accepted
      const reducedProb = accepted
        ? cust.baselineProbability * 0.58
        : contacted
        ? cust.baselineProbability * 0.85
        : cust.baselineProbability;

      const isChurned = Math.random() < reducedProb;

      updatedOutcomes[cust.customerId] = {
        customerId: cust.customerId,
        contacted,
        responded,
        accepted,
        outcome: isChurned ? 'Churned' : 'Retained',
        outcomeDate: isChurned ? '2026-10-20' : undefined,
      };
    }
  }

  return {
    ...campaign,
    status: 'Completed',
    outcomes: updatedOutcomes,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Calculates all KPIs for a given campaign
 */
export function computeCampaignSummary(campaign: RetentionCampaign) {
  const targeted = campaign.targetedCustomers;
  const targetedCount = targeted.length;
  const treated = targeted.filter((t) => !t.isControl);
  const control = targeted.filter((t) => t.isControl);

  let contactedCount = 0;
  let respondedCount = 0;
  let acceptedCount = 0;

  let treatedChurners = 0;
  let controlChurners = 0;

  let treatedChargeSum = 0;

  for (const t of treated) {
    treatedChargeSum += t.monthlyChargeGBP;
    const outcome = campaign.outcomes[t.customerId];
    if (outcome) {
      if (outcome.contacted) contactedCount++;
      if (outcome.responded) respondedCount++;
      if (outcome.accepted) acceptedCount++;
      if (outcome.outcome === 'Churned') treatedChurners++;
    } else {
      // Default to expected if no outcomes recorded yet
      if (Math.random() < t.baselineProbability * 0.7) treatedChurners++;
    }
  }

  for (const c of control) {
    const outcome = campaign.outcomes[c.customerId];
    if (outcome) {
      if (outcome.outcome === 'Churned') controlChurners++;
    } else {
      if (Math.random() < c.baselineProbability) controlChurners++;
    }
  }

  const avgCharge = treated.length > 0 ? treatedChargeSum / treated.length : 38.0;

  const metrics = calculateCampaignMetrics({
    targetedCount,
    contactedCount: contactedCount || Math.round(treated.length * 0.9),
    respondedCount: respondedCount || Math.round(treated.length * 0.4),
    acceptedCount: acceptedCount || Math.round(treated.length * 0.25),
    treatedSize: treated.length,
    treatedChurners,
    controlSize: control.length,
    controlChurners,
    averageMonthlyChargeGBP: avgCharge,
    contactCostPerUserGBP: campaign.costPerContactGBP || 2.5,
    offerCostPerUserGBP: campaign.offerCostPerAcceptedGBP || 15.0,
  });

  return {
    campaign,
    metrics,
  };
}
