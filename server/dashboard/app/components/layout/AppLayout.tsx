import React from "react";
import { useNavigation } from "react-router";
import { Sidebar } from "./Sidebar";

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const navigation = useNavigation();
  const loading = navigation.state === "loading";

  return (
    <div className="min-h-screen bg-base">
      {loading && (
        <div className="fixed top-0 left-0 right-0 h-0.5 bg-accent z-50 animate-pulse" />
      )}
      <Sidebar />
      <main className="ml-[220px] p-6 max-w-[1400px]">{children}</main>
    </div>
  );
}
