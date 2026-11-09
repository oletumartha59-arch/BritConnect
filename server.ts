import express, { Request, Response } from 'express';
import { GoogleGenAI, Type } from '@google/genai';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = parseInt(process.env.PORT || '3000', 10);

app.use(express.json({ limit: '10mb' }));

// Initialize GoogleGenAI server-side with telemetry header
const getGeminiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
};

// Health check endpoint
app.get('/api/health', (_req: Request, res: Response) => {
  const hasKey = !!process.env.GEMINI_API_KEY;
  res.json({ status: 'ok', hasKey, defaultModel: 'gemini-3.8-flash' });
});

// Chat endpoint: takes a natural language prompt, dataset metadata/context, and history
app.post('/api/gemini/chat', async (req: Request, res: Response) => {
  try {
    const { message, history, context, model = 'gemini-3.8-flash' } = req.body;
    const ai = getGeminiClient();

    if (!ai) {
      return res.status(503).json({
        error: 'Gemini API key is not configured in server environment.',
        fallback: true,
      });
    }

    const systemInstruction = `You are BritConnect Analyst, the senior AI telemetry and retention intelligence assistant for BritConnect, a major UK telecommunications provider.
CRITICAL NON-NEGOTIABLE OPERATING PRINCIPLES:
1. Real numbers only: Never invent figures. Every metric must be grounded in the provided dataset context or computed results.
2. Carefully distinguish correlation vs causation: Say "associated with", never "causes", unless from a controlled holdout campaign.
3. No raw row leak: You work strictly with aggregated metrics, schema details, and verified query results.
4. If a question is ambiguous, ask 1 concise clarifying question.
5. If data is missing for a requested calculation, state explicitly which column is required.
6. Tone: Authoritative, calm, executive-ready, UK business terminology (GBP £, UK nations: England, Scotland, Wales, Northern Ireland).

Available Context:
${JSON.stringify(context || {}, null, 2)}
`;

    const contents = [
      ...(Array.isArray(history)
        ? history.map((h: { role: string; text: string }) => ({
            role: h.role === 'user' ? 'user' : 'model',
            parts: [{ text: h.text }],
          }))
        : []),
      {
        role: 'user',
        parts: [{ text: message }],
      },
    ];

    const response = await ai.models.generateContent({
      model,
      contents,
      config: {
        systemInstruction,
      },
    });

    const replyText = response.text || 'I could not generate an analysis for this query.';
    return res.json({ text: replyText });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error('Error in /api/gemini/chat:', errorMsg);
    return res.status(500).json({ error: errorMsg, fallback: true });
  }
});

// Retention Recommendations endpoint with structured JSON schema
app.post('/api/gemini/recommendations', async (req: Request, res: Response) => {
  try {
    const { evidencePack, model = 'gemini-3.8-flash' } = req.body;
    const ai = getGeminiClient();

    if (!ai) {
      return res.status(503).json({
        error: 'Gemini API key not configured.',
        fallback: true,
      });
    }

    const systemInstruction = `You are the Lead Retention Strategist for BritConnect UK.
Analyze the provided customer evidence pack and formulate a prioritized, compliant, and highly specific retention action plan.
Follow strict British telecommunications norms, UK GDPR, and Ofcom guidance.
Every root cause must cite verified metrics from the evidence pack.
Do NOT invent churn probabilities or revenue; use those provided.
Keep recommendations sharp, actionable, with explicit owner assignments, deadlines, and KPIs.`;

    const prompt = `Formulate a structured retention plan for the following evidence pack:
${JSON.stringify(evidencePack, null, 2)}`;

    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            scope: { type: Type.STRING },
            subject: { type: Type.STRING },
            riskTier: { type: Type.STRING },
            churnProbability: { type: Type.NUMBER },
            headline: { type: Type.STRING },
            rootCauses: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  driver: { type: Type.STRING },
                  evidence: { type: Type.STRING },
                  shareOfRisk: { type: Type.NUMBER },
                },
                required: ['driver', 'evidence', 'shareOfRisk'],
              },
            },
            actions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  priority: { type: Type.STRING },
                  title: { type: Type.STRING },
                  why: { type: Type.STRING },
                  channel: { type: Type.STRING },
                  offerGuidance: { type: Type.STRING },
                  steps: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        step: { type: Type.INTEGER },
                        description: { type: Type.STRING },
                        owner: { type: Type.STRING },
                        dueInDays: { type: Type.INTEGER },
                      },
                      required: ['step', 'description', 'owner', 'dueInDays'],
                    },
                  },
                  expectedImpact: {
                    type: Type.OBJECT,
                    properties: {
                      churnReductionPoints: { type: Type.NUMBER },
                      revenueSavedGBP: { type: Type.NUMBER },
                      costGBP: { type: Type.NUMBER },
                      netBenefitGBP: { type: Type.NUMBER },
                      confidence: { type: Type.STRING },
                      basis: { type: Type.STRING },
                    },
                    required: [
                      'churnReductionPoints',
                      'revenueSavedGBP',
                      'costGBP',
                      'netBenefitGBP',
                      'confidence',
                      'basis',
                    ],
                  },
                  kpis: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        name: { type: Type.STRING },
                        baseline: { type: Type.STRING },
                        target: { type: Type.STRING },
                        measurement: { type: Type.STRING },
                        frequency: { type: Type.STRING },
                        reviewDate: { type: Type.STRING },
                      },
                      required: ['name', 'baseline', 'target', 'measurement', 'frequency', 'reviewDate'],
                    },
                  },
                  risksAndDependencies: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                  },
                },
                required: [
                  'priority',
                  'title',
                  'why',
                  'channel',
                  'offerGuidance',
                  'steps',
                  'expectedImpact',
                  'kpis',
                  'risksAndDependencies',
                ],
              },
            },
            nextBestAction: { type: Type.STRING },
            complianceNotes: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            assumptions: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
          },
          required: [
            'scope',
            'subject',
            'riskTier',
            'churnProbability',
            'headline',
            'rootCauses',
            'actions',
            'nextBestAction',
            'complianceNotes',
            'assumptions',
          ],
        },
      },
    });

    const jsonStr = (response.text || '{}').trim();
    const parsed = JSON.parse(jsonStr);
    return res.json(parsed);
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error('Error in /api/gemini/recommendations:', errorMsg);
    return res.status(500).json({ error: errorMsg, fallback: true });
  }
});

// Behavioral Cluster Persona Synthesis
app.post('/api/gemini/personas', async (req: Request, res: Response) => {
  try {
    const { clusters, model = 'gemini-3.8-flash' } = req.body;
    const ai = getGeminiClient();

    if (!ai) {
      return res.status(503).json({ error: 'Gemini not configured', fallback: true });
    }

    const systemInstruction = `You are a customer segmentation expert for BritConnect UK telecommunications.
Given mathematical cluster summaries (size, churn rate, ARPU, tenure, contract split, usage, complaints), propose an insightful, concise persona name (3 to 5 words, e.g. "Out-of-Contract Bargain Hunters", "Loyal High-Data Professionals") and a two-sentence narrative description for each cluster.
Do NOT invent or alter the numerical metrics. Return clean JSON.`;

    const response = await ai.models.generateContent({
      model,
      contents: `Provide personas for these clusters:\n${JSON.stringify(clusters, null, 2)}`,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              clusterId: { type: Type.INTEGER },
              personaName: { type: Type.STRING },
              description: { type: Type.STRING },
              recommendedFocus: { type: Type.STRING },
            },
            required: ['clusterId', 'personaName', 'description', 'recommendedFocus'],
          },
        },
      },
    });

    const parsed = JSON.parse((response.text || '[]').trim());
    return res.json(parsed);
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error('Error in /api/gemini/personas:', errorMsg);
    return res.status(500).json({ error: errorMsg, fallback: true });
  }
});

// Vite Middleware mounting (dev) or static serving (prod)
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`BritConnect server running on http://localhost:${port}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start BritConnect server:', err);
});
