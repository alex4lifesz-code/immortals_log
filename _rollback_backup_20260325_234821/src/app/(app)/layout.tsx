import { redirect } from "next/navigation";
import { getAuthFromCookies } from "@/lib/auth";
import AppBottomNav from "@/components/navigation/AppBottomNav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const auth = await getAuthFromCookies();
  if (!auth) {
    redirect("/login");
  }

  return (
    <main className="min-h-screen bg-void-black text-cloud-white">
      <div className="mx-auto min-h-screen max-w-3xl px-4 pb-20 pt-6">
        {children}
      </div>
      <AppBottomNav />
    </main>
  );
}
