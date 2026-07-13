import React from "react";
import { Sidebar } from "./Sidebar";

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <div className="min-h-screen bg-base">
      <Sidebar />
      <main className="ml-[220px] p-6 max-w-[1400px]">{children}</main>
    </div>
  );
}
