import React from 'react';
import { Zap, Menu, Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const Header: React.FC = () => {
  return (
    <header className="sticky top-0 z-50 w-full border-b-4 border-black bg-white px-6 py-4 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <div className="bg-black p-2 rounded-xl rotate-3 hover:rotate-0 transition-transform cursor-pointer">
          <Zap className="w-6 h-6 text-primary fill-primary" />
        </div>
        <h1 className="text-2xl font-black tracking-tighter italic uppercase">
          Viral<span className="text-primary">Vision</span> AI
        </h1>
      </div>
      
      <nav className="hidden md:flex items-center gap-8">
        <a href="#" className="text-sm font-bold uppercase tracking-widest hover:text-primary transition-colors">Dashboard</a>
        <a href="#" className="text-sm font-bold uppercase tracking-widest hover:text-primary transition-colors">Trends</a>
        <a href="#" className="text-sm font-bold uppercase tracking-widest hover:text-primary transition-colors">Academy</a>
      </nav>

      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" className="rounded-full">
          <Bell className="w-5 h-5" />
        </Button>
        <Button className="rounded-full font-bold uppercase tracking-wider px-6 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all">
          Pro Plan
        </Button>
      </div>
    </header>
  );
};
