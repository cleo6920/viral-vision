/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { LayoutDashboard, Video, BarChart3, Settings, HelpCircle, History } from 'lucide-react';
import { motion } from 'motion/react';

const menuItems = [
  { icon: LayoutDashboard, label: 'Dashboard', active: true },
  { icon: Video, label: 'Analyze Video', active: false },
  { icon: History, label: 'Recent Jobs', active: false },
  { icon: BarChart3, label: 'Statistics', active: false },
];

const secondaryItems = [
  { icon: Settings, label: 'Settings' },
  { icon: HelpCircle, label: 'Support' },
];

export default function Sidebar() {
  return (
    <aside className="w-64 border-r border-border h-screen flex flex-col bg-brand shrink-0">
      <div className="p-6 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-accent rounded flex items-center justify-center">
            <Video className="text-brand w-5 h-5" />
          </div>
          <span className="font-bold text-xl tracking-tight">VS AI</span>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-2 mt-4">
        <div className="text-[10px] uppercase tracking-widest text-neutral-500 font-bold mb-4 px-2">
          Main Menu
        </div>
        {menuItems.map((item) => (
          <motion.button
            key={item.label}
            whileHover={{ x: 4 }}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              item.active 
                ? 'bg-accent/10 text-accent border border-accent/20' 
                : 'text-neutral-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <item.icon size={18} />
            {item.label}
          </motion.button>
        ))}
      </nav>

      <div className="p-4 space-y-2 border-t border-border">
        {secondaryItems.map((item) => (
          <button
            key={item.label}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-neutral-400 hover:text-white hover:bg-white/5 transition-colors"
          >
            <item.icon size={18} />
            {item.label}
          </button>
        ))}
      </div>
      
      <div className="p-6 bg-surface/30">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-neutral-800 border border-border overflow-hidden">
             <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Felix" alt="avatar" />
          </div>
          <div className="flex-1 overflow-hidden">
            <p className="text-xs font-medium truncate">Gino Raffa</p>
            <p className="text-[10px] text-neutral-500 truncate">Pro Account</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
