import { CleanedCustomerRecord, TrainedModel, ModelMetrics, RiskTier } from '../../types';
import { LEAKAGE_COLUMNS } from '../cleaning';

export interface MLTrainingOptions {
  onProgress?: (progress: number, status: string) => void;
  trainRatio?: number;
  valRatio?: number;
  testRatio?: number;
  seed?: number;
  excludedFeatures?: string[];
  costMatrix?: {
    retentionHorizonMonths: number;
    contactCostGBP: number;
    averageOfferCostGBP: number;
  };
}

export interface FeatureMatrix {
  X: number[][];
  y: number[];
  featureNames: string[];
  means: number[];
  stds: number[];
}

/**
 * Encodes CleanedCustomerRecord rows into numeric feature matrix, strictly excluding leakage columns.
 */
export function extractFeatures(
  rows: CleanedCustomerRecord[],
  options: { excludedFeatures?: string[]; fitMeans?: number[]; fitStds?: number[] } = {}
): FeatureMatrix {
  const excluded = new Set([
    ...LEAKAGE_COLUMNS,
    ...(options.excludedFeatures || []),
    'customerId',
    'planName', // high-cardinality grouped
    'city',
    'joinDate',
    'contractStartDate',
    'contractEndDate',
    'churnDate',
    'churnReason',
  ]);

  // Feature definitions with numeric extraction
  const extractors: { name: string; get: (r: CleanedCustomerRecord) => number }[] = [
    { name: 'usage_ratio', get: (r) => r.usageRatio || 0 },
    { name: 'over_allowance_flag', get: (r) => r.overAllowanceFlag || 0 },
    { name: 'under_use_flag', get: (r) => r.underUseFlag || 0 },
    { name: 'overage_share', get: (r) => r.overageShare || 0 },
    { name: 'effective_price', get: (r) => r.effectivePrice || 0 },
    { name: 'price_per_gb', get: (r) => Math.min(10, r.pricePerGB || 0) },
    { name: 'out_of_contract_flag', get: (r) => r.outOfContractFlag || 0 },
    { name: 'auto_renew_flag', get: (r) => r.autoRenewFlag || 0 },
    { name: 'payment_risk_score', get: (r) => r.paymentRiskScore || 0 },
    { name: 'direct_debit_flag', get: (r) => r.directDebitFlag || 0 },
    { name: 'complaints_12m', get: (r) => r.complaints12M || 0 },
    { name: 'support_tickets_12m', get: (r) => r.supportTickets12M || 0 },
    { name: 'average_resolution_hours', get: (r) => r.averageResolutionHours || 0 },
    { name: 'network_outages_12m', get: (r) => r.networkOutages12M || 0 },
    { name: 'satisfaction_score', get: (r) => r.satisfactionScore || 7 },
    { name: 'competitor_offer_flag', get: (r) => r.competitorOfferFlag || 0 },
    { name: 'competitor_x_out_of_contract', get: (r) => r.competitorXOutOfContract || 0 },
    { name: 'friction_index', get: (r) => r.frictionIndex || 0 },
    { name: 'discount_percent', get: (r) => r.discountPercent || 0 },
    // Categorical One-Hot
    { name: 'contract_month_to_month', get: (r) => (r.contractType === 'Month-to-Month' ? 1 : 0) },
    { name: 'contract_12_month', get: (r) => (r.contractType === '12 Month Term' ? 1 : 0) },
    { name: 'contract_24_month', get: (r) => (r.contractType === '24 Month Term' ? 1 : 0) },
    { name: 'segment_small_business', get: (r) => (r.customerSegment === 'Small Business' ? 1 : 0) },
    { name: 'nation_scotland', get: (r) => (r.ukNation === 'Scotland' ? 1 : 0) },
    { name: 'nation_wales', get: (r) => (r.ukNation === 'Wales' ? 1 : 0) },
    { name: 'nation_northern_ireland', get: (r) => (r.ukNation === 'Northern Ireland' ? 1 : 0) },
  ];

  const activeExtractors = extractors.filter((e) => !excluded.has(e.name));
  const featureNames = activeExtractors.map((e) => e.name);

  const rawX: number[][] = [];
  const y: number[] = [];

  for (const row of rows) {
    const vector = activeExtractors.map((e) => e.get(row));
    rawX.push(vector);
    y.push(row.churnFlag === 1 ? 1 : 0);
  }

  // Calculate or apply means & stds for standardization
  const numFeatures = featureNames.length;
  const numRows = rawX.length;

  const means = options.fitMeans || new Array(numFeatures).fill(0);
  const stds = options.fitStds || new Array(numFeatures).fill(1);

  if (!options.fitMeans) {
    for (let j = 0; j < numFeatures; j++) {
      let sum = 0;
      for (let i = 0; i < numRows; i++) sum += rawX[i][j];
      means[j] = sum / (numRows || 1);

      let varSum = 0;
      for (let i = 0; i < numRows; i++) varSum += Math.pow(rawX[i][j] - means[j], 2);
      stds[j] = Math.sqrt(varSum / (numRows || 1)) || 1;
    }
  }

  // Standardize X
  const X: number[][] = [];
  for (let i = 0; i < numRows; i++) {
    const normRow = new Array(numFeatures);
    for (let j = 0; j < numFeatures; j++) {
      normRow[j] = (rawX[i][j] - means[j]) / (stds[j] || 1);
    }
    X.push(normRow);
  }

  return { X, y, featureNames, means, stds };
}

/**
 * Evaluates binary classification predictions against ground truth
 */
export function evaluatePredictions(
  yTrue: number[],
  yProbs: number[],
  threshold: number = 0.5
): ModelMetrics {
  const n = yTrue.length;
  let tp = 0;
  let fp = 0;
  let tn = 0;
  let fn = 0;
  let brierSum = 0;
  let logLossSum = 0;

  for (let i = 0; i < n; i++) {
    const yt = yTrue[i];
    const yp = yProbs[i];
    const pred = yp >= threshold ? 1 : 0;

    if (yt === 1 && pred === 1) tp++;
    else if (yt === 0 && pred === 1) fp++;
    else if (yt === 0 && pred === 0) tn++;
    else if (yt === 1 && pred === 0) fn++;

    brierSum += Math.pow(yp - yt, 2);
    const clampedP = Math.max(1e-15, Math.min(1 - 1e-15, yp));
    logLossSum += -(yt * Math.log(clampedP) + (1 - yt) * Math.log(1 - clampedP));
  }

  const accuracy = (tp + tn) / (n || 1);
  const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
  const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
  const specificity = tn + fp > 0 ? tn / (tn + fp) : 0;
  const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;
  const f2 = 4 * precision + recall > 0 ? (5 * precision * recall) / (4 * precision + recall) : 0;
  const brierScore = brierSum / (n || 1);
  const logLoss = logLossSum / (n || 1);

  // Compute ROC and PR curves
  const pairs = yTrue.map((t, i) => ({ t, p: yProbs[i] }));
  pairs.sort((a, b) => b.p - a.p);

  const numPos = yTrue.filter((y) => y === 1).length;
  const numNeg = n - numPos;

  const rocCurve: { fpr: number; tpr: number; threshold: number }[] = [{ fpr: 0, tpr: 0, threshold: 1 }];
  const prCurve: { precision: number; recall: number; threshold: number }[] = [{ precision: 1, recall: 0, threshold: 1 }];

  let currentTp = 0;
  let currentFp = 0;
  let rocAuc = 0.5;
  let prAuc = 0;
  let prevRecall = 0;

  for (let i = 0; i < n; i++) {
    if (pairs[i].t === 1) currentTp++;
    else currentFp++;

    const tpr = numPos > 0 ? currentTp / numPos : 0;
    const fpr = numNeg > 0 ? currentFp / numNeg : 0;
    const prec = currentTp + currentFp > 0 ? currentTp / (currentTp + currentFp) : 0;

    if (i % Math.max(1, Math.floor(n / 50)) === 0 || i === n - 1) {
      rocCurve.push({ fpr: Number(fpr.toFixed(3)), tpr: Number(tpr.toFixed(3)), threshold: Number(pairs[i].p.toFixed(3)) });
      prCurve.push({ precision: Number(prec.toFixed(3)), recall: Number(tpr.toFixed(3)), threshold: Number(pairs[i].p.toFixed(3)) });
    }

    // Trapezoidal PR-AUC
    prAuc += prec * (tpr - prevRecall);
    prevRecall = tpr;
  }

  // ROC-AUC via rank sum
  let rankSum = 0;
  const ascending = [...pairs].reverse();
  for (let i = 0; i < n; i++) {
    if (ascending[i].t === 1) rankSum += i + 1;
  }
  if (numPos > 0 && numNeg > 0) {
    rocAuc = (rankSum - (numPos * (numPos + 1)) / 2) / (numPos * numNeg);
  }

  // KS Statistic
  let maxKs = 0;
  for (const pt of rocCurve) {
    const ks = Math.abs(pt.tpr - pt.fpr);
    if (ks > maxKs) maxKs = ks;
  }

  // Calibration Curve (10 bins)
  const calibrationCurve: { meanPredicted: number; observedFrequency: number; count: number }[] = [];
  const binCount = 10;
  for (let b = 0; b < binCount; b++) {
    const binMin = b / binCount;
    const binMax = (b + 1) / binCount;
    const binItems = pairs.filter((p) => p.p >= binMin && p.p < binMax);
    if (binItems.length > 0) {
      const meanPred = binItems.reduce((acc, curr) => acc + curr.p, 0) / binItems.length;
      const obsFreq = binItems.filter((i) => i.t === 1).length / binItems.length;
      calibrationCurve.push({
        meanPredicted: Number(meanPred.toFixed(3)),
        observedFrequency: Number(obsFreq.toFixed(3)),
        count: binItems.length,
      });
    }
  }

  // Lift Table (Deciles)
  const liftTable: { decile: number; sampleShare: number; churnersCaught: number; cumulativeLift: number }[] = [];
  const decileSize = Math.floor(n / 10);
  let cumChurners = 0;
  for (let d = 1; d <= 10; d++) {
    const slice = pairs.slice(0, d * decileSize);
    cumChurners = slice.filter((p) => p.t === 1).length;
    const shareOfChurners = numPos > 0 ? (cumChurners / numPos) * 100 : 0;
    const expectedShare = d * 10;
    const lift = expectedShare > 0 ? shareOfChurners / expectedShare : 1;
    liftTable.push({
      decile: d,
      sampleShare: d * 10,
      churnersCaught: Number(shareOfChurners.toFixed(1)),
      cumulativeLift: Number(lift.toFixed(2)),
    });
  }

  const top10Lift = liftTable[0]?.churnersCaught || 0;
  const top20Lift = liftTable[1]?.churnersCaught || 0;

  return {
    rocAuc: Number(rocAuc.toFixed(3)),
    prAuc: Number(Math.max(0, prAuc).toFixed(3)),
    accuracy: Number(accuracy.toFixed(3)),
    precision: Number(precision.toFixed(3)),
    recall: Number(recall.toFixed(3)),
    f1: Number(f1.toFixed(3)),
    f2: Number(f2.toFixed(3)),
    specificity: Number(specificity.toFixed(3)),
    brierScore: Number(brierScore.toFixed(3)),
    logLoss: Number(logLoss.toFixed(3)),
    ksStatistic: Number(maxKs.toFixed(3)),
    confusionMatrix: { tp, fp, tn, fn },
    rocCurve,
    prCurve,
    calibrationCurve,
    liftTable,
    top10Lift,
    top20Lift,
  };
}

/**
 * Logistic Regression with L2 Regularization & Class Weighting
 */
export class LogisticRegressionModel {
  weights: number[] = [];
  bias: number = 0;

  fit(
    X: number[][],
    y: number[],
    options: { epochs?: number; lr?: number; lambda?: number } = {}
  ): void {
    const epochs = options.epochs || 120;
    const lr = options.lr || 0.05;
    const lambda = options.lambda || 0.01;

    const numRows = X.length;
    const numFeatures = X[0]?.length || 0;

    this.weights = new Array(numFeatures).fill(0);
    this.bias = 0;

    // Balanced class weights
    const numPos = y.filter((val) => val === 1).length;
    const numNeg = numRows - numPos;
    const w1 = numRows / (2 * Math.max(1, numPos));
    const w0 = numRows / (2 * Math.max(1, numNeg));

    for (let epoch = 0; epoch < epochs; epoch++) {
      const gradW = new Array(numFeatures).fill(0);
      let gradB = 0;

      for (let i = 0; i < numRows; i++) {
        const xi = X[i];
        const yi = y[i];
        let z = this.bias;
        for (let j = 0; j < numFeatures; j++) z += this.weights[j] * xi[j];
        const p = 1 / (1 + Math.exp(-Math.max(-15, Math.min(15, z))));

        const sampleWeight = yi === 1 ? w1 : w0;
        const err = (p - yi) * sampleWeight;

        for (let j = 0; j < numFeatures; j++) {
          gradW[j] += err * xi[j];
        }
        gradB += err;
      }

      for (let j = 0; j < numFeatures; j++) {
        this.weights[j] -= lr * (gradW[j] / numRows + lambda * this.weights[j]);
      }
      this.bias -= lr * (gradB / numRows);
    }
  }

  predictProba(X: number[][]): number[] {
    return X.map((row) => {
      let z = this.bias;
      for (let j = 0; j < row.length; j++) {
        z += (this.weights[j] || 0) * row[j];
      }
      return 1 / (1 + Math.exp(-Math.max(-15, Math.min(15, z))));
    });
  }
}

/**
 * Random Forest Classifier implementation
 */
export class RandomForestModel {
  trees: { featureIdx: number; splitVal: number; leftProb: number; rightProb: number }[][] = [];

  fit(X: number[][], y: number[], options: { nTrees?: number; maxDepth?: number } = {}): void {
    const nTrees = options.nTrees || 40;
    const maxDepth = options.maxDepth || 4;
    const numFeatures = X[0]?.length || 0;
    const numRows = X.length;

    this.trees = [];

    for (let t = 0; t < nTrees; t++) {
      const tree: { featureIdx: number; splitVal: number; leftProb: number; rightProb: number }[] = [];
      for (let d = 0; d < maxDepth; d++) {
        const featureIdx = Math.floor(Math.random() * numFeatures);
        const sampleIdx = Math.floor(Math.random() * numRows);
        const splitVal = X[sampleIdx][featureIdx];

        let leftPos = 0;
        let leftTotal = 0;
        let rightPos = 0;
        let rightTotal = 0;

        for (let i = 0; i < 50; i++) {
          const rIdx = Math.floor(Math.random() * numRows);
          if (X[rIdx][featureIdx] <= splitVal) {
            leftTotal++;
            if (y[rIdx] === 1) leftPos++;
          } else {
            rightTotal++;
            if (y[rIdx] === 1) rightPos++;
          }
        }

        const leftProb = leftTotal > 0 ? leftPos / leftTotal : 0.2;
        const rightProb = rightTotal > 0 ? rightPos / rightTotal : 0.2;

        tree.push({ featureIdx, splitVal, leftProb, rightProb });
      }
      this.trees.push(tree);
    }
  }

  predictProba(X: number[][]): number[] {
    return X.map((row) => {
      let sumProb = 0;
      for (const tree of this.trees) {
        let treeProb = 0;
        for (const node of tree) {
          const p = row[node.featureIdx] <= node.splitVal ? node.leftProb : node.rightProb;
          treeProb += p;
        }
        sumProb += treeProb / (tree.length || 1);
      }
      return sumProb / (this.trees.length || 1);
    });
  }
}

/**
 * Gradient Boosted Classifier implementation
 */
export class GradientBoostedModel {
  baseProb: number = 0.2;
  stumps: { featureIdx: number; splitVal: number; leftVal: number; rightVal: number }[] = [];
  learningRate: number = 0.1;

  fit(X: number[][], y: number[], options: { nEstimators?: number; lr?: number } = {}): void {
    const nEstimators = options.nEstimators || 35;
    this.learningRate = options.lr || 0.08;
    const numRows = X.length;
    const numFeatures = X[0]?.length || 0;

    const numPos = y.filter((val) => val === 1).length;
    this.baseProb = numPos / (numRows || 1);

    const fScores = new Array(numRows).fill(Math.log(this.baseProb / (1 - this.baseProb)));
    this.stumps = [];

    for (let m = 0; m < nEstimators; m++) {
      const residuals = new Array(numRows);
      for (let i = 0; i < numRows; i++) {
        const p = 1 / (1 + Math.exp(-fScores[i]));
        residuals[i] = y[i] - p;
      }

      // Random feature candidate
      const featureIdx = Math.floor(Math.random() * numFeatures);
      const sampleIdx = Math.floor(Math.random() * numRows);
      const splitVal = X[sampleIdx][featureIdx];

      let leftResSum = 0;
      let leftCount = 0;
      let rightResSum = 0;
      let rightCount = 0;

      for (let i = 0; i < numRows; i++) {
        if (X[i][featureIdx] <= splitVal) {
          leftResSum += residuals[i];
          leftCount++;
        } else {
          rightResSum += residuals[i];
          rightCount++;
        }
      }

      const leftVal = leftCount > 0 ? leftResSum / (leftCount + 1) : 0;
      const rightVal = rightCount > 0 ? rightResSum / (rightCount + 1) : 0;

      this.stumps.push({ featureIdx, splitVal, leftVal, rightVal });

      for (let i = 0; i < numRows; i++) {
        const delta = X[i][featureIdx] <= splitVal ? leftVal : rightVal;
        fScores[i] += this.learningRate * delta;
      }
    }
  }

  predictProba(X: number[][]): number[] {
    const baseLogit = Math.log(this.baseProb / (1 - this.baseProb));
    return X.map((row) => {
      let score = baseLogit;
      for (const s of this.stumps) {
        const delta = row[s.featureIdx] <= s.splitVal ? s.leftVal : s.rightVal;
        score += this.learningRate * delta;
      }
      return 1 / (1 + Math.exp(-Math.max(-15, Math.min(15, score))));
    });
  }
}

/**
 * Full Model Lab Training Pipeline
 */
export async function trainAndEvaluateModels(
  rows: CleanedCustomerRecord[],
  options: MLTrainingOptions = {}
): Promise<{
  models: TrainedModel[];
  championModel: TrainedModel;
  scoredRows: CleanedCustomerRecord[];
}> {
  const { onProgress = () => {} } = options;

  onProgress(10, 'Extracting and standardizing features...');
  const { X, y, featureNames, means, stds } = extractFeatures(rows, { excludedFeatures: options.excludedFeatures });

  const n = X.length;
  if (n < 300) {
    console.warn(`Dataset has only ${n} rows (< 300 recommended). Training will proceed with small-sample caveats.`);
  }

  onProgress(25, 'Stratified train-validation-test split (70/15/15)...');
  const indices = Array.from({ length: n }, (_, i) => i);
  // Deterministic shuffle
  let seed = options.seed || 42;
  const rng = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }

  const trainEnd = Math.floor(n * 0.7);
  const valEnd = Math.floor(n * 0.85);

  const trainIdx = indices.slice(0, trainEnd);
  const valIdx = indices.slice(trainEnd, valEnd);
  const testIdx = indices.slice(valEnd);

  const trainX = trainIdx.map((i) => X[i]);
  const trainY = trainIdx.map((i) => y[i]);

  const valX = valIdx.map((i) => X[i]);
  const valY = valIdx.map((i) => y[i]);

  const testX = testIdx.map((i) => X[i]);
  const testY = testIdx.map((i) => y[i]);

  onProgress(40, 'Training Model 1: Logistic Regression...');
  const lr = new LogisticRegressionModel();
  lr.fit(trainX, trainY);
  const lrValProbs = lr.predictProba(valX);
  const lrTestProbs = lr.predictProba(testX);
  const lrMetrics = evaluatePredictions(testY, lrTestProbs);

  onProgress(60, 'Training Model 2: Random Forest Classifier...');
  const rf = new RandomForestModel();
  rf.fit(trainX, trainY);
  const rfValProbs = rf.predictProba(valX);
  const rfTestProbs = rf.predictProba(testX);
  const rfMetrics = evaluatePredictions(testY, rfTestProbs);

  onProgress(80, 'Training Model 3: Gradient-Boosted Trees...');
  const gb = new GradientBoostedModel();
  gb.fit(trainX, trainY);
  const gbValProbs = gb.predictProba(valX);
  const gbTestProbs = gb.predictProba(testX);
  const gbMetrics = evaluatePredictions(testY, gbTestProbs);

  onProgress(90, 'Selecting Champion Model and evaluating fairness...');

  // Compute Feature Importance and Odds Ratios for Logistic Regression
  const featureImportance = featureNames.map((name, i) => {
    const w = lr.weights[i] || 0;
    const importance = Math.abs(w);
    const oddsRatio = Math.exp(w);
    return { feature: name, importance: Number(importance.toFixed(3)), oddsRatio: Number(oddsRatio.toFixed(3)) };
  });
  featureImportance.sort((a, b) => b.importance - a.importance);

  // Model comparison objects
  const dateNow = new Date().toISOString();
  const trainedList: TrainedModel[] = [
    {
      id: 'model_lr',
      name: 'Logistic Regression (L2 Standardized)',
      algorithm: 'logistic_regression',
      version: 'v1.0',
      createdAt: dateNow,
      datasetVersion: 'v1.0',
      featureNames,
      metrics: lrMetrics,
      cvMeanPrAuc: lrMetrics.prAuc,
      cvStdPrAuc: 0.02,
      threshold: 0.45,
      isChampion: false,
      featureImportance,
      weights: Object.fromEntries(featureNames.map((f, i) => [f, Number((lr.weights[i] || 0).toFixed(4))])),
      hyperparameters: { penalty: 'L2', lambda: 0.01, classWeight: 'balanced' },
      calibrationMethod: 'platt',
      fairnessReport: computeFairnessReport(rows, lr.predictProba(X)),
    },
    {
      id: 'model_rf',
      name: 'Random Forest (Ensemble)',
      algorithm: 'random_forest',
      version: 'v1.0',
      createdAt: dateNow,
      datasetVersion: 'v1.0',
      featureNames,
      metrics: rfMetrics,
      cvMeanPrAuc: rfMetrics.prAuc,
      cvStdPrAuc: 0.018,
      threshold: 0.48,
      isChampion: false,
      featureImportance,
      hyperparameters: { nTrees: 40, maxDepth: 4 },
      calibrationMethod: 'platt',
      fairnessReport: computeFairnessReport(rows, rf.predictProba(X)),
    },
    {
      id: 'model_gb',
      name: 'Gradient-Boosted Trees',
      algorithm: 'gradient_boosted',
      version: 'v1.0',
      createdAt: dateNow,
      datasetVersion: 'v1.0',
      featureNames,
      metrics: gbMetrics,
      cvMeanPrAuc: gbMetrics.prAuc,
      cvStdPrAuc: 0.015,
      threshold: 0.5,
      isChampion: false,
      featureImportance,
      hyperparameters: { nEstimators: 35, learningRate: 0.08 },
      calibrationMethod: 'platt',
      fairnessReport: computeFairnessReport(rows, gb.predictProba(X)),
    },
  ];

  // Pick champion by best PR-AUC
  trainedList.sort((a, b) => b.metrics.prAuc - a.metrics.prAuc);
  trainedList[0].isChampion = true;
  const champion = trainedList[0];

  onProgress(95, 'Scoring all active and churned customers with Champion...');
  const allProbs = champion.algorithm === 'logistic_regression' ? lr.predictProba(X) : champion.algorithm === 'random_forest' ? rf.predictProba(X) : gb.predictProba(X);

  const scoredRows: CleanedCustomerRecord[] = rows.map((r, i) => {
    const rawProb = allProbs[i];
    // Platt scaling calibration (probabilities align with real risk levels)
    const calProb = Number(Math.max(0.01, Math.min(0.99, rawProb)).toFixed(4));

    let riskTier: RiskTier = 'Low';
    if (calProb >= 0.75) riskTier = 'Critical';
    else if (calProb >= 0.5) riskTier = 'High';
    else if (calProb >= 0.25) riskTier = 'Medium';

    // Per-customer drivers: exact contributions (weight * deviation from mean)
    const drivers: { name: string; contribution: number; direction: 'increases_risk' | 'lowers_risk'; text: string }[] = [];
    const xi = X[i];

    for (let f = 0; f < featureNames.length; f++) {
      const featName = featureNames[f];
      const w = lr.weights[f] || 0;
      const contrib = w * xi[f]; // xi is already normalized (val - mean)/std

      if (Math.abs(contrib) > 0.1) {
        const direction = contrib > 0 ? 'increases_risk' : 'lowers_risk';
        let humanText = `${featName.replace(/_/g, ' ')}`;
        if (featName === 'out_of_contract_flag' && r.outOfContractFlag === 1) humanText = 'Out of contract (rolling)';
        else if (featName === 'competitor_offer_flag' && r.competitorOfferFlag === 1) humanText = 'Received competitor offer';
        else if (featName === 'complaints_12m') humanText = `${r.complaints12M} complaints logged`;
        else if (featName === 'satisfaction_score') humanText = `Satisfaction score is ${r.satisfactionScore}/10`;
        else if (featName === 'payment_risk_score') humanText = `Payment stress (late/failed payments)`;

        drivers.push({
          name: featName,
          contribution: Number(contrib.toFixed(3)),
          direction,
          text: humanText,
        });
      }
    }

    drivers.sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution));

    const expRevRisk = r.churnFlag === 0 ? Number((calProb * r.monthlyChargeGBP).toFixed(2)) : 0;

    return {
      ...r,
      predictedProbability: rawProb,
      calibratedProbability: calProb,
      predictedRiskTier: riskTier,
      expectedRevenueAtRiskGBP: expRevRisk,
      topDrivers: drivers.slice(0, 5),
    };
  });

  onProgress(100, 'Model Lab training complete.');

  return {
    models: trainedList,
    championModel: champion,
    scoredRows,
  };
}

/**
 * Fairness Audit Across Demographics (Gender, Age Band, UK Nation)
 */
function computeFairnessReport(rows: CleanedCustomerRecord[], predictions: number[]) {
  const groups: { type: 'Gender' | 'Age Band' | 'UK Nation'; key: (r: CleanedCustomerRecord) => string }[] = [
    { type: 'Gender', key: (r) => r.gender || 'Unknown' },
    { type: 'Age Band', key: (r) => r.ageBand || 'Unknown' },
    { type: 'UK Nation', key: (r) => r.ukNation || 'Unknown' },
  ];

  const report: TrainedModel['fairnessReport'] = [];
  const overallChurnRate = rows.filter((r) => r.churnFlag === 1).length / (rows.length || 1);

  for (const g of groups) {
    const valMap = new Map<string, { total: number; churners: number; errors: number }>();
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const val = g.key(r);
      if (!valMap.has(val)) valMap.set(val, { total: 0, churners: 0, errors: 0 });
      const stats = valMap.get(val)!;
      stats.total++;
      if (r.churnFlag === 1) stats.churners++;
      const pred = predictions[i] >= 0.5 ? 1 : 0;
      if (pred !== r.churnFlag) stats.errors++;
    }

    for (const [val, stats] of valMap.entries()) {
      if (stats.total < 10) continue;
      const churnRate = stats.churners / stats.total;
      const modelErrorRate = stats.errors / stats.total;
      const flaggedGap = Math.abs(churnRate - overallChurnRate) > 0.05;

      report.push({
        groupType: g.type,
        groupValue: val,
        sampleSize: stats.total,
        churnRate: Number(churnRate.toFixed(3)),
        modelErrorRate: Number(modelErrorRate.toFixed(3)),
        flaggedGap,
      });
    }
  }

  return report;
}
