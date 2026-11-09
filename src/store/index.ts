import { create } from 'zustand';
import {
  CleanedCustomerRecord,
  CleaningReport,
  TrainedModel,
  RetentionCampaign,
  CustomerAudience,
  BehavioralCluster,
  GlobalFilterState,
  AppSettings,
  RiskTier,
} from '../types';
import { db, DatasetMeta, addAuditLog } from '../lib/storage/db';
import { generateDemoCustomers } from '../lib/demo/generator';
import { cleanCustomerDataset } from '../lib/cleaning';
import { matchColumnsToSchema, SCHEMA_DEFINITIONS } from '../lib/parsing';
import { trainAndEvaluateModels } from '../lib/ml';
import { runKMeansClustering } from '../lib/segments';
import { createCampaignFromAudience, simulateCampaignOutcomes } from '../lib/campaigns';

export const INITIAL_FILTERS: GlobalFilterState = {
  dateRange: null,
  customerSegment: [],
  ukNation: [],
  serviceType: [],
  contractType: [],
  acquisitionChannel: [],
  riskTier: [],
  searchQuery: '',
};

export const DEFAULT_SETTINGS: AppSettings = {
  geminiModel: 'gemini-3.8-flash',
  sendRecordLevelDetail: false,
  snapshotDate: '2026-11-01',
  costMatrix: {
    retentionHorizonMonths: 12,
    contactCostGBP: 5.0,
    averageOfferCostGBP: 15.0,
  },
  retentionAssumptions: {
    defaultSaveRate: 0.35,
    retentionDurationMonths: 12,
  },
  riskThresholds: {
    medium: 0.25,
    high: 0.5,
    critical: 0.75,
  },
  autoRetrainOnUpload: false,
};

interface AppStoreState {
  currentDataset: DatasetMeta | null;
  rawRows: Record<string, unknown>[];
  cleanedRows: CleanedCustomerRecord[];
  cleaningReport: CleaningReport | null;
  models: TrainedModel[];
  championModel: TrainedModel | null;
  campaigns: RetentionCampaign[];
  audiences: CustomerAudience[];
  clusters: BehavioralCluster[];
  globalFilters: GlobalFilterState;
  settings: AppSettings;
  isDemoMode: boolean;
  isLoading: boolean;
  isTraining: boolean;
  trainingProgress: number;
  trainingStatus: string;
  isDark: boolean;
  activeTab: string;
  selectedCustomerId: string | null;

  // Actions
  initialize: () => Promise<void>;
  loadDemoData: (count?: number, isMessy?: boolean) => Promise<void>;
  ingestData: (
    name: string,
    rawRows: Record<string, unknown>[],
    columnMapping: Record<string, string>,
    mode?: 'replace' | 'upsert'
  ) => Promise<void>;
  trainModels: () => Promise<void>;
  setGlobalFilters: (filters: Partial<GlobalFilterState>) => void;
  resetGlobalFilters: () => void;
  toggleDarkMode: () => void;
  setActiveTab: (tab: string) => void;
  setSelectedCustomerId: (id: string | null) => void;
  addCampaign: (campaign: RetentionCampaign) => Promise<void>;
  completeCampaignSimulation: (campaignId: string) => Promise<void>;
  saveAudience: (name: string, customerIds: string[], filters: Partial<GlobalFilterState>) => Promise<void>;
  updateSettings: (newSettings: Partial<AppSettings>) => Promise<void>;
  clearAllData: () => Promise<void>;
}

export const useAppStore = create<AppStoreState>((set, get) => ({
  currentDataset: null,
  rawRows: [],
  cleanedRows: [],
  cleaningReport: null,
  models: [],
  championModel: null,
  campaigns: [],
  audiences: [],
  clusters: [],
  globalFilters: INITIAL_FILTERS,
  settings: DEFAULT_SETTINGS,
  isDemoMode: false,
  isLoading: true,
  isTraining: false,
  trainingProgress: 0,
  trainingStatus: '',
  isDark: false,
  activeTab: 'overview',
  selectedCustomerId: null,

  initialize: async () => {
    try {
      set({ isLoading: true });

      // Check dark mode preference
      const isDark = document.documentElement.classList.contains('dark') ||
        (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches);
      if (isDark) document.documentElement.classList.add('dark');

      // Restore datasets from IndexedDB
      const datasets = await db.datasets.toArray();
      const currentMeta = datasets[datasets.length - 1] || null;

      if (currentMeta) {
        const cleaned = await db.cleanedRows.toArray();
        const models = await db.models.toArray();
        const champion = models.find((m) => m.isChampion) || models[0] || null;
        const reports = await db.cleaningReports.toArray();
        const campaigns = await db.campaigns.toArray();
        const audiences = await db.audiences.toArray();
        const clusterRecords = await db.clusters.toArray();
        const clusters = clusterRecords.map((c) => c.data);

        set({
          currentDataset: currentMeta,
          cleanedRows: cleaned,
          cleaningReport: reports[reports.length - 1] || null,
          models,
          championModel: champion,
          campaigns,
          audiences,
          clusters,
          isDemoMode: currentMeta.isDemo,
          isLoading: false,
        });
        return;
      }

      set({ isLoading: false });
    } catch (err) {
      console.warn('Error during store initialization from IndexedDB:', err);
      set({ isLoading: false });
    }
  },

  loadDemoData: async (count = 5000, isMessy = false) => {
    set({ isLoading: true });
    try {
      const demoRows = generateDemoCustomers(count, { isMessy });

      // Build default 1-to-1 mapping
      const mapping: Record<string, string> = {};
      for (const def of SCHEMA_DEFINITIONS) {
        mapping[def.field] = def.field;
        mapping[def.label] = def.field;
      }

      const { cleanedRows, report } = cleanCustomerDataset(
        demoRows as unknown as Record<string, unknown>[],
        mapping,
        { snapshotDate: get().settings.snapshotDate }
      );

      // Train models on cleaned demo data
      set({ trainingStatus: 'Training initial baseline models on demo data...', isTraining: true });
      const { models, championModel, scoredRows } = await trainAndEvaluateModels(cleanedRows, {
        onProgress: (pct, status) => set({ trainingProgress: pct, trainingStatus: status }),
      });

      // Run K-means clustering
      const { clusters } = runKMeansClustering(scoredRows, 4);

      // Create a live demo campaign
      const highRiskAudience = scoredRows.filter((r) => r.predictedRiskTier === 'High' && r.contractType === 'Month-to-Month');
      let initialCampaign: RetentionCampaign | null = null;
      if (highRiskAudience.length >= 20) {
        initialCampaign = createCampaignFromAudience({
          name: 'Q4 High-Risk Rolling Contract Extension',
          objective: 'reduce_churn',
          owner: 'Sarah Jenkins (Retention Lead)',
          startDate: '2026-10-01',
          endDate: '2026-12-31',
          interventionType: 'Proactive renewal discount (10-15%)',
          channel: 'Outbound Call',
          budgetGBP: 12000,
          costPerContactGBP: 3.5,
          offerCostPerAcceptedGBP: 18.0,
          holdoutPercentage: 10,
          audienceName: 'High Risk Month-to-Month (Rolling)',
          customers: highRiskAudience.slice(0, 450),
        });
        initialCampaign = simulateCampaignOutcomes(initialCampaign);
      }

      const datasetMeta: DatasetMeta = {
        id: `demo_${Date.now()}`,
        name: isMessy ? 'BritConnect Synthetic Demo (Messy Raw Quality Test)' : 'BritConnect Synthetic Demo (Standard Baseline)',
        version: 'v1.0-DEMO',
        uploadedAt: new Date().toISOString(),
        rowCount: scoredRows.length,
        fileType: 'SYNTHETIC_CSV',
        isDemo: true,
        status: 'ready',
        description: 'Seeded UK telecommunications customer cohort with realistic churn drivers.',
      };

      // Persist to Dexie IndexedDB
      await db.datasets.put(datasetMeta);
      await db.cleanedRows.clear();
      await db.cleanedRows.bulkPut(scoredRows);
      await db.cleaningReports.clear();
      await db.cleaningReports.put({ ...report, datasetId: datasetMeta.id, id: `rep_${Date.now()}` });
      await db.models.clear();
      await db.models.bulkPut(models);
      await db.clusters.clear();
      for (const cl of clusters) {
        await db.clusters.put({ id: cl.id, data: cl });
      }
      if (initialCampaign) {
        await db.campaigns.clear();
        await db.campaigns.put(initialCampaign);
      }

      await addAuditLog('Load Demo Data', `Loaded ${count} synthetic demo customers (${isMessy ? 'Messy' : 'Clean'})`);

      set({
        currentDataset: datasetMeta,
        cleanedRows: scoredRows,
        cleaningReport: report,
        models,
        championModel,
        clusters,
        campaigns: initialCampaign ? [initialCampaign] : [],
        isDemoMode: true,
        isLoading: false,
        isTraining: false,
      });
    } catch (err) {
      console.error('Error generating demo data:', err);
      set({ isLoading: false, isTraining: false });
    }
  },

  ingestData: async (name, rawRows, columnMapping, mode = 'replace') => {
    set({ isLoading: true });
    try {
      let combinedRaw = [...rawRows];

      if (mode === 'upsert' && get().cleanedRows.length > 0) {
        const existingMap = new Map<string, CleanedCustomerRecord>();
        for (const r of get().cleanedRows) {
          existingMap.set(r.customerId, r);
        }

        // Clean new batch
        const { cleanedRows: newCleaned } = cleanCustomerDataset(rawRows, columnMapping, {
          snapshotDate: get().settings.snapshotDate,
        });

        for (const nr of newCleaned) {
          existingMap.set(nr.customerId, nr);
        }

        const mergedCleaned = Array.from(existingMap.values());
        const datasetMeta: DatasetMeta = {
          id: `ds_${Date.now()}`,
          name,
          version: `v${(parseFloat(get().currentDataset?.version.replace('v', '') || '1.0') + 0.1).toFixed(1)}`,
          uploadedAt: new Date().toISOString(),
          rowCount: mergedCleaned.length,
          fileType: 'FILE_UPLOAD',
          isDemo: false,
          status: 'ready',
        };

        await db.datasets.put(datasetMeta);
        await db.cleanedRows.clear();
        await db.cleanedRows.bulkPut(mergedCleaned);

        set({
          currentDataset: datasetMeta,
          cleanedRows: mergedCleaned,
          isDemoMode: false,
          isLoading: false,
        });

        await addAuditLog('Data Upsert', `Upserted ${rawRows.length} rows into dataset ${name}. Total active base: ${mergedCleaned.length}`);
        return;
      }

      // Replace mode
      const { cleanedRows, report } = cleanCustomerDataset(combinedRaw, columnMapping, {
        snapshotDate: get().settings.snapshotDate,
      });

      const datasetMeta: DatasetMeta = {
        id: `ds_${Date.now()}`,
        name,
        version: 'v1.0',
        uploadedAt: new Date().toISOString(),
        rowCount: cleanedRows.length,
        fileType: 'FILE_UPLOAD',
        isDemo: false,
        status: 'ready',
      };

      await db.datasets.put(datasetMeta);
      await db.cleanedRows.clear();
      await db.cleanedRows.bulkPut(cleanedRows);
      await db.cleaningReports.clear();
      await db.cleaningReports.put({ ...report, datasetId: datasetMeta.id, id: `rep_${Date.now()}` });

      await addAuditLog('Data Ingestion', `Ingested new dataset "${name}" with ${cleanedRows.length} cleaned rows.`);

      set({
        currentDataset: datasetMeta,
        rawRows: combinedRaw,
        cleanedRows,
        cleaningReport: report,
        isDemoMode: false,
        isLoading: false,
      });

      // If auto-retrain enabled or user chooses to train
      if (get().settings.autoRetrainOnUpload && cleanedRows.length >= 300) {
        await get().trainModels();
      }
    } catch (err) {
      console.error('Error during data ingestion:', err);
      set({ isLoading: false });
    }
  },

  trainModels: async () => {
    const rows = get().cleanedRows;
    if (rows.length === 0) return;

    set({ isTraining: true, trainingProgress: 0, trainingStatus: 'Initializing Model Lab...' });

    try {
      const { models, championModel, scoredRows } = await trainAndEvaluateModels(rows, {
        onProgress: (pct, status) => set({ trainingProgress: pct, trainingStatus: status }),
      });

      const { clusters } = runKMeansClustering(scoredRows, 4);

      // Persist to Dexie
      await db.cleanedRows.clear();
      await db.cleanedRows.bulkPut(scoredRows);
      await db.models.clear();
      await db.models.bulkPut(models);
      await db.clusters.clear();
      for (const cl of clusters) {
        await db.clusters.put({ id: cl.id, data: cl });
      }

      await addAuditLog(
        'Model Training',
        `Trained 3 models. Selected Champion: ${championModel.name} with PR-AUC ${championModel.metrics.prAuc}`
      );

      set({
        models,
        championModel,
        cleanedRows: scoredRows,
        clusters,
        isTraining: false,
        trainingProgress: 100,
        trainingStatus: 'Training complete.',
      });
    } catch (err) {
      console.error('Training failed:', err);
      set({ isTraining: false, trainingStatus: 'Training encountered an error.' });
    }
  },

  setGlobalFilters: (newFilters) => {
    set((state) => ({
      globalFilters: { ...state.globalFilters, ...newFilters },
    }));
  },

  resetGlobalFilters: () => {
    set({ globalFilters: INITIAL_FILTERS });
  },

  toggleDarkMode: () => {
    const nextDark = !get().isDark;
    if (nextDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    set({ isDark: nextDark });
  },

  setActiveTab: (tab) => set({ activeTab: tab }),
  setSelectedCustomerId: (id) => set({ selectedCustomerId: id }),

  addCampaign: async (campaign) => {
    await db.campaigns.put(campaign);
    await addAuditLog('Create Campaign', `Created campaign "${campaign.name}" for audience "${campaign.audienceName}"`);
    set((state) => ({ campaigns: [campaign, ...state.campaigns] }));
  },

  completeCampaignSimulation: async (campaignId) => {
    const target = get().campaigns.find((c) => c.id === campaignId);
    if (!target) return;
    const completed = simulateCampaignOutcomes(target);
    await db.campaigns.put(completed);
    set((state) => ({
      campaigns: state.campaigns.map((c) => (c.id === campaignId ? completed : c)),
    }));
  },

  saveAudience: async (name, customerIds, filters) => {
    const aud: CustomerAudience = {
      id: `aud_${Date.now()}`,
      name,
      createdAt: new Date().toISOString(),
      customerCount: customerIds.length,
      filters,
      customerIds,
    };
    await db.audiences.put(aud);
    await addAuditLog('Save Audience', `Saved audience "${name}" with ${customerIds.length} members.`);
    set((state) => ({ audiences: [aud, ...state.audiences] }));
  },

  updateSettings: async (newSettings) => {
    const updated = { ...get().settings, ...newSettings };
    await db.settings.put({ key: 'appSettings', value: updated });
    set({ settings: updated });
  },

  clearAllData: async () => {
    await db.datasets.clear();
    await db.cleanedRows.clear();
    await db.rawRows.clear();
    await db.cleaningReports.clear();
    await db.models.clear();
    await db.campaigns.clear();
    await db.audiences.clear();
    await db.clusters.clear();
    await db.recommendations.clear();
    await db.chatHistory.clear();
    await addAuditLog('Clear Data', 'User confirmed deletion of all stored workspace records.');

    set({
      currentDataset: null,
      rawRows: [],
      cleanedRows: [],
      cleaningReport: null,
      models: [],
      championModel: null,
      campaigns: [],
      audiences: [],
      clusters: [],
      globalFilters: INITIAL_FILTERS,
      isDemoMode: false,
    });
  },
}));
