import Papa from 'papaparse';
import * as XLSX from 'xlsx';

export interface ColumnMappingConfidence {
  uploadedHeader: string;
  mappedField: string | null;
  confidence: number; // 0 to 1
  autoMatched: boolean;
}

export const SCHEMA_DEFINITIONS: { field: string; label: string; aliases: string[]; required?: boolean; type: string }[] = [
  { field: 'customerId', label: 'Customer ID', aliases: ['cust_id', 'customer_id', 'id', 'account_id', 'subscriber_id', 'client_id'], required: true, type: 'Text' },
  { field: 'customerSegment', label: 'Customer Segment', aliases: ['segment', 'customer_type', 'account_type', 'tier'], type: 'Text' },
  { field: 'age', label: 'Age', aliases: ['customer_age', 'user_age'], type: 'Whole number' },
  { field: 'ageBand', label: 'Age Band', aliases: ['age_group', 'age_bracket', 'demographic_band'], type: 'Text' },
  { field: 'gender', label: 'Gender', aliases: ['sex'], type: 'Text' },
  { field: 'ukNation', label: 'UK Nation', aliases: ['nation', 'country', 'region', 'uk_region', 'constituent_nation'], type: 'Text' },
  { field: 'city', label: 'City', aliases: ['town', 'location', 'city_name'], type: 'Text' },
  { field: 'acquisitionChannel', label: 'Acquisition Channel', aliases: ['channel', 'source', 'acquisition_source', 'signup_channel'], type: 'Text' },
  { field: 'joinDate', label: 'Join Date', aliases: ['start_date', 'joined_date', 'signup_date', 'created_date', 'registration_date'], type: 'Date' },
  { field: 'tenureMonths', label: 'Tenure Months', aliases: ['tenure', 'months_active', 'customer_tenure', 'tenure_in_months'], type: 'Whole number' },
  { field: 'serviceType', label: 'Service Type', aliases: ['service', 'product_type', 'service_category', 'subscription_type'], type: 'Text' },
  { field: 'planName', label: 'Plan Name', aliases: ['plan', 'package', 'package_name', 'tariff', 'tariff_name'], type: 'Text' },
  { field: 'contractType', label: 'Contract Type', aliases: ['contract', 'term_type', 'agreement_type', 'contract_length'], type: 'Text' },
  { field: 'contractStartDate', label: 'Contract Start Date', aliases: ['contract_start', 'agreement_start'], type: 'Date' },
  { field: 'contractEndDate', label: 'Contract End Date', aliases: ['contract_end', 'agreement_end', 'contract_expiry', 'expiry_date'], type: 'Date' },
  { field: 'autoRenew', label: 'Auto Renew', aliases: ['autorenew', 'auto_renewal', 'recurring_contract'], type: 'Text' },
  { field: 'monthlyChargeGBP', label: 'Monthly Charge GBP', aliases: ['monthly_charge', 'monthly_fee', 'mrr', 'monthly_spend', 'bill_amount', 'monthlycharge', 'monthly_cost'], type: 'Decimal' },
  { field: 'averageMonthlyUsageGB', label: 'Average Monthly Usage GB', aliases: ['monthly_usage', 'data_usage', 'avg_usage_gb', 'usage_gb', 'monthly_usage_gb'], type: 'Decimal' },
  { field: 'dataAllowanceGB', label: 'Data Allowance GB', aliases: ['allowance_gb', 'data_limit', 'data_cap', 'included_data_gb', 'allowance'], type: 'Whole number' },
  { field: 'overageChargesGBP', label: 'Overage Charges GBP', aliases: ['overage', 'extra_charges', 'overage_fee', 'overage_gbp'], type: 'Decimal' },
  { field: 'discountPercent', label: 'Discount Percent', aliases: ['discount', 'discount_pct', 'promo_discount', 'discount_rate'], type: 'Decimal' },
  { field: 'paymentMethod', label: 'Payment Method', aliases: ['payment_type', 'billing_method', 'pay_method'], type: 'Text' },
  { field: 'directDebit', label: 'Direct Debit', aliases: ['is_direct_debit', 'dd_flag', 'dd_active'], type: 'Text' },
  { field: 'latePayments12M', label: 'Late Payments 12M', aliases: ['late_payments', 'late_pay_12m', 'delinquent_payments', 'missed_payments'], type: 'Whole number' },
  { field: 'failedPayments12M', label: 'Failed Payments 12M', aliases: ['failed_payments', 'failed_pay_12m', 'bounced_payments', 'declined_payments'], type: 'Whole number' },
  { field: 'supportTickets12M', label: 'Support Tickets 12M', aliases: ['tickets_12m', 'support_calls', 'ticket_count', 'service_tickets'], type: 'Whole number' },
  { field: 'complaints12M', label: 'Complaints 12M', aliases: ['complaints', 'complaints_count', 'escalations_12m'], type: 'Whole number' },
  { field: 'averageResolutionHours', label: 'Average Resolution Hours', aliases: ['resolution_hours', 'avg_resolution_time', 'time_to_resolve_hours', 'resolution_time'], type: 'Decimal' },
  { field: 'networkOutages12M', label: 'Network Outages 12M', aliases: ['outages_12m', 'outages', 'outage_count', 'downtime_events'], type: 'Whole number' },
  { field: 'satisfactionScore', label: 'Satisfaction Score 1 10', aliases: ['satisfaction', 'csat', 'satisfaction_1_10', 'csat_score', 'satisfactionscore'], type: 'Whole number' },
  { field: 'npsScore', label: 'NPS Score', aliases: ['nps', 'net_promoter_score', 'advocacy_score'], type: 'Whole number' },
  { field: 'competitorOfferReceived', label: 'Competitor Offer Received', aliases: ['competitor_offer', 'rival_offer', 'counter_offer_received'], type: 'Text' },
  { field: 'churnStatus', label: 'Churn Status', aliases: ['status', 'account_status', 'customer_status'], type: 'Text' },
  { field: 'churnDate', label: 'Churn Date', aliases: ['cancellation_date', 'termination_date', 'leave_date'], type: 'Date' },
  { field: 'churnReason', label: 'Churn Reason', aliases: ['cancellation_reason', 'reason_for_leaving', 'churn_cause'], type: 'Text' },
  { field: 'lifetimeRevenueGBP', label: 'Lifetime Revenue GBP', aliases: ['lifetime_value', 'clv', 'ltv', 'total_revenue', 'total_spend_gbp'], type: 'Decimal' },
  { field: 'monthlyRevenueAtRiskGBP', label: 'Monthly Revenue At Risk GBP', aliases: ['revenue_at_risk', 'at_risk_mrr', 'mrr_at_risk'], type: 'Decimal' },
  { field: 'churnFlag', label: 'Churn Flag', aliases: ['churn', 'is_churn', 'churned', 'churn_indicator', 'target'], required: false, type: 'Whole number' },
];

export function normalizeHeader(header: string): string {
  return header
    .toLowerCase()
    .replace(/\s*\(gbp\)/gi, '')
    .replace(/\s*\(gb\)/gi, '')
    .replace(/\s*\(1-10\)/gi, '')
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Automatches uploaded headers to BritConnect schema
 */
export function matchColumnsToSchema(headers: string[]): ColumnMappingConfidence[] {
  const mappings: ColumnMappingConfidence[] = [];

  for (const header of headers) {
    const norm = normalizeHeader(header);
    let bestMatch: string | null = null;
    let highestScore = 0;

    for (const def of SCHEMA_DEFINITIONS) {
      const defNorm = normalizeHeader(def.label);
      const fieldNorm = normalizeHeader(def.field);

      if (norm === defNorm || norm === fieldNorm) {
        bestMatch = def.field;
        highestScore = 1.0;
        break;
      }

      // Check aliases
      for (const alias of def.aliases) {
        const aliasNorm = normalizeHeader(alias);
        if (norm === aliasNorm) {
          bestMatch = def.field;
          highestScore = 0.95;
          break;
        }
        if (norm.includes(aliasNorm) || aliasNorm.includes(norm)) {
          if (highestScore < 0.75) {
            bestMatch = def.field;
            highestScore = 0.75;
          }
        }
      }
    }

    mappings.push({
      uploadedHeader: header,
      mappedField: bestMatch,
      confidence: highestScore,
      autoMatched: highestScore >= 0.7,
    });
  }

  return mappings;
}

export interface ParseResult {
  fileName: string;
  fileType: string;
  detectedDelimiter?: string;
  detectedEncoding?: string;
  rawHeaders: string[];
  rawRows: Record<string, unknown>[];
  previewRows: Record<string, unknown>[];
  totalRows: number;
}

/**
 * Robust Client-Side File Parser
 */
export async function parseUploadedFile(file: File, onProgress?: (percent: number) => void): Promise<ParseResult> {
  const extension = file.name.split('.').pop()?.toLowerCase() || '';

  if (['csv', 'tsv', 'txt'].includes(extension)) {
    return new Promise((resolve, reject) => {
      let detectedDelimiter = ',';
      if (extension === 'tsv') detectedDelimiter = '\t';

      Papa.parse(file, {
        header: true,
        dynamicTyping: false,
        skipEmptyLines: true,
        delimiter: extension === 'tsv' ? '\t' : undefined, // auto-detect
        complete: (results) => {
          const rawRows = results.data as Record<string, unknown>[];
          const rawHeaders = results.meta.fields || (rawRows[0] ? Object.keys(rawRows[0]) : []);
          resolve({
            fileName: file.name,
            fileType: extension.toUpperCase(),
            detectedDelimiter: results.meta.delimiter || detectedDelimiter,
            rawHeaders,
            rawRows,
            previewRows: rawRows.slice(0, 100),
            totalRows: rawRows.length,
          });
        },
        error: (err) => {
          reject(new Error(`Failed to parse CSV/TSV: ${err.message}`));
        },
      });
    });
  } else if (['xlsx', 'xls', 'xlsm', 'ods'].includes(extension)) {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, { defval: '' });
    const rawHeaders = rawRows[0] ? Object.keys(rawRows[0]) : [];

    return {
      fileName: file.name,
      fileType: extension.toUpperCase(),
      rawHeaders,
      rawRows,
      previewRows: rawRows.slice(0, 100),
      totalRows: rawRows.length,
    };
  } else if (['json', 'ndjson', 'jsonl'].includes(extension)) {
    const text = await file.text();
    let rawRows: Record<string, unknown>[] = [];

    if (extension === 'ndjson' || extension === 'jsonl' || text.trim().startsWith('{') && text.includes('\n{')) {
      const lines = text.trim().split('\n');
      rawRows = lines.map((l) => JSON.parse(l));
    } else {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) {
        rawRows = parsed;
      } else if (parsed && typeof parsed === 'object') {
        const arrayKey = Object.keys(parsed).find((k) => Array.isArray(parsed[k]));
        if (arrayKey) {
          rawRows = parsed[arrayKey];
        } else {
          rawRows = [parsed];
        }
      }
    }

    const rawHeaders = rawRows[0] ? Object.keys(rawRows[0]) : [];
    return {
      fileName: file.name,
      fileType: extension.toUpperCase(),
      rawHeaders,
      rawRows,
      previewRows: rawRows.slice(0, 100),
      totalRows: rawRows.length,
    };
  }

  throw new Error(`Unsupported file type: .${extension}. Please upload CSV, TSV, XLSX, XLS, ODS, or JSON.`);
}
