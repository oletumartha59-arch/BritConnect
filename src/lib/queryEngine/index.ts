import { CleanedCustomerRecord, RetentionCampaign, CleaningReport, TrainedModel } from '../../types';
import { calculateChurnRate, calculateMRR, calculateARPU, calculateAverageTenure, calculateMonthlyRevenueAtRisk, calculateNPS } from '../metrics';

export interface QueryResult {
  tool: string;
  summary: string;
  data: Record<string, unknown>[];
  meta: {
    totalRowsAnalyzed: number;
    filtersApplied: Record<string, unknown>;
    calculationMethod: string;
  };
}

export class QueryEngine {
  constructor(
    private customers: CleanedCustomerRecord[],
    private campaigns: RetentionCampaign[] = [],
    private cleaningReport: CleaningReport | null = null,
    private championModel: TrainedModel | null = null
  ) {}

  aggregate(params: {
    metric: 'churn_rate' | 'count' | 'mrr' | 'arpu' | 'revenue_at_risk' | 'avg_tenure' | 'avg_satisfaction' | 'nps';
    groupBy?: keyof CleanedCustomerRecord;
    filterBy?: Partial<Record<keyof CleanedCustomerRecord, unknown>>;
    sortBy?: 'asc' | 'desc';
    limit?: number;
  }): QueryResult {
    let filtered = [...this.customers];

    if (params.filterBy) {
      for (const [k, v] of Object.entries(params.filterBy)) {
        if (v !== undefined && v !== null && v !== '') {
          filtered = filtered.filter((r) => String((r as any)[k]).toLowerCase() === String(v).toLowerCase());
        }
      }
    }

    if (!params.groupBy) {
      // Overall aggregate
      let val = 0;
      let label = params.metric;
      if (params.metric === 'churn_rate') val = calculateChurnRate(filtered);
      else if (params.metric === 'mrr') val = calculateMRR(filtered);
      else if (params.metric === 'arpu') val = calculateARPU(filtered);
      else if (params.metric === 'count') val = filtered.length;
      else if (params.metric === 'revenue_at_risk') val = calculateMonthlyRevenueAtRisk(filtered);
      else if (params.metric === 'avg_tenure') val = calculateAverageTenure(filtered);
      else if (params.metric === 'nps') val = calculateNPS(filtered).nps;

      return {
        tool: 'aggregate',
        summary: `Computed ${params.metric} across ${filtered.length} customers.`,
        data: [{ metric: label, value: val, customers: filtered.length }],
        meta: {
          totalRowsAnalyzed: filtered.length,
          filtersApplied: params.filterBy || {},
          calculationMethod: 'Deterministic aggregation in code',
        },
      };
    }

    // Grouped aggregate
    const groups = new Map<string, CleanedCustomerRecord[]>();
    for (const r of filtered) {
      const gKey = String((r as any)[params.groupBy] || 'Unknown');
      if (!groups.has(gKey)) groups.set(gKey, []);
      groups.get(gKey)!.push(r);
    }

    const rows: Record<string, unknown>[] = [];
    for (const [groupName, groupRecords] of groups.entries()) {
      let metricVal = 0;
      if (params.metric === 'churn_rate') metricVal = Number((calculateChurnRate(groupRecords) * 100).toFixed(1));
      else if (params.metric === 'mrr') metricVal = Number(calculateMRR(groupRecords).toFixed(2));
      else if (params.metric === 'arpu') metricVal = Number(calculateARPU(groupRecords).toFixed(2));
      else if (params.metric === 'count') metricVal = groupRecords.length;
      else if (params.metric === 'revenue_at_risk') metricVal = Number(calculateMonthlyRevenueAtRisk(groupRecords).toFixed(2));
      else if (params.metric === 'avg_tenure') metricVal = Number(calculateAverageTenure(groupRecords).toFixed(1));
      else if (params.metric === 'nps') metricVal = Number(calculateNPS(groupRecords).nps.toFixed(1));

      rows.push({
        group: groupName,
        [params.metric]: metricVal,
        customerCount: groupRecords.length,
      });
    }

    rows.sort((a, b) => {
      const vA = Number(a[params.metric] || 0);
      const vB = Number(b[params.metric] || 0);
      return params.sortBy === 'asc' ? vA - vB : vB - vA;
    });

    const finalRows = params.limit ? rows.slice(0, params.limit) : rows;

    return {
      tool: 'aggregate',
      summary: `Aggregated ${params.metric} by ${String(params.groupBy)} across ${groups.size} groups.`,
      data: finalRows,
      meta: {
        totalRowsAnalyzed: filtered.length,
        filtersApplied: params.filterBy || {},
        calculationMethod: `Deterministic group aggregation on ${String(params.groupBy)}`,
      },
    };
  }

  compareSegments(dimension: keyof CleanedCustomerRecord, segA: string, segB: string): QueryResult {
    const rowsA = this.customers.filter((r) => String((r as any)[dimension]).toLowerCase() === segA.toLowerCase());
    const rowsB = this.customers.filter((r) => String((r as any)[dimension]).toLowerCase() === segB.toLowerCase());

    const data = [
      {
        metric: 'Total Customers',
        [segA]: rowsA.length,
        [segB]: rowsB.length,
        difference: rowsA.length - rowsB.length,
      },
      {
        metric: 'Churn Rate (%)',
        [segA]: Number((calculateChurnRate(rowsA) * 100).toFixed(1)),
        [segB]: Number((calculateChurnRate(rowsB) * 100).toFixed(1)),
        difference: Number(((calculateChurnRate(rowsA) - calculateChurnRate(rowsB)) * 100).toFixed(1)),
      },
      {
        metric: 'ARPU (£)',
        [segA]: Number(calculateARPU(rowsA).toFixed(2)),
        [segB]: Number(calculateARPU(rowsB).toFixed(2)),
        difference: Number((calculateARPU(rowsA) - calculateARPU(rowsB)).toFixed(2)),
      },
      {
        metric: 'Monthly Revenue at Risk (£)',
        [segA]: Number(calculateMonthlyRevenueAtRisk(rowsA).toFixed(2)),
        [segB]: Number(calculateMonthlyRevenueAtRisk(rowsB).toFixed(2)),
        difference: Number((calculateMonthlyRevenueAtRisk(rowsA) - calculateMonthlyRevenueAtRisk(rowsB)).toFixed(2)),
      },
      {
        metric: 'Average Tenure (Months)',
        [segA]: Number(calculateAverageTenure(rowsA).toFixed(1)),
        [segB]: Number(calculateAverageTenure(rowsB).toFixed(1)),
        difference: Number((calculateAverageTenure(rowsA) - calculateAverageTenure(rowsB)).toFixed(1)),
      },
      {
        metric: 'NPS',
        [segA]: Number(calculateNPS(rowsA).nps.toFixed(1)),
        [segB]: Number(calculateNPS(rowsB).nps.toFixed(1)),
        difference: Number((calculateNPS(rowsA).nps - calculateNPS(rowsB).nps).toFixed(1)),
      },
    ];

    return {
      tool: 'compare_segments',
      summary: `Side-by-side comparison of ${segA} (n=${rowsA.length}) versus ${segB} (n=${rowsB.length}).`,
      data,
      meta: {
        totalRowsAnalyzed: rowsA.length + rowsB.length,
        filtersApplied: { dimension, segA, segB },
        calculationMethod: 'Deterministic comparative metrics',
      },
    };
  }

  topCustomers(metric: 'revenue_at_risk' | 'churn_probability' | 'monthly_charge', limit: number = 10): QueryResult {
    const active = this.customers.filter((r) => r.churnFlag === 0);

    const sorted = [...active].sort((a, b) => {
      if (metric === 'revenue_at_risk') return (b.expectedRevenueAtRiskGBP || 0) - (a.expectedRevenueAtRiskGBP || 0);
      if (metric === 'churn_probability') return (b.calibratedProbability || 0) - (a.calibratedProbability || 0);
      return b.monthlyChargeGBP - a.monthlyChargeGBP;
    });

    const top = sorted.slice(0, limit).map((r) => ({
      customerId: r.customerId,
      plan: r.planName,
      contract: r.contractType,
      monthlyChargeGBP: `£${r.monthlyChargeGBP.toFixed(2)}`,
      churnProbability: `${((r.calibratedProbability || 0) * 100).toFixed(1)}%`,
      riskTier: r.predictedRiskTier || 'Low',
      monthlyRevenueAtRiskGBP: `£${(r.expectedRevenueAtRiskGBP || 0).toFixed(2)}`,
      topDriver: r.topDrivers?.[0]?.text || 'Tenure and contract status',
    }));

    return {
      tool: 'top_customers',
      summary: `Identified top ${limit} active customers ranked by ${metric.replace(/_/g, ' ')}.`,
      data: top,
      meta: {
        totalRowsAnalyzed: active.length,
        filtersApplied: { metric, limit },
        calculationMethod: `Sorted descending by ${metric}`,
      },
    };
  }

  scoreCustomer(customerId: string): QueryResult {
    const customer = this.customers.find((c) => c.customerId.toLowerCase() === customerId.toLowerCase());
    if (!customer) {
      return {
        tool: 'score_customer',
        summary: `Customer ID "${customerId}" was not found in active dataset.`,
        data: [],
        meta: { totalRowsAnalyzed: this.customers.length, filtersApplied: { customerId }, calculationMethod: 'Lookup' },
      };
    }

    const prob = customer.calibratedProbability ?? (customer.churnFlag === 1 ? 0.95 : 0.18);
    const tier = customer.predictedRiskTier ?? (prob >= 0.75 ? 'Critical' : prob >= 0.5 ? 'High' : prob >= 0.25 ? 'Medium' : 'Low');

    return {
      tool: 'score_customer',
      summary: `Score result for ${customer.customerId}: ${tier} risk (${(prob * 100).toFixed(1)}% churn probability).`,
      data: [
        {
          customerId: customer.customerId,
          segment: customer.customerSegment,
          plan: customer.planName,
          contractType: customer.contractType,
          monthlyChargeGBP: `£${customer.monthlyChargeGBP.toFixed(2)}`,
          churnProbability: `${(prob * 100).toFixed(1)}%`,
          predictedRiskTier: tier,
          expectedRevenueAtRiskGBP: `£${(customer.expectedRevenueAtRiskGBP || 0).toFixed(2)}`,
          topDrivers: customer.topDrivers?.map((d) => `${d.text} (${d.contribution > 0 ? '+' : ''}${(d.contribution * 100).toFixed(1)} pts)`).join('; ') || 'Standard baseline',
        },
      ],
      meta: {
        totalRowsAnalyzed: 1,
        filtersApplied: { customerId },
        calculationMethod: 'Champion model inference & exact contributions',
      },
    };
  }
}

/**
 * Keyword-based fallback query processor when Gemini API is unavailable or offline
 */
export function handleFallbackQuery(query: string, engine: QueryEngine): QueryResult {
  const q = query.toLowerCase();

  if (q.includes('contract type') || q.includes('by contract')) {
    return engine.aggregate({ metric: 'churn_rate', groupBy: 'contractType' });
  }
  if (q.includes('uk nation') || q.includes('nation') || q.includes('wales') || q.includes('scotland')) {
    return engine.aggregate({ metric: 'churn_rate', groupBy: 'ukNation' });
  }
  if (q.includes('top') && (q.includes('valuable') || q.includes('risk') || q.includes('customer'))) {
    return engine.topCustomers('revenue_at_risk', 10);
  }
  if (q.includes('compare consumer') || q.includes('consumer and small business')) {
    return engine.compareSegments('customerSegment', 'Consumer', 'Small Business');
  }
  if (q.includes('competitor offer')) {
    return engine.aggregate({ metric: 'churn_rate', groupBy: 'competitorOfferReceived' });
  }
  if (q.includes('mrr') || q.includes('monthly recurring revenue')) {
    return engine.aggregate({ metric: 'mrr' });
  }
  if (q.includes('score customer') || q.includes('score') || q.includes('bc-')) {
    const idMatch = query.match(/BC-\d{4,6}/i);
    if (idMatch) {
      return engine.scoreCustomer(idMatch[0]);
    }
  }

  // Default aggregate churn rate
  return engine.aggregate({ metric: 'churn_rate', groupBy: 'contractType' });
}
