"use client";

import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import PageLayout from "@/components/layout/PageLayout";
import GlowCard from "@/components/ui/GlowCard";
import { useAuth } from "@/context/AuthContext";
import { REALM_LEVELS } from "@/lib/constants";

interface Cultivator {
  id: string;
  name: string;
  username: string;
  experience: number;
  realm: string;
  rank: number;
}

function CommunitySidebar({ totalMembers, topCultivator }: { totalMembers: number; topCultivator: Cultivator | null }) {
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

      {topCultivator && (
        <div className="ink-border rounded-lg p-3 bg-jade-deep/20 border-jade-glow/50 space-y-2">
          <h3 className="text-xs text-gold-glow uppercase font-semibold">🏆 Sect Leader</h3>
          <div>
            <p className="text-sm font-bold text-cloud-white">{topCultivator.name}</p>
            <p className="text-xs text-gold-glow">{topCultivator.realm}</p>
            <p className="text-xs text-mist-dark mt-1">Level {topCultivator.rank}</p>
          </div>
        </div>
      )}
    </div>
  );
}

function CultivatorCard({ cultivator, rank, isCurrentUser }: { cultivator: Cultivator; rank: number; isCurrentUser: boolean }) {
  const realmEmojis: Record<string, string> = {
    Mortal: "⛩️",
    Foundation: "🌱",
    Core: "💎",
    Nascent: "✨",
    "Soul Splitting": "👻",
    Tribulation: "⚡",
    Immortal: "👑",
  };

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

        {/* Realm and XP */}
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xl">{realmEmojis[cultivator.realm] || "🏔️"}</span>
            <span className="text-sm font-semibold text-jade-glow">{cultivator.realm}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-mist-dark">Experience</span>
            <span className="text-cloud-white font-bold">{cultivator.experience.toLocaleString()} XP</span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full h-1.5 bg-ink-light rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${Math.min((cultivator.experience % 500) / 5, 100)}%` }}
            className="h-full bg-gradient-to-r from-jade-glow to-jade-light rounded-full"
          />
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
  const [selectedRealm, setSelectedRealm] = useState<string | null>(null);

  useEffect(() => {
    const fetchCultivators = async () => {
      try {
        // Fetch all users
        const res = await fetch("/api/users");
        const data = await res.json();
        const users = data.users || [];

        // Calculate realm for each user
        const realms = ["Mortal", "Foundation", "Core", "Nascent", "Soul Splitting", "Tribulation", "Immortal"];
        const xpThresholds = [0, 100, 300, 600, 1200, 2000, 3500];

        const cultivatorsWithRealm = users.map((u: Cultivator, idx: number) => {
          let realm = "Mortal";
          for (let i = xpThresholds.length - 1; i >= 0; i--) {
            if (u.experience >= xpThresholds[i]) {
              realm = realms[i];
              break;
            }
          }
          return {
            ...u,
            realm,
            rank: idx + 1,
          };
        });

        // Sort by experience descending
        cultivatorsWithRealm.sort((a: Cultivator, b: Cultivator) => b.experience - a.experience);

        // Recalculate ranks after sorting
        cultivatorsWithRealm.forEach((c: Cultivator, idx: number) => {
          c.rank = idx + 1;
        });

        setCultivators(cultivatorsWithRealm);
      } catch (err) {
        console.error("Failed to fetch cultivators:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchCultivators();
  }, []);

  const realms = REALM_LEVELS;
  
  const filteredCultivators = selectedRealm
    ? cultivators.filter((c) => c.realm === selectedRealm)
    : cultivators;

  const topCultivator = cultivators.length > 0 ? cultivators[0] : null;

  return (
    <PageLayout
      title="Sect Hall"
      subtitle="Connect with fellow cultivators and compare your path"
      sidebar={<CommunitySidebar totalMembers={cultivators.length} topCultivator={topCultivator} />}
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
          {/* Realm Filter */}
          <div>
            <h3 className="text-sm text-jade-glow uppercase font-semibold mb-3">Filter by Realm</h3>
            <div className="flex flex-wrap gap-2">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setSelectedRealm(null)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  selectedRealm === null
                    ? "bg-jade-glow text-ink-deep"
                    : "bg-ink-light text-cloud-white hover:bg-ink-mid"
                }`}
              >
                All Realms
              </motion.button>
              {realms.map((realm) => {
                const count = cultivators.filter((c) => c.realm === realm).length;
                return (
                  <motion.button
                    key={realm}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setSelectedRealm(realm)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      selectedRealm === realm
                        ? "bg-jade-glow text-ink-deep"
                        : "bg-ink-light text-cloud-white hover:bg-ink-mid"
                    }`}
                  >
                    {realm} ({count})
                  </motion.button>
                );
              })}
            </div>
          </div>

          {/* Leaderboard */}
          <div>
            <h3 className="text-sm text-jade-glow uppercase font-semibold mb-4">
              {selectedRealm ? `${selectedRealm} Cultivators` : "Sect Leaderboard"}
            </h3>
            {filteredCultivators.length === 0 ? (
              <div className="text-center py-8 text-mist-dark">
                No cultivators in {selectedRealm} realm yet
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredCultivators.map((cultivator) => (
                  <CultivatorCard
                    key={cultivator.id}
                    cultivator={cultivator}
                    rank={cultivator.rank}
                    isCurrentUser={user?.id === cultivator.id}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Information Card */}
          <GlowCard glow="jade" className="p-4">
            <div className="space-y-2">
              <h3 className="text-sm font-bold text-jade-glow uppercase">Sect Traditions</h3>
              <p className="text-xs text-mist-light leading-relaxed">
                In the Sect Hall, all cultivators are ranked by their total experience points. Climb the leaderboard by completing training sessions, checking in daily, and mastering new techniques. The highest-ranked cultivator leads the sect and guides others on the path to immortality.
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
