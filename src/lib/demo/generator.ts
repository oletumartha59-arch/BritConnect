import { CustomerRecord } from '../../types';

// Seeded pseudorandom number generator for strictly reproducible demo data
class SeededRNG {
  private s: number;
  constructor(seed: number = 42) {
    this.s = seed % 2147483647;
    if (this.s <= 0) this.s += 2147483646;
  }
  next(): number {
    this.s = (this.s * 16807) % 2147483647;
    return (this.s - 1) / 2147483646;
  }
  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }
  choice<T>(arr: T[]): T {
    return arr[Math.floor(this.next() * arr.length)];
  }
  weightedChoice<T>(items: { item: T; weight: number }[]): T {
    const totalWeight = items.reduce((sum, i) => sum + i.weight, 0);
    let r = this.next() * totalWeight;
    for (const { item, weight } of items) {
      if (r < weight) return item;
      r -= weight;
    }
    return items[items.length - 1].item;
  }
}

const UK_NATIONS_CITIES: Record<string, string[]> = {
  England: ['London', 'Manchester', 'Birmingham', 'Leeds', 'Bristol', 'Newcastle', 'Sheffield', 'Liverpool', 'Nottingham', 'Southampton'],
  Scotland: ['Glasgow', 'Edinburgh', 'Aberdeen', 'Dundee', 'Inverness', 'Stirling', 'Perth'],
  Wales: ['Cardiff', 'Swansea', 'Newport', 'Wrexham', 'Bangor'],
  'Northern Ireland': ['Belfast', 'Derry', 'Lisburn', 'Newry', 'Armagh'],
};

const CHURN_REASONS = [
  'Competitor Price',
  'Poor Service/Outages',
  'Moved House',
  'Contract Ended',
  'Bill Shock/Overages',
  'Financial Hardship',
  'Relocation Outside UK',
];

const PLANS: Record<string, { name: string; allowance: number; basePrice: number }[]> = {
  'Broadband Only': [
    { name: 'Saver Broadband 35', allowance: 100, basePrice: 24.99 },
    { name: 'Standard Broadband 65', allowance: 250, basePrice: 29.99 },
  ],
  'Fibre Broadband': [
    { name: 'Fibre 150 Essential', allowance: 500, basePrice: 34.99 },
    { name: 'Ultra Fibre 500 Max', allowance: 1000, basePrice: 44.99 },
    { name: 'Gigabit Pro 900', allowance: 2000, basePrice: 54.99 },
  ],
  'Mobile Only': [
    { name: 'Mobile SIM 10GB', allowance: 10, basePrice: 12.0 },
    { name: 'Mobile Unlimited 5G', allowance: 999, basePrice: 24.0 },
    { name: 'Mobile Smart 30GB', allowance: 30, basePrice: 16.0 },
  ],
  'Triple-Play Bundle': [
    { name: 'Home & Mobile Complete', allowance: 600, basePrice: 52.0 },
    { name: 'Family Connect 250', allowance: 800, basePrice: 62.0 },
  ],
  'Quad-Play Bundle': [
    { name: 'Ultimate Total Home 900', allowance: 2500, basePrice: 85.0 },
    { name: 'Premier Business Bundle', allowance: 3000, basePrice: 110.0 },
  ],
};

export function generateDemoCustomers(
  count: number = 5000,
  options: { isMessy?: boolean; seed?: number } = {}
): CustomerRecord[] {
  const rng = new SeededRNG(options.seed || 12345);
  const isMessy = !!options.isMessy;
  const customers: CustomerRecord[] = [];

  const snapshotDate = new Date('2026-11-01');

  for (let i = 1; i <= count; i++) {
    const rawId = `BC-${String(i).padStart(6, '0')}`;
    const customerId = isMessy && rng.next() < 0.03 ? (rng.next() < 0.5 ? `  ${rawId}  ` : rawId.toLowerCase()) : rawId;

    const segment = rng.weightedChoice([
      { item: 'Consumer', weight: 0.8 },
      { item: 'Small Business', weight: 0.2 },
    ]) as 'Consumer' | 'Small Business';

    const age = Math.round(rng.range(18, 85));
    let ageBand = '35-49';
    if (age < 25) ageBand = '18-24';
    else if (age < 35) ageBand = '25-34';
    else if (age < 50) ageBand = '35-49';
    else if (age < 65) ageBand = '50-64';
    else ageBand = '65+';

    const gender = rng.weightedChoice([
      { item: 'Female', weight: 0.49 },
      { item: 'Male', weight: 0.48 },
      { item: 'Non-binary', weight: 0.02 },
      { item: 'Prefer not to say', weight: 0.01 },
    ]);

    const ukNation = rng.weightedChoice([
      { item: 'England', weight: 0.84 },
      { item: 'Scotland', weight: 0.08 },
      { item: 'Wales', weight: 0.05 },
      { item: 'Northern Ireland', weight: 0.03 },
    ]);

    const city = rng.choice(UK_NATIONS_CITIES[ukNation]);

    const acquisitionChannel = rng.weightedChoice([
      { item: 'Direct Online', weight: 0.45 },
      { item: 'Retail Store', weight: 0.22 },
      { item: 'Aggregator/Comparison', weight: 0.18 },
      { item: 'Telesales', weight: 0.1 },
      { item: 'Partner Referral', weight: 0.05 },
    ]);

    // Tenure: 1 to 60 months
    const tenureMonths = Math.max(1, Math.round(rng.range(1, 60)));
    const joinDateObj = new Date(snapshotDate);
    joinDateObj.setMonth(joinDateObj.getMonth() - tenureMonths);
    const joinDate = joinDateObj.toISOString().split('T')[0];

    const serviceType = rng.weightedChoice([
      { item: 'Fibre Broadband', weight: 0.42 },
      { item: 'Mobile Only', weight: 0.25 },
      { item: 'Broadband Only', weight: 0.15 },
      { item: 'Triple-Play Bundle', weight: 0.12 },
      { item: 'Quad-Play Bundle', weight: 0.06 },
    ]);

    const planObj = rng.choice(PLANS[serviceType]);
    const planName = planObj.name;
    const dataAllowanceGB = planObj.allowance;

    const contractType = rng.weightedChoice([
      { item: 'Month-to-Month', weight: 0.32 },
      { item: '12 Month Term', weight: 0.38 },
      { item: '24 Month Term', weight: 0.3 },
    ]);

    const contractDurationMonths = contractType === 'Month-to-Month' ? 1 : contractType === '12 Month Term' ? 12 : 24;
    const contractStartDateObj = new Date(joinDateObj);
    const contractEndDateObj = new Date(contractStartDateObj);
    contractEndDateObj.setMonth(contractEndDateObj.getMonth() + contractDurationMonths);

    const contractStartDate = contractStartDateObj.toISOString().split('T')[0];
    const contractEndDate = contractEndDateObj.toISOString().split('T')[0];

    const autoRenew: 'Yes' | 'No' = contractType === 'Month-to-Month' ? 'Yes' : rng.next() < 0.65 ? 'Yes' : 'No';

    const discountPercent = rng.weightedChoice([
      { item: 0, weight: 0.55 },
      { item: 10, weight: 0.2 },
      { item: 15, weight: 0.15 },
      { item: 25, weight: 0.1 },
    ]);

    const monthlyChargeGBP = Number((planObj.basePrice * (1 - discountPercent / 100) * (segment === 'Small Business' ? 1.25 : 1.0)).toFixed(2));

    const isHeavyUser = rng.next() < 0.2;
    const averageMonthlyUsageGB = Number((dataAllowanceGB * (isHeavyUser ? rng.range(0.85, 1.4) : rng.range(0.3, 0.85))).toFixed(1));
    const overageChargesGBP = averageMonthlyUsageGB > dataAllowanceGB ? Number(((averageMonthlyUsageGB - dataAllowanceGB) * 2.5).toFixed(2)) : 0;

    const directDebit: 'Yes' | 'No' = rng.next() < 0.82 ? 'Yes' : 'No';
    const paymentMethod = directDebit === 'Yes' ? 'Direct Debit' : rng.choice(['Credit Card', 'Debit Card', 'Bank Transfer']);

    const latePayments12M = rng.weightedChoice([
      { item: 0, weight: 0.82 },
      { item: 1, weight: 0.11 },
      { item: 2, weight: 0.05 },
      { item: 3, weight: 0.02 },
    ]);
    const failedPayments12M = latePayments12M > 0 ? (rng.next() < 0.4 ? 1 : 0) : 0;

    const complaints12M = rng.weightedChoice([
      { item: 0, weight: 0.72 },
      { item: 1, weight: 0.18 },
      { item: 2, weight: 0.07 },
      { item: 3, weight: 0.03 },
    ]);
    const supportTickets12M = complaints12M + Math.round(rng.range(0, 4));
    const averageResolutionHours = Number((complaints12M > 1 ? rng.range(24, 72) : rng.range(2, 18)).toFixed(1));

    const networkOutages12M = rng.weightedChoice([
      { item: 0, weight: 0.7 },
      { item: 1, weight: 0.2 },
      { item: 2, weight: 0.07 },
      { item: 3, weight: 0.03 },
    ]);

    // Service pain and satisfaction
    let satisfactionScore = Math.round(rng.range(6, 10));
    if (complaints12M >= 2 || networkOutages12M >= 2 || overageChargesGBP > 15) {
      satisfactionScore = Math.round(rng.range(1, 5));
    }
    satisfactionScore = Math.min(10, Math.max(1, satisfactionScore));

    const npsScore = satisfactionScore <= 4 ? Math.round(rng.range(0, 5)) : satisfactionScore <= 7 ? Math.round(rng.range(6, 8)) : Math.round(rng.range(9, 10));

    const competitorOfferReceived: 'Yes' | 'No' = rng.next() < 0.28 ? 'Yes' : 'No';

    // Latent Churn Propensity Calculation
    // Realistic weights aligned with telecommunications literature
    let logit = -2.1; // Baseline ~20% churn rate
    if (contractType === 'Month-to-Month') logit += 1.1;
    if (autoRenew === 'No') logit += 0.55;
    if (competitorOfferReceived === 'Yes') logit += 0.85;
    if (contractType === 'Month-to-Month' && competitorOfferReceived === 'Yes') logit += 0.6;
    if (complaints12M >= 2) logit += 0.9;
    if (networkOutages12M >= 2) logit += 0.65;
    if (averageResolutionHours > 36) logit += 0.4;
    if (overageChargesGBP > 10) logit += 0.5;
    if (satisfactionScore <= 4) logit += 1.2;
    if (tenureMonths <= 6) logit += 0.5;
    if (tenureMonths >= 36) logit -= 0.6;
    if (directDebit === 'Yes') logit -= 0.35;
    if (latePayments12M >= 2) logit += 0.7;

    const prob = 1 / (1 + Math.exp(-logit));
    const isChurned = rng.next() < prob;

    const churnFlag: 0 | 1 = isChurned ? 1 : 0;
    const churnStatus = isChurned ? 'Churned' : 'Active';

    let churnDate: string | undefined = undefined;
    let churnReason: string | undefined = undefined;

    if (isChurned) {
      const churnDateObj = new Date(snapshotDate);
      churnDateObj.setDate(churnDateObj.getDate() - Math.round(rng.range(1, 180)));
      churnDate = churnDateObj.toISOString().split('T')[0];

      if (competitorOfferReceived === 'Yes' && rng.next() < 0.6) churnReason = 'Competitor Price';
      else if (complaints12M > 1 || networkOutages12M > 1) churnReason = 'Poor Service/Outages';
      else if (overageChargesGBP > 10) churnReason = 'Bill Shock/Overages';
      else churnReason = rng.choice(CHURN_REASONS);
    }

    const lifetimeRevenueGBP = Number((monthlyChargeGBP * tenureMonths).toFixed(2));
    const monthlyRevenueAtRiskGBP = Number((isChurned ? 0 : monthlyChargeGBP * prob).toFixed(2));

    // Plant messy data if requested
    let finalAge = age;
    let finalSat = satisfactionScore;
    let finalDiscount = discountPercent;

    if (isMessy && rng.next() < 0.02) {
      finalAge = 145; // planted invalid age
    }
    if (isMessy && rng.next() < 0.02) {
      finalSat = 15; // planted invalid satisfaction
    }
    if (isMessy && rng.next() < 0.02) {
      finalDiscount = 120; // planted invalid discount
    }

    customers.push({
      customerId,
      customerSegment: segment,
      age: finalAge,
      ageBand,
      gender,
      ukNation,
      city,
      acquisitionChannel,
      joinDate,
      tenureMonths,
      serviceType,
      planName,
      contractType,
      contractStartDate,
      contractEndDate,
      autoRenew,
      monthlyChargeGBP,
      averageMonthlyUsageGB,
      dataAllowanceGB,
      overageChargesGBP,
      discountPercent: finalDiscount,
      paymentMethod,
      directDebit,
      latePayments12M,
      failedPayments12M,
      supportTickets12M,
      complaints12M,
      averageResolutionHours,
      networkOutages12M,
      satisfactionScore: finalSat,
      npsScore,
      competitorOfferReceived,
      churnStatus,
      churnDate,
      churnReason,
      lifetimeRevenueGBP,
      monthlyRevenueAtRiskGBP,
      churnFlag,
    });
  }

  // Plant exact duplicates for messy demo
  if (isMessy && count > 50) {
    customers.push({ ...customers[0] });
    customers.push({ ...customers[1] });
  }

  return customers;
}
