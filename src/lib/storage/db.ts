import Dexie, { type EntityTable } from 'dexie';
import {
  CustomerRecord,
  CleanedCustomerRecord,
  CleaningReport,
  TrainedModel,
  RetentionCampaign,
  CustomerAudience,
  RecommendationPlan,
  AppSettings,
  AuditLogEntry,
  BehavioralCluster,
} from '../../types';

export interface DatasetMeta {
  id: string;
  name: string;
  version: string;
  uploadedAt: string;
  rowCount: number;
  fileType: string;
  isDemo: boolean;
  status: 'ready' | 'processing' | 'archived';
  description?: string;
}

export interface StoredRawRow {
  id?: number;
  datasetId: string;
  customerId: string;
  data: Record<string, unknown>;
}

export interface StoredChatMessage {
  id: string;
  timestamp: string;
  role: 'user' | 'assistant';
  content: string;
  queryPlan?: Record<string, unknown>;
  tableData?: Record<string, unknown>[];
  chartConfig?: Record<string, unknown>;
  pinned?: boolean;
}

// Extend Dexie
export class BritConnectDatabase extends Dexie {
  datasets!: EntityTable<DatasetMeta, 'id'>;
  rawRows!: EntityTable<StoredRawRow, 'id'>;
  cleanedRows!: EntityTable<CleanedCustomerRecord, 'customerId'>;
  cleaningReports!: EntityTable<CleaningReport & { datasetId: string; id: string }, 'id'>;
  models!: EntityTable<TrainedModel, 'id'>;
  audiences!: EntityTable<CustomerAudience, 'id'>;
  clusters!: EntityTable<{ id: number; data: BehavioralCluster }, 'id'>;
  campaigns!: EntityTable<RetentionCampaign, 'id'>;
  recommendations!: EntityTable<RecommendationPlan & { id: string }, 'id'>;
  chatHistory!: EntityTable<StoredChatMessage, 'id'>;
  settings!: EntityTable<{ key: string; value: unknown }, 'key'>;
  auditLog!: EntityTable<AuditLogEntry, 'id'>;

  constructor() {
    super('BritConnectDB');

    this.version(1).stores({
      datasets: 'id, name, version, uploadedAt',
      rawRows: '++id, datasetId, customerId',
      cleanedRows: 'customerId, customerSegment, ukNation, serviceType, contractType, predictedRiskTier, churnFlag',
      cleaningReports: 'id, datasetId, timestamp',
      models: 'id, name, algorithm, datasetVersion, isChampion, createdAt',
      audiences: 'id, name, createdAt',
      clusters: 'id',
      campaigns: 'id, name, status, objective, startDate',
      recommendations: 'id, scope, subject, riskTier, generatedAt',
      chatHistory: 'id, timestamp, pinned',
      settings: 'key',
      auditLog: 'id, timestamp, action',
    });
  }
}

export const db = new BritConnectDatabase();

// In-memory fallback if IndexedDB is blocked
export const isIndexedDBAvailable = (): boolean => {
  try {
    return typeof window !== 'undefined' && 'indexedDB' in window && window.indexedDB !== null;
  } catch {
    return false;
  }
};

export async function getStorageUsage(): Promise<{ usedBytes: number; quotaBytes: number; percent: number }> {
  if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.estimate) {
    try {
      const estimate = await navigator.storage.estimate();
      const used = estimate.usage || 0;
      const quota = estimate.quota || 1;
      return {
        usedBytes: used,
        quotaBytes: quota,
        percent: Math.min(100, (used / quota) * 100),
      };
    } catch {
      // ignore
    }
  }
  return { usedBytes: 0, quotaBytes: 100 * 1024 * 1024, percent: 0 };
}

export async function addAuditLog(action: string, details: string, user: string = 'Current User') {
  try {
    const entry: AuditLogEntry = {
      id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toISOString(),
      action,
      details,
      user,
    };
    await db.auditLog.put(entry);
  } catch (e) {
    console.warn('Failed to record audit log:', e);
  }
}
