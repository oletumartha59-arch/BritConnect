import React from 'react';
import {
  LayoutDashboard,
  Database,
  Cpu,
  UserCheck,
  TrendingUp,
  PieChart,
  Megaphone,
  BookOpen,
  Bot,
  FileText,
  Settings,
  Waves,
} from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  collapsed?: boolean;
}

export const NAV_ITEMS = [
  { id: 'overview', label: 'Executive Overview', icon: LayoutDashboard },
  { id: 'data_hub', label: 'Data Hub', icon: Database },
  { id: 'model_lab', label: 'Model Lab', icon: Cpu },
  { id: 'scoring', label: 'Customer Scoring', icon: UserCheck },
  { id: 'drivers', label: 'Drivers & Insights', icon: TrendingUp },
  { id: 'segments', label: 'Segments', icon: PieChart },
  { id: 'campaigns', label: 'Campaigns', icon: Megaphone },
  { id: 'playbook', label: 'Retention Playbook', icon: BookOpen },
  { id: 'analyst', label: 'AI Analyst', icon: Bot },
  { id: 'reports', label: 'Reports', icon: FileText },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab, collapsed = false }) => {
  return (
    <aside
      className={`fixed top-0 bottom-0 left-0 z-30 flex flex-col border-r border-[#17357C]/40 bg-gradient-to-b from-[#0B1F4B] to-[#07142F] text-white transition-all duration-200 select-none ${
        collapsed ? 'w-16' : 'w-64'
      } hidden md:flex`}
    >
      {/* Brand Lockup */}
      <div className="flex h-16 items-center border-b border-[#17357C]/40 px-5">
        <div className="flex items-center gap-2.5">
          {/* Signal wave glyph */}
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#07142F] border border-gold-500/40 text-gold-500 shadow-sm">
            <svg
              className="h-5 w-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M2 12h2a2 2 0 0 1 2 2v2a2 2 0 0 0 2 2h0a2 2 0 0 0 2-2V8a2 2 0 0 1 2-2h0a2 2 0 0 1 2 2v10a2 2 0 0 0 2 2h0a2 2 0 0 0 2-2v-4a2 2 0 0 1 2-2h2" />
            </svg>
          </div>
          {!collapsed && (
            <div className="flex flex-col">
              <span className="font-serif-heading text-lg font-bold tracking-tight text-white leading-none">
                Brit<span className="text-gold-500">Connect</span>
              </span>
              <span className="text-[10px] uppercase tracking-wider text-[#C9D5EE]/70 font-medium mt-0.5">
                Churn Intelligence
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Nav List */}
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`group relative flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-xs font-medium transition-all ${
                isActive
                  ? 'bg-[#17357C]/60 text-white shadow-sm'
                  : 'text-[#C9D5EE]/80 hover:bg-[#17357C]/30 hover:text-white'
              } ${collapsed ? 'justify-center px-0' : ''}`}
              title={collapsed ? item.label : undefined}
            >
              {/* Gold active marker */}
              {isActive && (
                <span className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r bg-gold-500" />
              )}
              <Icon
                className={`h-4 w-4 shrink-0 transition-colors ${
                  isActive ? 'text-gold-500' : 'text-[#C9D5EE]/70 group-hover:text-white'
                }`}
              />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </button>
          );
        })}
      </nav>

      {/* Sidebar Footer */}
      {!collapsed && (
        <div className="border-t border-[#17357C]/40 p-4">
          <div className="rounded-lg bg-[#07142F]/70 p-2.5 text-[11px] text-[#C9D5EE]/70 border border-[#17357C]/30">
            <div className="flex items-center justify-between font-medium text-white mb-1">
              <span>Security & Privacy</span>
              <span className="text-[10px] text-gold-500">Local IDB</span>
            </div>
            <p className="leading-tight text-[10px]">
              Raw customer records remain strictly in-browser.
            </p>
          </div>
        </div>
      )}
    </aside>
  );
};

export const MobileTabBar: React.FC<{ activeTab: string; setActiveTab: (tab: string) => void }> = ({
  activeTab,
  setActiveTab,
}) => {
  const primaryTabs = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'scoring', label: 'Scoring', icon: UserCheck },
    { id: 'campaigns', label: 'Campaigns', icon: Megaphone },
    { id: 'analyst', label: 'Analyst', icon: Bot },
    { id: 'data_hub', label: 'Data', icon: Database },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 flex h-14 items-center justify-around border-t border-border bg-navy-950 px-2 text-white md:hidden">
      {primaryTabs.map((item) => {
        const Icon = item.icon;
        const isActive = activeTab === item.id;
        return (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={`flex flex-col items-center justify-center p-1 text-[10px] transition-colors ${
              isActive ? 'text-gold-500 font-semibold' : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Icon className="h-4 w-4 mb-0.5" />
            <span>{item.label}</span>
          </button>
        );
      })}
    </div>
  );
};
