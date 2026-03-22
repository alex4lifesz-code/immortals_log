"use client";

import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import PageLayout from "@/components/layout/PageLayout";
import GlowCard from "@/components/ui/GlowCard";
import { useAuth } from "@/context/AuthContext";

interface Cultivator {
  id: string;
  name: string;
  username: string;
  rank: number;
  sessionCount: number;
  checkInCount: number;
}

function CommunitySidebar({ totalMembers }: { totalMembers: number }) {
  return (
    <div className="space-y-3">
      <div className="ink-border rounded-lg p-3 bg-ink-dark space-y-2">
        <h3 className="text-xs text-jade-glow uppercase font-semibold">Sect Statistics</h3>
        <div className="space-y-2">
          <div className="flex justify-between text-xs">
            <span className="text-mist-mid">Total Cultivators</span>
            <span className="text-cloud-white font-bold">{totalMembers}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-mist-mid">Sects Founded</span>
            <span className="text-cloud-white font-bold">1</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function CultivatorCard({ cultivator, rank, isCurrentUser }: { cultivator: Cultivator; rank: number; isCurrentUser: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.02 }}
      className={`relative overflow-hidden rounded-lg border transition-all ${
        isCurrentUser
          ? "border-jade-glow bg-jade-deep/30 shadow-lg shadow-jade-glow/30"
          : rank <= 3
          ? "border-gold-glow/50 bg-gold-dark/20"
          : "border-ink-light bg-ink-dark/50"
      }`}
    >
      <div className="p-4 space-y-3">
        {/* Rank Badge */}
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-sm font-bold text-cloud-white">{cultivator.name}</h3>
            <p className="text-xs text-mist-dark">@{cultivator.username}</p>
          </div>
          <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg ${
            rank === 1 ? "bg-gold-glow/30 border border-gold-glow text-gold-glow" :
            rank === 2 ? "bg-stone-400/30 border border-stone-300 text-stone-300" :
            rank === 3 ? "bg-amber-700/30 border border-amber-600 text-amber-500" :
            "bg-ink-light text-mist-light"
          }`}>
            {rank <= 3 ? (rank === 1 ? "🥇" : rank === 2 ? "🥈" : "🥉") : rank}
          </div>
        </div>

        {/* Stats */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs">
            <span className="text-mist-dark">Sessions</span>
            <span className="text-cloud-white font-bold">{cultivator.sessionCount}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-mist-dark">Check-Ins</span>
            <span className="text-cloud-white font-bold">{cultivator.checkInCount}</span>
          </div>
        </div>

        {isCurrentUser && (
          <div className="text-center text-xs text-jade-glow font-semibold uppercase tracking-wide">
            ✓ That&apos;s you!
          </div>
        )}
      </div>
    </motion.div>
  );
}

export default function SectHallPage() {
  const { user } = useAuth();
  const [cultivators, setCultivators] = useState<Cultivator[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCultivators = async () => {
      try {
        const res = await fetch("/api/users");
        const data = await res.json();
        const users = data.users || [];

        const cultivatorsData: Cultivator[] = users.map((u: { id: string; name: string; username: string; sessionCount?: number; progressionLogCount?: number; _count?: { checkIns: number } }, idx: number) => ({
          id: u.id,
          name: u.name,
          username: u.username,
          sessionCount: u.sessionCount ?? u.progressionLogCount ?? 0,
          checkInCount: u._count?.checkIns || 0,
          rank: idx + 1,
        }));

        // Sort by session count descending
        cultivatorsData.sort((a, b) => b.sessionCount - a.sessionCount);
        cultivatorsData.forEach((c, idx) => { c.rank = idx + 1; });

        setCultivators(cultivatorsData);
      } catch (err) {
        console.error("Failed to fetch cultivators:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchCultivators();
  }, []);

  return (
    <PageLayout
      title="Sect Hall"
      subtitle="Connect with fellow cultivators and compare your path"
      sidebar={<CommunitySidebar totalMembers={cultivators.length} />}
      sidebarLabel="Members"
    >
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            className="text-3xl"
          >
            ☯
          </motion.div>
        </div>
      ) : cultivators.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16">
          <motion.div
            animate={{ y: [0, -8, 0] }}
            transition={{ duration: 4, repeat: Infinity }}
            className="text-5xl mb-4"
          >
            🏯
          </motion.div>
          <h3 className="text-lg text-cloud-white mb-2">Welcome to the Sect Hall</h3>
          <p className="text-sm text-mist-mid text-center max-w-md">
            No other cultivators have joined the journey yet. You are the first to begin this path.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Leaderboard */}
          <div>
            <h3 className="text-sm text-jade-glow uppercase font-semibold mb-4">Sect Leaderboard</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {cultivators.map((cultivator) => (
                <CultivatorCard
                  key={cultivator.id}
                  cultivator={cultivator}
                  rank={cultivator.rank}
                  isCurrentUser={user?.id === cultivator.id}
                />
              ))}
            </div>
          </div>

          {/* Information Card */}
          <GlowCard glow="jade" className="p-4">
            <div className="space-y-2">
              <h3 className="text-sm font-bold text-jade-glow uppercase">Sect Traditions</h3>
              <p className="text-xs text-mist-light leading-relaxed">
                In the Sect Hall, all cultivators are ranked by their training activity. Climb the leaderboard by completing training sessions and checking in daily.
              </p>
              <div className="pt-2 border-t border-ink-light">
                <p className="text-xs text-mist-dark font-semibold">Rankings:</p>
                <ul className="text-xs text-mist-light space-y-1 mt-1">
                  <li>🥇 Rank 1: Sect Leader</li>
                  <li>🥈 Rank 2-3: Senior Disciples</li>
                  <li>🥉 Rank 4+: Junior Disciples</li>
                </ul>
              </div>
            </div>
          </GlowCard>
        </div>
      )}
    </PageLayout>
  );
}
