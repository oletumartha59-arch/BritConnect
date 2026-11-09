import { z } from 'zod';
import { CleanedCustomerRecord, RecommendationPlan, RiskTier } from '../../types';

// Zod Schema for Recommendation Validation
export const RecommendationPlanSchema = z.object({
  scope: z.enum(['customer', 'segment', 'portfolio']),
  subject: z.string(),
  riskTier: z.enum(['Low', 'Medium', 'High', 'Critical']),
  churnProbability: z.number(),
  headline: z.string(),
  rootCauses: z.array(
    z.object({
      driver: z.string(),
      evidence: z.string(),
      shareOfRisk: z.number(),
    })
  ),
  actions: z.array(
    z.object({
      priority: z.enum(['P1', 'P2', 'P3']),
      title: z.string(),
      why: z.string(),
      channel: z.string(),
      offerGuidance: z.string(),
      steps: z.array(
        z.object({
          step: z.number(),
          description: z.string(),
          owner: z.string(),
          dueInDays: z.number(),
        })
      ),
      expectedImpact: z.object({
        churnReductionPoints: z.number(),
        revenueSavedGBP: z.number(),
        costGBP: z.number(),
        netBenefitGBP: z.number(),
        confidence: z.enum(['Low', 'Medium', 'High']),
        basis: z.string(),
      }),
      kpis: z.array(
        z.object({
          name: z.string(),
          baseline: z.string(),
          target: z.string(),
          measurement: z.string(),
          frequency: z.string(),
          reviewDate: z.string(),
        })
      ),
      risksAndDependencies: z.array(z.string()),
    })
  ),
  nextBestAction: z.string(),
  complianceNotes: z.array(z.string()),
  assumptions: z.array(z.string()),
});

/**
 * Builds deterministic Evidence Pack for a customer
 */
export function buildCustomerEvidencePack(
  customer: CleanedCustomerRecord,
  assumptions = { defaultSaveRate: 0.35, retentionMonths: 12, contactCost: 5, offerCost: 20 }
) {
  return {
    customerId: customer.customerId,
    riskTier: customer.predictedRiskTier || 'Medium',
    churnProbability: customer.calibratedProbability || 0.3,
    monthlyChargeGBP: customer.monthlyChargeGBP,
    lifetimeRevenueGBP: customer.lifetimeRevenueGBP,
    planName: customer.planName,
    serviceType: customer.serviceType,
    contractType: customer.contractType,
    daysToContractEnd: customer.daysToContractEnd,
    autoRenew: customer.autoRenew,
    usageRatio: Number((customer.usageRatio || 1).toFixed(2)),
    overageChargesGBP: customer.overageChargesGBP,
    complaints12M: customer.complaints12M,
    supportTickets12M: customer.supportTickets12M,
    averageResolutionHours: customer.averageResolutionHours,
    networkOutages12M: customer.networkOutages12M,
    satisfactionScore: customer.satisfactionScore,
    npsCategory: customer.npsCategory,
    competitorOfferReceived: customer.competitorOfferReceived,
    paymentRiskScore: customer.paymentRiskScore,
    directDebit: customer.directDebit,
    topDrivers: customer.topDrivers || [],
    assumptions,
  };
}

/**
 * Deterministic Rule-Based Retention Plan Generator (Section 10 Step 2)
 * Acts as immediate fallback or standalone deterministic plan.
 */
export function generateDeterministicRetentionPlan(customer: CleanedCustomerRecord): RecommendationPlan {
  const prob = customer.calibratedProbability || 0.35;
  const tier = customer.predictedRiskTier || 'Medium';
  const charge = customer.monthlyChargeGBP;
  const actions: RecommendationPlan['actions'] = [];

  const addImpact = (saveRate: number, contactCost: number, offerCost: number, confidence: 'Low' | 'Medium' | 'High', basis: string) => {
    const churnRed = Number((prob * saveRate * 100).toFixed(1));
    const revSaved = Number((prob * saveRate * charge * 12).toFixed(2));
    const totalCost = contactCost + offerCost;
    const netBenefit = Number((revSaved - totalCost).toFixed(2));
    return {
      churnReductionPoints: churnRed,
      revenueSavedGBP: revSaved,
      costGBP: totalCost,
      netBenefitGBP: netBenefit,
      confidence,
      basis,
    };
  };

  // Rule 1: Contract ending soon & Auto Renew No
  if (customer.daysToContractEnd >= 0 && customer.daysToContractEnd <= 60 && customer.autoRenew === 'No') {
    actions.push({
      priority: 'P1',
      title: 'Proactive 12-Month Renewal Offer with Loyalty Discount',
      why: `Contract expires in ${customer.daysToContractEnd} days and Auto-Renew is disabled.`,
      channel: 'Outbound Call & SMS follow-up',
      offerGuidance: 'Offer 15% loyalty discount on 12-month extension or free speed upgrade.',
      steps: [
        { step: 1, description: 'Dedicated retention advisor dials customer with bespoke renewal proposal.', owner: 'Retention Team', dueInDays: 3 },
        { step: 2, description: 'Send digital confirmation SMS with direct click-to-accept renewal terms.', owner: 'CRM Automation', dueInDays: 4 },
      ],
      expectedImpact: addImpact(0.42, 4.5, 18, 'High', 'Historical contract renewal campaign evidence (n=540)'),
      kpis: [
        { name: 'Contract Term Renewal', baseline: 'Expired', target: '12 Month Term Signed', measurement: 'CRM Contract Status', frequency: 'Weekly', reviewDate: '2026-11-20' },
      ],
      risksAndDependencies: ['Customer may already be shopping comparison engines.'],
    });
  }

  // Rule 2: Month-to-Month High Value
  if (customer.contractType === 'Month-to-Month' && customer.monthlyChargeGBP >= 35) {
    actions.push({
      priority: actions.length === 0 ? 'P1' : 'P2',
      title: 'Incentivise Migration to Annual Term with Bill Credit',
      why: `Customer is rolling on month-to-month terms paying £${customer.monthlyChargeGBP}/mo, presenting ongoing churn exposure.`,
      channel: 'Email & In-App Notification',
      offerGuidance: '£25 bill credit on first invoice upon signing 12-month term.',
      steps: [
        { step: 1, description: 'Send personalised in-app VIP upgrade badge with £25 one-touch credit.', owner: 'Digital Product Team', dueInDays: 2 },
        { step: 2, description: 'Follow-up email detailing annual price stability guarantee.', owner: 'CRM Marketing', dueInDays: 5 },
      ],
      expectedImpact: addImpact(0.35, 1.5, 25, 'Medium', 'Peer benchmark for term conversion'),
      kpis: [
        { name: 'Migration to Term Contract', baseline: 'Month-to-Month', target: '12M Signed', measurement: 'Billing System Record', frequency: 'Bi-weekly', reviewDate: '2026-11-25' },
      ],
      risksAndDependencies: ['Customer may prefer monthly flexibility.'],
    });
  }

  // Rule 3: Network outages or complaints
  if (customer.complaints12M >= 1 || customer.networkOutages12M >= 1 || customer.satisfactionScore <= 4) {
    actions.push({
      priority: 'P1',
      title: 'Senior Case Recovery Service Call & Goodwill Compensation',
      why: `Customer experienced ${customer.complaints12M} complaint(s) and ${customer.networkOutages12M} network outage(s), driving satisfaction down to ${customer.satisfactionScore}/10.`,
      channel: 'Direct Outbound Senior Care Call',
      offerGuidance: '£15 broadband credit and router line health audit.',
      steps: [
        { step: 1, description: 'Senior Care Specialist reviews ticket logs and executes proactive line check.', owner: 'Network Operations', dueInDays: 1 },
        { step: 2, description: 'Personal phone call to apologise, credit £15, and confirm issue resolution.', owner: 'Customer Care Lead', dueInDays: 2 },
      ],
      expectedImpact: addImpact(0.38, 8.0, 15, 'High', 'Proactive service recovery campaign benchmark'),
      kpis: [
        { name: 'Post-Recovery CSAT', baseline: `${customer.satisfactionScore}/10`, target: '>= 8/10', measurement: 'SMS Feedback Pulse', frequency: 'Post-Call', reviewDate: '2026-11-15' },
      ],
      risksAndDependencies: ['Unresolved line fault causing recurring friction.'],
    });
  }

  // Fallback action if no specific triggers hit
  if (actions.length === 0) {
    actions.push({
      priority: 'P2',
      title: 'Proactive Account Health Check & Loyalty Appreciation',
      why: `General churn risk mitigation for customer with ${customer.tenureMonths} months tenure.`,
      channel: 'Email & SMS',
      offerGuidance: 'Free WiFi booster or extra data allowance for 3 months.',
      steps: [
        { step: 1, description: 'Dispatch customer loyalty token and plan review guide.', owner: 'CRM Marketing', dueInDays: 7 },
      ],
      expectedImpact: addImpact(0.25, 1.0, 5, 'Low', 'Default retention assumption'),
      kpis: [
        { name: 'Engagement Rate', baseline: '0%', target: '40% Click-through', measurement: 'Email Analytics', frequency: 'Monthly', reviewDate: '2026-11-30' },
      ],
      risksAndDependencies: ['Low customer open rate.'],
    });
  }

  return {
    scope: 'customer',
    subject: customer.customerId,
    riskTier: tier,
    churnProbability: prob,
    headline: `Customer ${customer.customerId} has an estimated ${(prob * 100).toFixed(1)}% churn probability putting £${(prob * charge).toFixed(2)}/month at risk.`,
    rootCauses: (customer.topDrivers || []).map((d) => ({
      driver: d.name,
      evidence: d.text,
      shareOfRisk: Math.abs(d.contribution),
    })),
    actions,
    nextBestAction: actions[0].title,
    complianceNotes: [
      'Ensure contact adheres to UK GDPR marketing consent rules.',
      'Check Ofcom contract notification guidelines before applying term modifications.',
    ],
    assumptions: [
      'Assumes 12-month retention horizon for all revenue projections.',
      'Save rates derived from BritConnect campaign benchmarks and default assumptions.',
    ],
    method: 'Rule-based Plan (Deterministic Fallback)',
    generatedAt: new Date().toISOString(),
    dataVersion: 'v1.0',
  };
}

/**
 * Client caller for AI Retention Recommendations with graceful fallback
 */
export async function requestCustomerRecommendation(
  customer: CleanedCustomerRecord,
  modelName: string = 'gemini-3.8-flash'
): Promise<RecommendationPlan> {
  const pack = buildCustomerEvidencePack(customer);

  try {
    const res = await fetch('/api/gemini/recommendations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ evidencePack: pack, model: modelName }),
    });

    if (!res.ok) {
      console.warn('Server recommendation endpoint returned error, using rule-based plan.');
      return generateDeterministicRetentionPlan(customer);
    }

    const json = await res.json();
    const validated = RecommendationPlanSchema.safeParse(json);

    if (!validated.success) {
      console.warn('Gemini recommendation JSON schema validation failed; using deterministic fallback:', validated.error);
      return generateDeterministicRetentionPlan(customer);
    }

    // Overwrite numbers with deterministic calculations to ensure 100% number integrity
    const basePlan = generateDeterministicRetentionPlan(customer);
    return {
      ...validated.data,
      scope: 'customer',
      subject: customer.customerId,
      churnProbability: customer.calibratedProbability || 0.35,
      riskTier: customer.predictedRiskTier || 'Medium',
      method: 'AI-Generated (Gemini)',
      generatedAt: new Date().toISOString(),
      dataVersion: 'v1.0',
      actions: validated.data.actions.map((act, i) => {
        const fallbackAct = basePlan.actions[i] || basePlan.actions[0];
        return {
          ...act,
          expectedImpact: fallbackAct.expectedImpact,
        };
      }),
    };
  } catch (err) {
    console.warn('Network or server error calling recommendations; using deterministic fallback:', err);
    return generateDeterministicRetentionPlan(customer);
  }
}
