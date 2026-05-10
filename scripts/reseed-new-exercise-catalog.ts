import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";

type CatalogRow = {
  category: string;
  exercise: string;
  muscleGroup: string;
  equipmentOrProps: string;
  setupOptions: string[];
  progression: string[];
  variations: string[];
};

const CALISTHENICS_TABLE = `
| Category | Exercise | Muscle Group | Equipment | Grip | Progression | Variation |
|----------|----------|--------------|-----------|------|-------------|-----------|
| Calisthenics | Pull up | Back, Biceps | Bar, Rings, Rope | Standard, False, Thumbless, Overhand, Underhand, Mixed, Neutral | Scapular pull, Dead hang, Band assisted, Eccentric only, Standard, Strict, Weighted, One arm assisted, One arm negative, One arm | Wide, Close, Chin up, Archer, Typewriter, L-sit, Commando, Chest to bar, Behind the neck, Explosive, Kipping, Clapping |
| Calisthenics | Muscle up | Back, Chest, Triceps | Bar, Rings | Standard, False, Thumbless, Overhand | Jump assisted, Band assisted, Negative only, Standard, Slow, Weighted, Explosive | Wide, Close, Kipping, Strict, L-sit, Behind the neck, Impossible, Typewriter, Clapping |
| Calisthenics | Dip | Chest, Triceps, Shoulders | Parallel bars, Rings, Straight bar | Standard, False, Thumbless | Bench, Negative, Band assisted, Standard, Weighted | Parallel, Korean, L-sit, Russian, Archer, Bulgarian, Impossible |
| Calisthenics | Push up | Chest, Triceps, Shoulders | Floor, Rings, Parallettes | Standard, Fingertip, Knuckle | Incline, Knee, Standard, Decline, Weighted | Wide, Diamond, Archer, One arm, Clapping, Planche, Pike, Pseudo planche, Explosive, Typewriter, Staggered, Spiderman, Hindu |
| Calisthenics | Front lever | Back, Core | Bar, Rings | Standard, False, Thumbless, Overhand | Tuck, Advanced tuck, One leg, Straddle, Full | Pulls, Raises, Ice cream maker, Touch, Rows |
| Calisthenics | Back lever | Chest, Shoulders, Core | Bar, Rings | Standard, False, Thumbless, Overhand | Tuck, Advanced tuck, One leg, Straddle, Full | Pulls, Raises, Press to, Touch, Rows |
| Calisthenics | Handstand | Shoulders, Core | Floor, Parallettes, Blocks | Standard, Fingertip | Wall, Chest to wall, Freestanding, One arm | Tuck, Straddle, Pike, Full, Press to, Walking, Pirouette |
| Calisthenics | Handstand push up | Shoulders, Triceps | Floor, Parallettes | Standard, Fingertip | Wall, Negative, Standard, Weighted | Chest to wall, Back to wall, Freestanding, Deficit, Close, Wide |
| Calisthenics | Planche | Shoulders, Chest, Core | Floor, Parallettes | Standard, Fingertip | Tuck, Advanced tuck, Straddle, Full | Press, Bent arm, Straight arm |
| Calisthenics | Hang | Grip, Shoulders, Core | Bar, Rings | Standard, False, Thumbless, Overhand, Underhand, Mixed, Neutral | Dead hang, Active hang, One arm assisted, One arm | Wide, Close, Archer |
| Calisthenics | Plank | Core | Floor | Standard | Knee, Standard, Decline, Weighted | Side to side, Archer, One arm, Explosive, RKC |
| Calisthenics | L-sit | Core, Triceps | Floor, Parallettes, Bars | Standard, Fingertip | Tuck, L-sit, Straddle, V-sit, Manna | Press to, Walking |
| Calisthenics | Toes to bar | Core | Bar | Standard, Thumbless, Overhand | Assisted, Standard, Weighted | Tuck, L-sit, Straddle, Pike, Full |
| Calisthenics | Hanging leg raise | Core | Bar, Rings | Standard, Thumbless, Overhand | Knee, Standard, Weighted | Tuck, L-sit, Full |
| Calisthenics | Skin the cat | Shoulders, Back, Core | Bar | Standard, False, Overhand | Assisted, Standard, Slow | Upside down, German hang, Dislocate |
| Calisthenics | Windshield wiper | Core, Obliques | Bar, Rings | Standard, Thumbless, Overhand | Standard, Weighted | Wide, Close, Archer, Around the world |
| Calisthenics | Lunge | Quads, Glutes | Floor | N/A | Assisted, Standard, Jumping, Weighted | Bulgarian, Walking, Reverse, Lateral, Curtsy, Deficit, Jumping, Archer |
| Calisthenics | Squat | Quads, Glutes | Floor, Box | N/A | Assisted, Standard, Weighted | Sumo, Narrow, Jump, Pistol, Shrimp, Cossack, Sissy, Hindu, Archer |
| Calisthenics | Nordic curl | Hamstrings | Floor, Rings | N/A | Assisted, Standard, Weighted | Nordic, Sliding, Band assisted |
| Calisthenics | Step up | Quads, Glutes | Box, Floor | N/A | Assisted, Standard, Weighted | Lateral, Crossover, Deficit, Jumping |
| Calisthenics | Glute bridge | Glutes, Hamstrings | Floor | N/A | Standard, Weighted | Single leg, Elevated, Marching |
| Calisthenics | Hip thrust | Glutes, Hamstrings | Floor | N/A | Standard, Weighted | Single leg, Elevated |
| Calisthenics | Calf raise | Calves | Floor | N/A | Standard, Tempo | Diamond, Reverse, Walking |
| Calisthenics | Inverted row | Back, Biceps | Rings, Bar | Standard, False, Thumbless, Overhand, Underhand, Neutral | Incline, Standard, Decline | Wide, Close, Archer, One arm |
| Calisthenics | Dead hang | Grip, Shoulders | Bar | Standard, False, Thumbless, Overhand, Underhand, Mixed | Standard, Weighted | Wide, Close, L-sit |
| Calisthenics | Dragon flag | Core | Bar, Rings | Standard, Thumbless, Overhand | Tuck, Standard, Weighted | Alternating, Around the world |
| Calisthenics | Crunch | Core | Floor | N/A | Standard, Weighted | Twisting, Bicycle, Reverse |
| Calisthenics | Sit up | Core | Floor | N/A | Standard, Weighted | Side, Twisting |
| Calisthenics | V up | Core | Floor | N/A | Standard, Weighted | Reaching, Twisting |
| Calisthenics | Hollow body hold | Core | Floor | N/A | Standard, Weighted | Hollow rock |
| Calisthenics | Arch body hold | Back, Glutes | Floor | N/A | Standard, Weighted | Rocking |
| Calisthenics | Back extension | Back, Glutes | Floor | N/A | Standard, Weighted | Superman, Alternating |
| Calisthenics | Quadruped | Core, Glutes | Floor | N/A | Standard, Weighted | Bird dog, Contralateral |
| Calisthenics | Mountain climber | Core, Shoulders | Floor | N/A | Standard, Weighted | High, Low, Side to side |
| Calisthenics | Burpee | Full body | Floor | N/A | Standard, Explosive | Tuck jump, Star jump, Squat thrust |
| Calisthenics | Side plank | Core, Obliques | Floor | N/A | Standard, Weighted | Copenhagen, Reverse |
| Calisthenics | Plyometric push up | Chest, Triceps | Floor | Standard, Fingertip, Knuckle | Standard, Explosive | Clapping, Alternating, Depth |
| Calisthenics | Support hold | Chest, Triceps, Core | Parallel bars, Rings | Standard, False, Thumbless | Standard, Weighted | L-sit, Swinging, Turned out |
| Calisthenics | Iron cross | Chest, Shoulders, Biceps | Rings | Standard, False | Tuck, Advanced tuck, Straddle, Full | Turned out |
| Calisthenics | Maltese | Shoulders, Chest | Rings | Standard, False | Tuck, Advanced tuck, Straddle, Full | Inverted |
| Calisthenics | Ring push up | Chest, Triceps | Rings | Standard, False | Standard, Weighted | Wide, Archer |
| Calisthenics | Ring row | Back, Biceps | Rings | Standard, False, Overhand, Underhand, Neutral | Standard, Weighted | Wide, Archer |
| Calisthenics | Ring support hold | Chest, Triceps, Core | Rings | Standard, False | Standard, Weighted | L-sit, Turned out |
| Calisthenics | Ring rollout | Core, Shoulders | Rings | Standard, False | Standard, Slow | Forward, Backward |
`;

const YOGA_TABLE = `
| Category | Exercise | Muscle Group | Props | Progression | Variation |
|----------|----------|--------------|-------|-------------|-----------|
| Yoga | Warrior III | Legs, Core | Block, Mat | Kickstand, Wall supported, Full expression | Arms forward, Arms back, Arms wide, Half moon transition, Revolved, Airplane |
| Yoga | Handstand | Shoulders, Core | Wall, Mat | Wall, L-shape, Freestanding | Tuck, Straddle, Pike, Scorpion, Lotus, Press to |
| Yoga | Shoulder stand | Core, Shoulders | Blanket, Mat | Supported, Full expression | Tuck, Straddle, Lotus, Plow, Legs wide |
| Yoga | Wheel pose | Back, Shoulders, Legs | Mat | Bridge, Half wheel, Full expression | One leg, One arm, Scorpion, Walking, Drop back |
| Yoga | Crow pose | Arms, Core | Block, Mat | Frogger, Toes down, Full expression | Side crow, One leg, Flying crow, Crane |
| Yoga | Crescent lunge | Legs, Hip flexors | Mat | Low lunge, Standard, Full expression | Arms up, Cactus arms, Bound, Revolved |
| Yoga | Triangle pose | Legs, Core, Obliques | Block, Mat | Bent knee, Standard, Full expression | Revolved, Bound, Bird of paradise |
| Yoga | Side angle pose | Legs, Core, Obliques | Block, Mat | Bent knee, Standard, Full expression | Revolved, Bound, Extended |
| Yoga | Headstand | Core, Shoulders | Wall, Mat, Blanket | Supported, Standard, Full expression | Toes tucked, Flat foot, One leg, Tripod |
| Yoga | Downward dog | Shoulders, Hamstrings, Back | Mat | Puppy pose, Standard, Full expression | Thread the needle, Twisted, One arm |
| Yoga | Warrior I | Legs, Hip flexors | Mat | Low, Standard, Full expression | Humble, Reverse, Bound, Crescent |
| Yoga | Warrior II | Legs, Hips | Mat | Standard, Full expression | Reverse, Bound, Peaceful |
| Yoga | Half moon pose | Legs, Core | Block, Mat | Supported, Standard, Full expression | Revolved, Bound, Lizard |
| Yoga | Hand to big toe pose | Hamstrings, Balance | Strap, Mat | Strap assisted, Standard, Full expression | Standing, Seated, Reclining, Revolved |
| Yoga | Pigeon pose | Hips, Glutes | Block, Bolster, Mat | Supported, Standard, Full expression | Yin, Supported, Twisted |
| Yoga | Table top | Core, Shoulders | Mat | Cat cow, Standard, Full expression | One arm, One leg, Bird dog, Revolved |
| Yoga | Chair pose | Quads, Glutes | Mat | Supported, Standard, Full expression | Twisted, Eagle wrap, Wide leg |
| Yoga | Standing forward fold | Hamstrings, Back | Block, Mat | Bent knee, Standard, Full expression | Twisted, Side, One leg |
| Yoga | Boat pose | Core | Mat | Supported, Standard, Full expression | Twisted, Side, One leg |
| Yoga | Cobra | Back, Chest | Mat | Low cobra, Standard, Full expression | One arm, Twisted |
| Yoga | King dancer pose | Balance, Back, Quads | Strap, Mat | Standard, Full expression | Bow pulling, Revolved, Full |
| Yoga | Lotus pose | Hips | Mat, Blanket | Standard, Full expression | Half, Full, Fire log |
| Yoga | Hero pose | Quads, Ankles | Block, Bolster, Mat | Supported, Standard, Full expression | Reclined, Supported, Half |
| Yoga | Lord of the fishes pose | Spine, Obliques | Mat | Standard, Full expression | Half, Full, Revolved |
| Yoga | Seated forward fold | Hamstrings, Back | Strap, Block, Mat | Supported, Standard, Full expression | Wide leg, Bound, Revolved |
| Yoga | Bow pose | Back, Chest, Quads | Mat | Standard, Full expression | Half, Full, Bound |
| Yoga | Locust pose | Back, Glutes | Mat | Standard, Full expression | Baby, Full, Twisted |
| Yoga | Reclined twist | Spine, Obliques | Bolster, Mat | Supported, Standard, Full expression | Yin, Supported, Twisted |
| Yoga | Happy baby pose | Hips, Back | Mat | Supported, Standard, Full expression | Half, Full, Reclined |
| Yoga | Eagle pose | Balance, Hips, Shoulders | Mat | Standard, Full expression | Eagle arms, Cow face arms, Reverse prayer |
| Yoga | Standing split | Hamstrings, Balance | Block, Mat | Supported, Standard, Full expression | Half, Full, Revolved |
| Yoga | Arm balance pose | Arms, Core | Mat | Standard, Full expression | Eight angle, Flying splits, Firefly |
| Yoga | Corpse pose | Relaxation | Bolster, Blanket, Mat | Standard, Full expression | Supported, Full, Legs up wall |
| Yoga | Child's pose | Back, Hips | Bolster, Blanket, Mat | Standard, Full expression | Supported, Full, Side lying |
| Yoga | Cat cow | Spine, Core | Mat | Standard, Full expression | Cat, Cow, Bird dog |
| Yoga | Lunge twist | Hip flexors, Spine | Block, Mat | Supported, Standard, Full expression | Low, High, Twisted |
| Yoga | Camel pose | Back, Chest, Hip flexors | Block, Mat | Standard, Full expression | Half, Full, Revolved |
| Yoga | Extended puppy pose | Shoulders, Back | Mat | Standard, Full expression | Puppy, Full, Thread the needle |
| Yoga | Splits | Hamstrings, Hip flexors | Block, Mat | Standard, Full expression | Half, Full, Side |
| Yoga | Frog pose | Hips, Adductors | Bolster, Mat | Standard, Full expression | Frog, Half frog, Mandukasana |
| Yoga | Gate pose | Obliques, Hips | Mat | Standard, Full expression | Gate, Extended, Revolved |
| Yoga | Fish pose | Chest, Back, Neck | Block, Mat | Supported, Standard, Full expression | Half, Full, Bound |
| Yoga | Monkey pose | Hamstrings, Hip flexors | Block, Mat | Standard, Full expression | Half, Full, Bound |
| Yoga | Tree pose | Balance, Hips | Mat | Standard, Full expression | Toe stand, Full, Bound |
| Yoga | Plank pose | Core, Shoulders | Mat | Standard, Full expression | Low, High, Crescent |
| Yoga | Four limbed staff pose | Arms, Core | Mat | Standard, Full expression | Low, Chaturanga, One leg |
| Yoga | Wild thing | Back, Chest, Shoulders | Mat | Standard, Full expression | Baby, Full, Twisted |
| Yoga | Bridge pose | Back, Glutes | Block, Mat | Standard, Full expression | Supported, Full, Revolved |
| Yoga | Banana pose | Obliques, Back | Mat | Standard, Full expression | Yin, Supported |
`;

const GYM_TABLE = `
| Category | Exercise | Muscle Group | Equipment | Grip | Variation |
|----------|----------|--------------|-----------|------|-----------|
| Gym | Bench press | Chest, Triceps, Shoulders | Machine, Smith machine, Dumbbell, Barbell, EZ bar, Barbell with bands, Barbell with chains, Cable | Standard, Wide, Close, Neutral, Reverse, Suicide | Flat, Incline, Decline, Paused, Tempo, Floor, Board, Spoto, Larsen, Dead, Pin, Alternating, Single arm |
| Gym | Deadlift | Back, Hamstrings, Glutes | Trap bar, Barbell, Dumbbell, Smith machine, Barbell with bands, Barbell with chains | Standard, Wide, Close, Mixed, Hook, Snatch, Suicide | Conventional, Sumo, Romanian, Stiff leg, Single leg, Block, Deficit, Jefferson, Reeves, Hack, Paused |
| Gym | Squat | Quads, Glutes, Core | Machine, Smith machine, Dumbbell, Barbell, Kettlebell, Safety squat bar, Belt squat machine | Standard, Wide, Close, Suicide | Back, Front, Hack, Zercher, Box, Pin, Anderson, Olympic, Powerlifting, Paused, Tempo, Split |
| Gym | Shoulder press | Shoulders, Triceps | Dumbbell, Barbell, Machine, Smith machine, Kettlebell, Landmine | Standard, Wide, Close, Neutral, Suicide | Seated, Standing, Arnold, Push press, Behind the neck, Z press, Bradford, Single arm, Alternating |
| Gym | Bicep curl | Biceps, Forearms | Dumbbell, Barbell, EZ bar, Cable, Machine | Standard, Wide, Close, Reverse, Neutral | Preacher, Concentration, Incline, Spider, Drag, Zottman, Bayesian, Cross body, 21s, Waiter, Hammer |
| Gym | Tricep extension | Triceps | Dumbbell, Barbell, EZ bar, Cable, Machine | Standard, Close, Reverse, Neutral | Lying, Overhead, Skull crusher, Kickback, Close grip press, JM press, Tate press, Rolling |
| Gym | Shoulder raise | Shoulders | Dumbbell, Barbell, Cable, Machine | Standard, Neutral | Front, Lateral, Rear, Y raise, Cuban, Lu raise, Around the world |
| Gym | Row | Back, Biceps | Dumbbell, Barbell, Cable, Machine, Smith machine, T-bar | Standard, Wide, Close, Neutral, Reverse, Mixed | Bent over, Pendlay, Seal, Meadows, Kroc, Gorilla, Helms, One arm, Chest supported, Inverted |
| Gym | Lat pulldown | Back, Biceps | Cable, Machine | Standard, Wide, Close, Neutral, Reverse | V-bar, Single arm, Straight arm, Behind the neck |
| Gym | Chest fly | Chest | Dumbbell, Cable, Machine | Standard, Neutral | Flat, Incline, Decline, Standing, High to low, Low to high |
| Gym | Good morning | Hamstrings, Back, Glutes | Barbell, Dumbbell, Machine, Cable | Standard, Wide, Close, Snatch | Sumo, Single leg, Seated, Zercher |
| Gym | Leg curl | Hamstrings | Machine, Dumbbell, Cable, Barbell | N/A | Lying, Seated, Standing, Single leg, Nordic |
| Gym | Leg extension | Quads | Machine, Dumbbell, Cable | N/A | Seated, Single leg |
| Gym | Leg press | Quads, Glutes | Machine, Bodyweight, Cable | Standard, Wide, Close | Single leg, Narrow, Sumo |
| Gym | Hack squat | Quads, Glutes | Machine, Cable | Standard, Wide, Close | Single leg, Narrow, Sumo |
| Gym | Lunge | Quads, Glutes | Dumbbell, Barbell, Smith machine, Kettlebell | Standard, Neutral | Walking, Reverse, Lateral, Deficit, Curtsy, Bulgarian |
| Gym | Hip thrust | Glutes, Hamstrings | Dumbbell, Barbell, Machine, Kettlebell | N/A | Single leg, Elevated, B stance, Feet elevated |
| Gym | Romanian deadlift | Hamstrings, Glutes | Dumbbell, Barbell, Kettlebell | Standard, Wide, Close, Snatch | Single leg, Elevated, B stance, Deficit |
| Gym | Calf raise | Calves | Machine, Dumbbell, Barbell | N/A | Standing, Seated, Single leg, Donkey |
| Gym | Cable crossover | Chest | Cable, Machine | Standard, Wide, Close | Single arm, High, Low, Mid |
| Gym | Pullover | Back, Chest | Dumbbell, Cable, Machine | Standard, Neutral | Incline, Decline, Straight arm |
| Gym | Shrug | Traps | Barbell, Dumbbell, Kettlebell, Trap bar | Standard, Wide, Snatch | Hang, High pull, Muscle, Behind the back |
| Gym | Clean | Full body | Barbell, Dumbbell, Kettlebell | Standard, Hook, Wide | Hang, Power, Squat, Muscle |
| Gym | Snatch | Full body | Barbell, Dumbbell, Kettlebell | Standard, Hook, Wide, Snatch | Hang, Power, Squat, Muscle |
| Gym | Jerk | Shoulders, Triceps | Barbell, Dumbbell, Kettlebell | Standard, Wide, Close | Push, Power, Split, Behind the neck |
| Gym | Clean and jerk | Full body | Barbell, Dumbbell, Kettlebell | Standard, Hook, Wide | Hang, Muscle, Power |
| Gym | Swing | Glutes, Hamstrings, Core | Dumbbell, Kettlebell | N/A | Single arm, Alternating, American, Russian |
| Gym | Turkish get up | Full body | Kettlebell | N/A | Bottoms up, Single arm, Half |
| Gym | Farmers carry | Grip, Core, Traps | Dumbbell, Kettlebell, Barbell | Standard, Neutral | Single arm, Alternating, Trap bar |
| Gym | Carry | Core, Grip | Dumbbell, Barbell, Trap bar | Standard, Neutral | Suitcase, Front rack, Overhead |
| Gym | Face pull | Rear delts, Traps | Dumbbell, Cable, Machine | Standard, Neutral, Reverse | Single arm, Rope, High, Low |
| Gym | Forearm curl | Forearms | Dumbbell, Barbell, Cable | Standard, Reverse, Neutral | Wrist curl, Wrist extension, Finger curl |
| Gym | Dip machine | Chest, Triceps | Machine, Cable | Standard, Wide, Close, Neutral | Assisted, Weighted |
| Gym | Pull up machine | Back, Biceps | Machine, Cable | Standard, Wide, Close, Neutral, Reverse | Assisted, Weighted |
| Gym | Chest press machine | Chest, Triceps | Machine | Standard, Wide, Close, Neutral | Incline, Decline, Flat |
| Gym | Seated row machine | Back, Biceps | Machine | Standard, Wide, Close, Neutral | Single arm, Low row |
| Gym | Shoulder press machine | Shoulders | Machine | Standard, Wide, Neutral | Single arm |
| Gym | Pec deck | Chest | Machine | N/A | Incline, Flat |
| Gym | Reverse pec deck | Rear delts | Machine | N/A | Single arm |
| Gym | Cable crunch | Core | Machine, Cable | Standard, Rope | Kneeling, Standing, Decline |
| Gym | Ab machine | Core | Machine, Cable | N/A | Weighted, Decline |
| Gym | Hyperextension | Back, Glutes | Machine | N/A | 45 degree, Reverse, Weighted |
| Gym | Adductor machine | Adductors | Machine | N/A | Single leg, Weighted |
| Gym | Abductor machine | Abductors | Machine | N/A | Single leg, Weighted |
| Gym | Glute kickback machine | Glutes | Machine | N/A | Single leg, Cable |
| Gym | Hip flexor machine | Hip flexors | Machine, Cable | N/A | Standing, Kneeling, Lying |
| Gym | Tricep pushdown | Triceps | Cable | Standard, Reverse, Neutral | Single arm, Rope, V-bar, Straight bar |
| Gym | Cable row | Back, Biceps | Cable | Standard, Wide, Close, Neutral, Reverse | Single arm, High, Low, Seated, Standing |
| Gym | Landmine row | Back, Biceps | Landmine | Standard, Neutral | Single arm, Meadows, Chest supported |
| Gym | Landmine press | Chest, Shoulders | Landmine | Standard, Neutral | Single arm, Kneeling, Half kneeling |
| Gym | Landmine twist | Core, Obliques | Landmine | N/A | Rotational, Anti-rotation |
| Gym | Landmine squat | Quads, Glutes | Landmine | Standard, Wide, Close | Sumo, Goblet, Single leg |
| Gym | Landmine deadlift | Hamstrings, Glutes | Landmine | Standard, Wide | Romanian, Single leg, Sumo |
`;

function createPrismaClient() {
  const databaseUrl = process.env.DATABASE_URL || "file:./dev.db";
  const adapter = new PrismaLibSql({ url: databaseUrl });
  return new PrismaClient({ adapter });
}

function parseList(value: string): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item && item.toLowerCase() !== "n/a");
}

function dedupe(items: string[]): string[] {
  const seen = new Set<string>();
  const output: string[] = [];
  for (const item of items) {
    const normalized = item.trim();
    if (!normalized) continue;
    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(normalized);
  }
  return output;
}

function parseMarkdownTable(rawTable: string, mode: "cali" | "yoga" | "gym"): CatalogRow[] {
  const lines = rawTable
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith("|"));

  const dataLines = lines.filter(
    (line) => !line.includes("Category") && !line.includes("---")
  );

  const rows: CatalogRow[] = [];
  for (const line of dataLines) {
    const cols = line
      .split("|")
      .map((cell) => cell.trim())
      .filter(Boolean);

    if (mode === "yoga") {
      if (cols.length < 6) continue;
      rows.push({
        category: cols[0],
        exercise: cols[1],
        muscleGroup: cols[2],
        equipmentOrProps: cols[3],
        setupOptions: parseList(cols[3]),
        progression: parseList(cols[4]),
        variations: parseList(cols[5]),
      });
      continue;
    }

    if (mode === "gym") {
      if (cols.length < 6) continue;
      const equipmentList = parseList(cols[3]);
      rows.push({
        category: cols[0],
        exercise: cols[1],
        muscleGroup: cols[2],
        equipmentOrProps: cols[3],
        setupOptions: parseList(cols[4]),
        progression: equipmentList.length > 0 ? equipmentList : ["Standard"],
        variations: parseList(cols[5]),
      });
      continue;
    }

    if (cols.length < 7) continue;
    rows.push({
      category: cols[0],
      exercise: cols[1],
      muscleGroup: cols[2],
      equipmentOrProps: cols[3],
      setupOptions: parseList(cols[4]),
      progression: parseList(cols[5]),
      variations: parseList(cols[6]),
    });
  }

  return rows;
}

function inferFlags(row: CatalogRow): { bodyweight: boolean; weighted: boolean; rings: boolean } {
  const category = row.category.toLowerCase();
  const equipment = row.equipmentOrProps.toLowerCase();
  const progressionCombined = row.progression.join(",").toLowerCase();

  const bodyweight = category !== "gym";
  const weighted = category === "gym" || progressionCombined.includes("weighted");
  const rings = equipment.includes("ring");

  return { bodyweight, weighted, rings };
}

async function ensureLibraryOwner(prisma: PrismaClient): Promise<string> {
  const existing = await prisma.user.findUnique({
    where: { username: "__app_exercise_library__" },
    select: { id: true },
  });
  if (existing) return existing.id;

  const created = await prisma.user.create({
    data: {
      username: "__app_exercise_library__",
      password: `system:${Math.random().toString(36).slice(2)}`,
      name: "Application Exercise Library",
      role: "system",
      onboardingCompleted: true,
      onboardingSkipped: true,
      onboardingStep: 0,
    },
    select: { id: true },
  });

  return created.id;
}

async function main() {
  const prisma = createPrismaClient();

  try {
    const caliRows = parseMarkdownTable(CALISTHENICS_TABLE, "cali");
    const yogaRows = parseMarkdownTable(YOGA_TABLE, "yoga");
    const gymRows = parseMarkdownTable(GYM_TABLE, "gym");

    const compatibilityRows: CatalogRow[] = [
      {
        category: "Gym",
        exercise: "Treadmill",
        muscleGroup: "Full body",
        equipmentOrProps: "Machine",
        setupOptions: [],
        progression: ["Walk", "Jog", "Run"],
        variations: ["Incline", "Intervals", "Steady state"],
      },
      {
        category: "Gym",
        exercise: "Stationary bike",
        muscleGroup: "Quads, Glutes, Core",
        equipmentOrProps: "Machine",
        setupOptions: [],
        progression: ["Light", "Medium", "Hard"],
        variations: ["Steady state", "Intervals"],
      },
      {
        category: "Gym",
        exercise: "Stairmaster",
        muscleGroup: "Quads, Glutes, Calves",
        equipmentOrProps: "Machine",
        setupOptions: [],
        progression: ["Low", "Medium", "High"],
        variations: ["Steady state", "Intervals"],
      },
      {
        category: "Gym",
        exercise: "Rowing machine",
        muscleGroup: "Back, Legs, Core",
        equipmentOrProps: "Machine",
        setupOptions: [],
        progression: ["Light", "Medium", "Hard"],
        variations: ["Steady state", "Intervals"],
      },
      {
        category: "Gym",
        exercise: "Netball game",
        muscleGroup: "Full body",
        equipmentOrProps: "Court, Ball",
        setupOptions: [],
        progression: ["Beginner", "Standard", "Competitive"],
        variations: ["Drills", "Scrimmage", "Match play"],
      },
      {
        category: "Gym",
        exercise: "Upright row",
        muscleGroup: "Shoulders, Traps",
        equipmentOrProps: "EZ bar, Barbell, Dumbbell, Cable",
        setupOptions: ["Standard", "Wide", "Close"],
        progression: ["EZ bar", "Barbell", "Dumbbell", "Cable"],
        variations: ["Standing", "Seated", "Single arm"],
      },
    ];

    const allRows = [...caliRows, ...yogaRows, ...gymRows, ...compatibilityRows];

    console.log(`Parsed rows: ${allRows.length}`);

    const ownerId = await ensureLibraryOwner(prisma);

    // Load existing exercises so we can update in-place (preserving user training logs)
    const existingExercises = await prisma.progressionExercise.findMany({
      select: { id: true, name: true },
    });
    const existingByName = new Map<string, string>(); // name.lower -> id
    for (const ex of existingExercises) {
      existingByName.set(ex.name.toLowerCase(), ex.id);
    }

    // Track which exercise IDs are part of the new catalog
    const catalogExerciseIds: string[] = [];

    let createdExercises = 0;
    let updatedExercises = 0;

    for (const row of allRows) {
      const { bodyweight, weighted, rings } = inferFlags(row);
      const progression = dedupe(row.progression.length > 0 ? row.progression : ["Standard"]);
      const variations = dedupe(row.variations);
      const setupOptions = dedupe(row.setupOptions);

      const existingId = existingByName.get(row.exercise.toLowerCase());

      if (existingId) {
        // Update exercise metadata (safe — keeps exerciseId intact so user logs survive)
        await prisma.progressionExercise.update({
          where: { id: existingId },
          data: {
            category: row.category,
            equipmentType: row.equipmentOrProps,
            primaryMuscles: row.muscleGroup,
            bodyweight,
            weighted,
            rings,
            progression: JSON.stringify(progression),
          },
        });

        // Replace tiers/variations/modifiers — these have no FK to ProgressionLog
        await prisma.progressionTier.deleteMany({ where: { exerciseId: existingId } });
        await prisma.progressionVariation.deleteMany({ where: { exerciseId: existingId } });
        await prisma.progressionModifier.deleteMany({ where: { exerciseId: existingId } });

        if (progression.length > 0) {
          await prisma.progressionTier.createMany({
            data: progression.map((name, index) => ({
              exerciseId: existingId,
              level: index + 1,
              name,
              wuxiaName: name,
              difficulty: "",
              wuxiaDifficulty: "",
              wuxiaType: "",
              description: "",
              targetHold: null,
              targetReps: null,
              targetRepsText: "",
            })),
          });
        }

        if (variations.length > 0) {
          await prisma.progressionVariation.createMany({
            data: variations.map((name) => ({
              exerciseId: existingId,
              name,
              wuxiaName: name,
              difficulty: "",
              wuxiaDifficulty: "",
              wuxiaType: "",
              description: "",
            })),
          });
        }

        if (setupOptions.length > 0) {
          await prisma.progressionModifier.createMany({
            data: setupOptions.map((type) => ({
              exerciseId: existingId,
              type,
              available: true,
              difficultyMod: 0,
              notes: "",
              method: "",
              difficultyIncrease: "",
            })),
          });
        }

        // Clamp any user progression levels that now exceed the new tier count
        const maxLevel = progression.length;
        if (maxLevel > 0) {
          await prisma.userProgressionLevel.updateMany({
            where: { exerciseId: existingId, currentLevel: { gt: maxLevel } },
            data: { currentLevel: maxLevel },
          });
        }

        catalogExerciseIds.push(existingId);
        updatedExercises++;
      } else {
        // New exercise — create it fresh
        const exercise = await prisma.progressionExercise.create({
          data: {
            userId: ownerId,
            name: row.exercise,
            wuxiaName: row.exercise,
            difficulty: "",
            wuxiaDifficulty: "",
            type: "",
            wuxiaType: "",
            story: "",
            tips: "[]",
            category: row.category,
            equipmentType: row.equipmentOrProps,
            bodyweight,
            weighted,
            rings,
            primaryMuscles: row.muscleGroup,
            secondaryMuscles: "",
            progression: JSON.stringify(progression),
            prerequisites: "[]",
            cues: "[]",
            commonMistakes: "[]",
            breathing: "",
            safetyConsiderations: "[]",
            competitionStandards: "{}",
            assignedDays: "",
          },
          select: { id: true },
        });

        if (progression.length > 0) {
          await prisma.progressionTier.createMany({
            data: progression.map((name, index) => ({
              exerciseId: exercise.id,
              level: index + 1,
              name,
              wuxiaName: name,
              difficulty: "",
              wuxiaDifficulty: "",
              wuxiaType: "",
              description: "",
              targetHold: null,
              targetReps: null,
              targetRepsText: "",
            })),
          });
        }

        if (variations.length > 0) {
          await prisma.progressionVariation.createMany({
            data: variations.map((name) => ({
              exerciseId: exercise.id,
              name,
              wuxiaName: name,
              difficulty: "",
              wuxiaDifficulty: "",
              wuxiaType: "",
              description: "",
            })),
          });
        }

        if (setupOptions.length > 0) {
          await prisma.progressionModifier.createMany({
            data: setupOptions.map((type) => ({
              exerciseId: exercise.id,
              type,
              available: true,
              difficultyMod: 0,
              notes: "",
              method: "",
              difficultyIncrease: "",
            })),
          });
        }

        catalogExerciseIds.push(exercise.id);
        existingByName.set(row.exercise.toLowerCase(), exercise.id);
        createdExercises++;
      }
    }

    // Seed UserProgressionLevel for every non-system user × every catalog exercise.
    // upsert ensures existing levels are not overwritten; new ones start at level 1.
    const allUsers = await prisma.user.findMany({
      where: { role: { not: "system" } },
      select: { id: true },
    });

    console.log(`Seeding progression levels for ${allUsers.length} users × ${catalogExerciseIds.length} exercises...`);

    for (const user of allUsers) {
      for (const exerciseId of catalogExerciseIds) {
        await prisma.userProgressionLevel.upsert({
          where: { userId_exerciseId: { userId: user.id, exerciseId } },
          update: {},
          create: { userId: user.id, exerciseId, currentLevel: 1 },
        });
      }
    }

    console.log(`Created: ${createdExercises} new exercises, Updated: ${updatedExercises} existing exercises`);
    console.log("All users seeded with full catalog progression levels.");
    console.log("New catalog reseed complete.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("Failed to reseed new exercise catalog:", error);
  process.exitCode = 1;
});
