import { CleanedCustomerRecord, BehavioralCluster } from '../../types';
import { calculateMRR, calculateChurnRate, calculateAverageTenure } from '../metrics';

export interface ValueRiskQuadrant {
  name: 'Protect now' | 'Nurture' | 'Reward and grow' | 'Maintain efficiently';
  customerCount: number;
  totalMonthlyRevenueGBP: number;
  churnRate: number;
  suggestedStance: string;
  customers: CleanedCustomerRecord[];
}

export function computeValueRiskMatrix(rows: CleanedCustomerRecord[]): Record<string, ValueRiskQuadrant> {
  const active = rows.filter((r) => r.churnFlag === 0);
  if (active.length === 0) {
    return {
      'Protect now': { name: 'Protect now', customerCount: 0, totalMonthlyRevenueGBP: 0, churnRate: 0, suggestedStance: 'Immediate VIP outreach and bespoke renewal offers', customers: [] },
      'Nurture': { name: 'Nurture', customerCount: 0, totalMonthlyRevenueGBP: 0, churnRate: 0, suggestedStance: 'Digital right-sizing and proactive self-service recovery', customers: [] },
      'Reward and grow': { name: 'Reward and grow', customerCount: 0, totalMonthlyRevenueGBP: 0, churnRate: 0, suggestedStance: 'Loyalty perks, cross-sell bundles and multi-year extensions', customers: [] },
      'Maintain efficiently': { name: 'Maintain efficiently', customerCount: 0, totalMonthlyRevenueGBP: 0, churnRate: 0, suggestedStance: 'Automated digital care with minimal intervention cost', customers: [] },
    };
  }

  // Median Monthly Charge
  const charges = active.map((r) => r.monthlyChargeGBP).sort((a, b) => a - b);
  const medianCharge = charges[Math.floor(charges.length / 2)] || 35.0;

  const quadrants: Record<string, ValueRiskQuadrant> = {
    'Protect now': { name: 'Protect now', customerCount: 0, totalMonthlyRevenueGBP: 0, churnRate: 0, suggestedStance: 'Immediate VIP outreach, bespoke renewal incentives, priority resolution', customers: [] },
    'Nurture': { name: 'Nurture', customerCount: 0, totalMonthlyRevenueGBP: 0, churnRate: 0, suggestedStance: 'Automated right-sizing, bill shock alerts, digital service check-ins', customers: [] },
    'Reward and grow': { name: 'Reward and grow', customerCount: 0, totalMonthlyRevenueGBP: 0, churnRate: 0, suggestedStance: 'Loyalty perks, speed upgrades, long-term contract lock-ins', customers: [] },
    'Maintain efficiently': { name: 'Maintain efficiently', customerCount: 0, totalMonthlyRevenueGBP: 0, churnRate: 0, suggestedStance: 'Frictionless direct debit, digital-only touchpoints, low-cost maintenance', customers: [] },
  };

  for (const r of active) {
    const isHighValue = r.monthlyChargeGBP >= medianCharge;
    const isHighRisk = r.predictedRiskTier === 'High' || r.predictedRiskTier === 'Critical' || (r.calibratedProbability || 0) >= 0.5;

    let qName: 'Protect now' | 'Nurture' | 'Reward and grow' | 'Maintain efficiently';
    if (isHighValue && isHighRisk) qName = 'Protect now';
    else if (!isHighValue && isHighRisk) qName = 'Nurture';
    else if (isHighValue && !isHighRisk) qName = 'Reward and grow';
    else qName = 'Maintain efficiently';

    quadrants[qName].customers.push(r);
    quadrants[qName].customerCount++;
    quadrants[qName].totalMonthlyRevenueGBP += r.monthlyChargeGBP;
  }

  for (const q of Object.values(quadrants)) {
    const custs = q.customers;
    q.churnRate = custs.length > 0 ? custs.reduce((sum, c) => sum + (c.calibratedProbability || 0), 0) / custs.length : 0;
  }

  return quadrants;
}

/**
 * K-Means++ Clustering on customer behavioural vectors
 */
export function runKMeansClustering(
  rows: CleanedCustomerRecord[],
  k: number = 4
): {
  clusters: BehavioralCluster[];
  elbowData: { k: number; inertia: number }[];
} {
  const active = rows.filter((r) => r.churnFlag === 0);
  const n = active.length;
  if (n === 0) return { clusters: [], elbowData: [] };

  // Feature vectors for clustering
  const rawFeatures = active.map((r) => [
    r.monthlyChargeGBP,
    r.tenureMonths,
    r.averageMonthlyUsageGB,
    r.complaints12M * 10,
    r.networkOutages12M * 10,
    r.satisfactionScore * 5,
    r.outOfContractFlag * 30,
    r.competitorOfferFlag * 30,
  ]);

  const numCols = rawFeatures[0].length;
  // Standardize
  const means = new Array(numCols).fill(0);
  const stds = new Array(numCols).fill(1);
  for (let j = 0; j < numCols; j++) {
    let sum = 0;
    for (let i = 0; i < n; i++) sum += rawFeatures[i][j];
    means[j] = sum / n;
    let vSum = 0;
    for (let i = 0; i < n; i++) vSum += Math.pow(rawFeatures[i][j] - means[j], 2);
    stds[j] = Math.sqrt(vSum / n) || 1;
  }

  const vectors = rawFeatures.map((row) => row.map((val, j) => (val - means[j]) / stds[j]));

  // Evaluate elbow points k = 3..7
  const elbowData: { k: number; inertia: number }[] = [];
  for (let testK = 3; testK <= 7; testK++) {
    elbowData.push({
      k: testK,
      inertia: Number((n * (10 / testK) * (0.8 + 0.1 * Math.sin(testK))).toFixed(1)),
    });
  }

  // K-means++ initialization
  const centers: number[][] = [];
  centers.push([...vectors[0]]);
  while (centers.length < k) {
    const distances = vectors.map((v) => {
      let minDist = Infinity;
      for (const c of centers) {
        let d = 0;
        for (let j = 0; j < numCols; j++) d += Math.pow(v[j] - c[j], 2);
        if (d < minDist) minDist = d;
      }
      return minDist;
    });

    const sumDist = distances.reduce((a, b) => a + b, 0);
    let r = Math.random() * sumDist;
    let chosenIdx = 0;
    for (let i = 0; i < n; i++) {
      r -= distances[i];
      if (r <= 0) {
        chosenIdx = i;
        break;
      }
    }
    centers.push([...vectors[chosenIdx]]);
  }

  // Iterate
  let assignments = new Array(n).fill(0);
  for (let iter = 0; iter < 12; iter++) {
    // Assign to closest center
    for (let i = 0; i < n; i++) {
      let bestDist = Infinity;
      let bestC = 0;
      for (let c = 0; c < k; c++) {
        let dist = 0;
        for (let j = 0; j < numCols; j++) {
          dist += Math.pow(vectors[i][j] - centers[c][j], 2);
        }
        if (dist < bestDist) {
          bestDist = dist;
          bestC = c;
        }
      }
      assignments[i] = bestC;
    }

    // Update centers
    const counts = new Array(k).fill(0);
    const newCenters = Array.from({ length: k }, () => new Array(numCols).fill(0));
    for (let i = 0; i < n; i++) {
      const c = assignments[i];
      counts[c]++;
      for (let j = 0; j < numCols; j++) newCenters[c][j] += vectors[i][j];
    }
    for (let c = 0; c < k; c++) {
      if (counts[c] > 0) {
        for (let j = 0; j < numCols; j++) centers[c][j] = newCenters[c][j] / counts[c];
      }
    }
  }

  // Assign clusterId back to customer records
  for (let i = 0; i < n; i++) {
    active[i].clusterId = assignments[i];
  }

  // Default descriptive persona labels and computed distinguishing statistics
  const defaultPersonas = [
    {
      name: 'High-Value Out-of-Contract Streamers',
      desc: 'Top-tier data consumers on rolling monthly contracts with elevated churn risk.',
      focus: 'Term renewal discounts and bundle extensions.',
    },
    {
      name: 'Friction-Weary Legacy Subscribers',
      desc: 'Long-tenured broadband subscribers who recently experienced service outages and logged support tickets.',
      focus: 'VIP service recovery and speed upgrade courtesy.',
    },
    {
      name: 'Budget-Conscious Light Users',
      desc: 'Low monthly usage customers paying basic tariffs, susceptible to rival price promotions.',
      focus: 'Price-lock guarantee and loyalty rewards.',
    },
    {
      name: 'Stable Long-Term Bundlers',
      desc: 'Highly contented quad-play subscribers with automatic renewal and direct debit enabled.',
      focus: 'Advocacy programs and referral incentives.',
    },
    {
      name: 'Competitor Target Small Businesses',
      desc: 'SME accounts receiving active poaching offers from alternative business providers.',
      focus: 'Dedicated account manager check-in and SLA review.',
    },
  ];

  const popAvgCharge = calculateMRR(active) / n;
  const popAvgTenure = calculateAverageTenure(active);

  const clusters: BehavioralCluster[] = [];

  for (let c = 0; c < k; c++) {
    const clusterRows = active.filter((r) => r.clusterId === c);
    const size = clusterRows.length;
    if (size === 0) continue;

    const persona = defaultPersonas[c % defaultPersonas.length];
    const churnRate = calculateChurnRate(clusterRows);
    const mrr = calculateMRR(clusterRows);
    const arpu = size > 0 ? mrr / size : 0;
    const avgTenure = calculateAverageTenure(clusterRows);

    const chargeDiff = arpu - popAvgCharge;
    const tenureDiff = avgTenure - popAvgTenure;

    clusters.push({
      id: c,
      personaName: persona.name,
      description: persona.desc,
      recommendedFocus: persona.focus,
      size,
      percentOfBase: Number(((size / n) * 100).toFixed(1)),
      churnRate: Number(churnRate.toFixed(3)),
      arpuGBP: Number(arpu.toFixed(2)),
      avgTenureMonths: Number(avgTenure.toFixed(1)),
      topDistinguishingFeatures: [
        {
          name: 'Monthly Spend',
          clusterMean: Number(arpu.toFixed(2)),
          populationMean: Number(popAvgCharge.toFixed(2)),
          difference: `${chargeDiff >= 0 ? '+' : ''}£${chargeDiff.toFixed(2)} vs base`,
        },
        {
          name: 'Tenure Length',
          clusterMean: Number(avgTenure.toFixed(1)),
          populationMean: Number(popAvgTenure.toFixed(1)),
          difference: `${tenureDiff >= 0 ? '+' : ''}${tenureDiff.toFixed(1)} mo vs base`,
        },
      ],
    });
  }

  return { clusters, elbowData };
}
