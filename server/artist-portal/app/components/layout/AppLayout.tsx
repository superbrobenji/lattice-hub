import { NavBar } from "./NavBar";

export function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-base text-white">
      <NavBar />
      <main className="max-w-[1400px] mx-auto px-6 py-6">{children}</main>
    </div>
  );
}
