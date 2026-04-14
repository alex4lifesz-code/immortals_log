type CheckInShape = {
  date: Date | string;
  userId: string;
  present: boolean;
  weight: number | null;
  comment: string | null;
  createdAt?: Date | string;
  [key: string]: unknown;
};

type WorkoutLogShape = {
  userId: string;
  createdAt: Date | string;
};

function normalizeDateKey(dateLike: Date | string): string {
  const value = dateLike instanceof Date ? dateLike : new Date(dateLike);
  if (Number.isNaN(value.getTime())) return "";
  return value.toISOString().slice(0, 10);
}

export function buildAutoCheckInDates(logs: WorkoutLogShape[]): Map<string, Set<string>> {
  const workoutDatesByUser = new Map<string, Set<string>>();

  for (const log of logs) {
    const dateKey = normalizeDateKey(log.createdAt);
    if (!dateKey) continue;

    const existing = workoutDatesByUser.get(log.userId) ?? new Set<string>();
    existing.add(dateKey);
    workoutDatesByUser.set(log.userId, existing);
  }

  return workoutDatesByUser;
}

export function mergeCheckinsWithWorkoutDates<T extends CheckInShape>({
  checkins,
  workoutDatesByUser,
}: {
  checkins: T[];
  workoutDatesByUser: Map<string, Set<string>>;
}): T[] {
  const merged = new Map<string, T>();

  for (const checkin of checkins) {
    const dateKey = normalizeDateKey(checkin.date);
    if (!dateKey) continue;

    const workoutDates = workoutDatesByUser.get(checkin.userId);
    merged.set(`${checkin.userId}:${dateKey}`, {
      ...checkin,
      present: checkin.present || workoutDates?.has(dateKey) === true,
    });
  }

  for (const [userId, workoutDates] of workoutDatesByUser.entries()) {
    for (const dateKey of workoutDates) {
      const key = `${userId}:${dateKey}`;
      if (merged.has(key)) continue;

      merged.set(key, {
        userId,
        date: new Date(`${dateKey}T00:00:00.000Z`),
        present: true,
        weight: null,
        comment: null,
        createdAt: new Date(`${dateKey}T00:00:00.000Z`),
      } as T);
    }
  }

  return [...merged.values()].sort((a, b) => {
    const left = new Date(b.date).getTime();
    const right = new Date(a.date).getTime();
    return left - right;
  });
}
