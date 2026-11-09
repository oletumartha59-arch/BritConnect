import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useAppStore } from '../store';
import { EmptyState } from '../components/ui/EmptyState';
import { QueryEngine, handleFallbackQuery, QueryResult } from '../lib/queryEngine';
import { ChartCard } from '../components/charts/ChartCard';
import { THEME_COLORS } from '../theme/chartTheme';
import { Bot, Send, Sparkles, Pin, Download, ChevronDown, ChevronUp, RefreshCw, User, HelpCircle } from 'lucide-react';
import { db } from '../lib/storage/db';
import { saveAs } from 'file-saver';

interface ChatMessageItem {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  queryResult?: QueryResult;
  pinned?: boolean;
}

const SUGGESTED_QUESTIONS = [
  'What is our churn rate by contract type?',
  'Which UK Nation has the highest churn, and what is driving it?',
  'Who are the 10 most valuable customers likely to churn?',
  'Compare Consumer and Small Business customers.',
  'How much monthly revenue is at risk among Critical customers?',
  'Does receiving a competitor offer increase churn?',
  'Score customer BC-000001 and tell me why.',
];

export const AIAnalyst: React.FC = () => {
  const { cleanedRows, campaigns, cleaningReport, championModel, settings, isDark } = useAppStore();

  const [messages, setMessages] = useState<ChatMessageItem[]>([]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [expandedQueryId, setExpandedQueryId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const queryEngine = useMemo(() => {
    return new QueryEngine(cleanedRows, campaigns, cleaningReport, championModel);
  }, [cleanedRows, campaigns, cleaningReport, championModel]);

  // Load chat history from IndexedDB
  useEffect(() => {
    db.chatHistory.toArray().then((stored) => {
      if (stored && stored.length > 0) {
        setMessages(
          stored.map((m) => ({
            id: m.id,
            role: m.role,
            content: m.content,
            timestamp: m.timestamp,
            queryResult: m.queryPlan as unknown as QueryResult,
            pinned: m.pinned,
          }))
        );
      } else {
        // Welcome message
        setMessages([
          {
            id: 'welcome',
            role: 'assistant',
            content:
              'Hello. I am BritConnect Analyst. I execute deterministic statistical queries across your subscriber data and explain drivers in plain UK business terminology. How can I help you today?',
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
        ]);
      }
    });
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  if (cleanedRows.length === 0) {
    return <EmptyState />;
  }

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputText).trim();
    if (!text || isTyping) return;

    const userMsg: ChatMessageItem = {
      id: `usr_${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText('');
    setIsTyping(true);

    try {
      // 1. Run query through Deterministic Engine
      const result = handleFallbackQuery(text, queryEngine);

      // 2. Prepare Context for Gemini server-side call
      const schemaSummary = {
        totalSubscribers: cleanedRows.length,
        championModel: championModel?.name,
        championPrAuc: championModel?.metrics.prAuc,
        calculatedResult: result,
      };

      let replyNarrative = '';

      try {
        const res = await fetch('/api/gemini/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: text,
            history: messages.slice(-6).map((m) => ({ role: m.role, text: m.content })),
            context: schemaSummary,
            model: settings.geminiModel || 'gemini-3.8-flash',
          }),
        });

        if (res.ok) {
          const data = await res.json();
          replyNarrative = data.text;
        } else {
          replyNarrative = `${result.summary}\n\nKey finding: Review the verified calculation table below.`;
        }
      } catch {
        replyNarrative = `${result.summary}\n\n(Generated via local deterministic query engine while offline).`;
      }

      const botMsg: ChatMessageItem = {
        id: `bot_${Date.now()}`,
        role: 'assistant',
        content: replyNarrative,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        queryResult: result,
      };

      setMessages((prev) => [...prev, botMsg]);
      setIsTyping(false);

      // Persist to IndexedDB
      await db.chatHistory.put({
        id: userMsg.id,
        role: 'user',
        content: userMsg.content,
        timestamp: userMsg.timestamp,
      });
      await db.chatHistory.put({
        id: botMsg.id,
        role: 'assistant',
        content: botMsg.content,
        timestamp: botMsg.timestamp,
        queryPlan: result as unknown as Record<string, unknown>,
      });
    } catch (err) {
      console.error('Chat error:', err);
      setIsTyping(false);
      setMessages((prev) => [
        ...prev,
        {
          id: `err_${Date.now()}`,
          role: 'assistant',
          content: 'An error occurred while running the query engine. Please retry or rephrase your question.',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    }
  };

  const handleExportChat = () => {
    const textContent = messages
      .map((m) => `[${m.timestamp}] ${m.role === 'user' ? 'USER' : 'ANALYST'}:\n${m.content}\n`)
      .join('\n---\n\n');
    const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
    saveAs(blob, `BritConnect_Analyst_Transcript_${new Date().toISOString().split('T')[0]}.txt`);
  };

  return (
    <div className="flex h-[calc(100vh-140px)] flex-col rounded-xl border border-border bg-surface shadow-sm overflow-hidden">
      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-border bg-ivory-50 dark:bg-navy-950/40 px-5 py-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-navy-900 text-gold-500 shadow-sm">
            <Bot className="h-4 w-4" />
          </div>
          <div>
            <h2 className="font-serif-heading text-sm font-bold text-text-1">BritConnect Analyst</h2>
            <span className="text-[11px] text-text-2">
              Gemini plans and explains; TypeScript engine calculates with 100% number integrity.
            </span>
          </div>
        </div>

        <button
          onClick={handleExportChat}
          className="flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium text-text-1 hover:bg-navy-200/20"
        >
          <Download className="h-3.5 w-3.5" />
          <span>Export Conversation</span>
        </button>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
        {messages.map((msg) => {
          const isUser = msg.role === 'user';
          const isExpanded = expandedQueryId === msg.id;

          return (
            <div key={msg.id} className={`flex items-start gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
              {/* Avatar */}
              <div
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${
                  isUser
                    ? 'bg-navy-700 text-white'
                    : 'bg-navy-900 text-gold-500 border border-gold-500/30'
                }`}
              >
                {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
              </div>

              {/* Message Bubble */}
              <div
                className={`flex max-w-[85%] flex-col rounded-xl p-4 text-xs leading-relaxed shadow-sm ${
                  isUser
                    ? 'bg-navy-900 text-white'
                    : 'border border-border bg-ivory-50 dark:bg-navy-900/40 text-text-1'
                }`}
              >
                <div className="whitespace-pre-wrap">{msg.content}</div>

                {/* Inline Query Result Table if available */}
                {msg.queryResult && msg.queryResult.data.length > 0 && (
                  <div className="mt-3 overflow-hidden rounded-lg border border-border bg-surface text-text-1">
                    <div className="max-h-56 overflow-auto">
                      <table className="w-full text-left text-[11px]">
                        <thead className="bg-navy-900 text-white sticky top-0">
                          <tr>
                            {Object.keys(msg.queryResult.data[0]).map((h) => (
                              <th key={h} className="p-2 font-medium capitalize">
                                {h.replace(/_/g, ' ')}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {msg.queryResult.data.map((row, idx) => (
                            <tr key={idx} className="hover:bg-navy-200/10">
                              {Object.keys(row).map((k) => (
                                <td key={k} className="p-2 tabular-nums">
                                  {String(row[k] ?? '—')}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* How this was calculated expander */}
                {msg.queryResult && (
                  <div className="mt-2 pt-2 border-t border-border/60">
                    <button
                      onClick={() => setExpandedQueryId(isExpanded ? null : msg.id)}
                      className="flex items-center gap-1 text-[10px] text-text-2 hover:text-navy-500"
                    >
                      <span>How this was calculated</span>
                      {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                    </button>
                    {isExpanded && (
                      <div className="mt-1.5 rounded bg-surface/80 p-2 font-mono text-[10px] text-text-2 border border-border space-y-1">
                        <div>Tool Invoked: {msg.queryResult.tool}</div>
                        <div>Calculation: {msg.queryResult.meta.calculationMethod}</div>
                        <div>Sample Analyzed: {msg.queryResult.meta.totalRowsAnalyzed.toLocaleString()} rows</div>
                      </div>
                    )}
                  </div>
                )}

                <span className="mt-1.5 text-[9px] text-text-2/60 self-end font-mono">
                  {msg.timestamp}
                </span>
              </div>
            </div>
          );
        })}

        {isTyping && (
          <div className="flex items-center gap-2 text-xs text-text-2">
            <RefreshCw className="h-4 w-4 animate-spin text-navy-500" />
            <span>BritConnect Analyst is querying dataset and formulating insight...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Query Chips */}
      <div className="border-t border-border bg-surface px-4 py-2 overflow-x-auto flex items-center gap-2">
        <span className="text-[10px] font-semibold text-text-2 uppercase tracking-wider shrink-0">
          Suggested:
        </span>
        {SUGGESTED_QUESTIONS.map((q, i) => (
          <button
            key={i}
            onClick={() => handleSendMessage(q)}
            className="rounded-full border border-border bg-ivory-50 dark:bg-navy-950 px-2.5 py-1 text-[11px] text-text-1 hover:border-gold-500 hover:text-gold-700 whitespace-nowrap shrink-0 transition-colors"
          >
            {q}
          </button>
        ))}
      </div>

      {/* Input Form */}
      <form onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }} className="border-t border-border bg-surface p-3 flex items-center gap-2">
        <input
          type="text"
          placeholder="Ask a question about churn rate, revenue at risk, customer scores, or playbooks..."
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          className="h-10 flex-1 rounded-lg border border-border bg-ivory-50 dark:bg-navy-950 px-3 text-xs text-text-1 placeholder:text-text-2 focus:border-gold-500 focus:outline-none focus:ring-1 focus:ring-gold-500"
        />
        <button
          type="submit"
          disabled={!inputText.trim() || isTyping}
          className="flex h-10 items-center justify-center rounded-lg bg-navy-900 px-4 text-xs font-semibold text-white hover:bg-navy-700 transition-colors disabled:opacity-50 shadow-sm"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
};
