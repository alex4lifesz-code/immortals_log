import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";

type CatalogRow = {
  category: "Calisthenics" | "Yoga" | "Gym";
  exercise: string;
  muscleGroup: string;
  equipmentOrProps: string;
  setupOptions: string[];
  progression: string[];
  variations: string[];
};

type MergeRule = {
  sourceName: string;
  targetName: string;
  targetVariant?: string;
};

const CALISTHENICS_TABLE = `
| Category | Exercise | Muscle Group | Equipment | Grip | Progression | Variation |
|----------|----------|--------------|-----------|------|-------------|-----------|
| Calisthenics | Pull up | Back, Biceps | Bar, Rings, Rope | Standard, False, Thumbless, Overhand, Underhand, Mixed, Neutral | Scapular pull, Dead hang, Band assisted, Eccentric only, Standard, Strict, Weighted, One arm assisted, One arm negative, One arm | Wide, Close, Chin up, Archer, Typewriter, L-sit, Commando, Chest to bar, Behind the neck, Explosive, Kipping, Clapping |
| Calisthenics | Muscle up | Back, Chest, Triceps | Bar, Rings | Standard, False, Thumbless, Overhand | Jump assisted, Band assisted, Negative only, Standard, Slow, Weighted, Explosive | Wide, Close, Kipping, Strict, L-sit, Behind the neck, Impossible, Typewriter, Clapping |
| Calisthenics | Dip | Chest, Triceps, Shoulders | Parallel bars, Rings, Straight bar, Machine | Standard, False, Thumbless | Bench, Negative, Band assisted, Standard, Weighted, Assisted | Parallel, Korean, L-sit, Russian, Archer, Bulgarian, Impossible |
| Calisthenics | Push up | Chest, Triceps, Shoulders | Floor, Rings, Parallettes | Standard, Fingertip, Knuckle | Incline, Knee, Standard, Decline, Weighted | Wide, Diamond, Archer, One arm, Clapping, Planche, Pike, Pseudo planche, Explosive, Typewriter, Staggered, Spiderman, Hindu |
| Calisthenics | Front lever | Back, Core | Bar, Rings | Standard, False, Thumbless, Overhand | Tuck, Advanced tuck, One leg, Straddle, Full | Pulls, Raises, Ice cream maker, Touch, Rows |
| Calisthenics | Back lever | Chest, Shoulders, Core | Bar, Rings | Standard, False, Thumbless, Overhand | Tuck, Advanced tuck, One leg, Straddle, Full | Pulls, Raises, Press to, Touch, Rows |
| Calisthenics | Handstand | Shoulders, Core | Floor, Parallettes, Blocks | Standard, Fingertip | Wall, Chest to wall, Freestanding, One arm | Tuck, Straddle, Pike, Full, Press to, Walking, Pirouette, Scorpion, Lotus |
| Calisthenics | Handstand push up | Shoulders, Triceps | Floor, Parallettes | Standard, Fingertip | Wall, Negative, Standard, Weighted | Chest to wall, Back to wall, Freestanding, Deficit, Close, Wide |
| Calisthenics | Planche | Shoulders, Chest, Core | Floor, Parallettes | Standard, Fingertip | Tuck, Advanced tuck, Straddle, Full | Press, Bent arm, Straight arm |
| Calisthenics | Hang | Grip, Shoulders, Core | Bar, Rings | Standard, False, Thumbless, Overhand, Underhand, Mixed | Dead hang, Active hang, One arm assisted, One arm | Wide, Close, Archer |
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
`;

const YOGA_TABLE = `
| Category | Exercise | Muscle Group | Props | Progression | Variation |
|----------|----------|--------------|-------|-------------|-----------|
| Yoga | Warrior III | Legs, Core | Block, Mat | Kickstand, Wall supported, Full expression | Arms forward, Arms back, Arms wide, Half moon transition, Revolved, Airplane |
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
| Yoga | Plank pose | Core, Shoulders | Mat | Standard, Full expression | Low, High, Side |
| Yoga | Four limbed staff pose | Arms, Core | Mat | Standard, Full expression | Low, Chaturanga, One leg |
| Yoga | Wild thing | Back, Chest, Shoulders | Mat | Standard, Full expression | Baby, Full, Twisted |
| Yoga | Bridge pose | Back, Glutes | Block, Mat | Standard, Full expression | Supported, Full, Revolved |
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
| Gym | Row | Back, Biceps | Dumbbell, Barbell, Cable, Machine, Smith machine, T-bar | Standard, Wide, Close, Neutral, Reverse, Mixed | Bent over, Pendlay, Seal, Meadows, Kroc, Gorilla, Helms, One arm, Chest supported, Inverted, Seated, Standing, High, Low |
| Gym | Lat pulldown | Back, Biceps | Cable, Machine | Standard, Wide, Close, Neutral, Reverse | V-bar, Single arm, Straight arm, Behind the neck |
| Gym | Chest fly | Chest | Dumbbell, Cable, Machine | Standard, Neutral | Flat, Incline, Decline, Standing, High to low, Low to high |
| Gym | Good morning | Hamstrings, Back, Glutes | Barbell, Dumbbell, Machine, Cable | Standard, Wide, Close, Snatch | Sumo, Single leg, Seated, Zercher |
| Gym | Leg curl | Hamstrings | Machine, Dumbbell, Cable, Barbell | N/A | Lying, Seated, Standing, Single leg, Nordic |
| Gym | Leg extension | Quads | Machine, Dumbbell, Cable | N/A | Seated, Single leg |
| Gym | Leg press | Quads, Glutes | Machine, Bodyweight, Cable | Standard, Wide, Close | Single leg, Narrow, Sumo |
| Gym | Lunge | Quads, Glutes | Dumbbell, Barbell, Smith machine, Kettlebell | Standard, Neutral | Walking, Reverse, Lateral, Deficit, Curtsy, Bulgarian |
| Gym | Hip thrust | Glutes, Hamstrings | Dumbbell, Barbell, Machine, Kettlebell | N/A | Single leg, Elevated, B stance, Feet elevated |
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
| Gym | Landmine row | Back, Biceps | Landmine | Standard, Neutral | Single arm, Meadows, Chest supported |
| Gym | Landmine press | Chest, Shoulders | Landmine | Standard, Neutral | Single arm, Kneeling, Half kneeling |
| Gym | Landmine twist | Core, Obliques | Landmine | N/A | Rotational, Anti-rotation |
| Gym | Landmine squat | Quads, Glutes | Landmine | Standard, Wide, Close | Sumo, Goblet, Single leg |
| Gym | Landmine deadlift | Hamstrings, Glutes | Landmine | Standard, Wide | Romanian, Single leg, Sumo |
`;

const REMOVED_DUPLICATE_MERGES: MergeRule[] = [
  { sourceName: "EZ bar curl", targetName: "Bicep curl" },
  { sourceName: "EZ bar tricep extension", targetName: "Tricep extension" },
  { sourceName: "Dumbbell press", targetName: "Bench press" },
  { sourceName: "Dumbbell row", targetName: "Row" },
  { sourceName: "Dumbbell shoulder press", targetName: "Shoulder press" },
  { sourceName: "Bicep cable curl", targetName: "Bicep curl" },
  { sourceName: "Smith machine bench press", targetName: "Bench press" },
  { sourceName: "Smith machine squat", targetName: "Squat" },
  { sourceName: "Smith machine deadlift", targetName: "Deadlift" },
  { sourceName: "Smith machine shoulder press", targetName: "Shoulder press" },
  { sourceName: "Smith machine row", targetName: "Row" },
  { sourceName: "Pistol squat", targetName: "Squat", targetVariant: "Pistol" },
  { sourceName: "Shrimp squat", targetName: "Squat", targetVariant: "Shrimp" },
  { sourceName: "Cossack squat", targetName: "Squat", targetVariant: "Cossack" },
  { sourceName: "Sissy squat", targetName: "Squat", targetVariant: "Sissy" },
  { sourceName: "Hindu squat", targetName: "Squat", targetVariant: "Hindu" },
  { sourceName: "Chin up", targetName: "Pull up", targetVariant: "Chin up" },
  { sourceName: "Typewriter pull up", targetName: "Pull up", targetVariant: "Typewriter" },
  { sourceName: "Front lever row", targetName: "Front lever", targetVariant: "Rows" },
  { sourceName: "Romanian deadlift", targetName: "Deadlift", targetVariant: "Romanian" },
  { sourceName: "Hack squat", targetName: "Squat", targetVariant: "Hack" },
  { sourceName: "Dip machine", targetName: "Dip", targetVariant: "Assisted" },
  { sourceName: "Pull up machine", targetName: "Pull up", targetVariant: "Band assisted" },
  { sourceName: "Cable row", targetName: "Row", targetVariant: "Seated" },
  { sourceName: "Ring push up", targetName: "Push up", targetVariant: "Standard" },
  { sourceName: "Ring row", targetName: "Inverted row", targetVariant: "Standard" },
  { sourceName: "Ring support hold", targetName: "Support hold", targetVariant: "Standard" },
  { sourceName: "Yoga Handstand", targetName: "Handstand", targetVariant: "Standard" },
];

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
    (line) => !line.includes("Category") && !line.includes("---"),
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
        category: "Yoga",
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
      rows.push({
        category: "Gym",
        exercise: cols[1],
        muscleGroup: cols[2],
        equipmentOrProps: cols[3],
        setupOptions: parseList(cols[4]),
        progression: ["Standard"],
        variations: parseList(cols[5]),
      });
      continue;
    }

    if (cols.length < 7) continue;
    rows.push({
      category: "Calisthenics",
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

function normalizeName(value: string): string {
  return value.trim().toLowerCase();
}

function shouldKeepExercise(name: string, keepSet: Set<string>): boolean {
  const normalized = normalizeName(name);
  if (keepSet.has(normalized)) return true;
  return normalized.includes("netball");
}

async function moveLogsToTarget(
  prisma: PrismaClient,
  sourceExerciseId: string,
  targetExerciseId: string,
  targetVariant?: string,
) {
  const sourceLevels = await prisma.userProgressionLevel.findMany({
    where: { exerciseId: sourceExerciseId },
    select: { id: true, userId: true, currentLevel: true },
  });

  let movedLogs = 0;

  for (const sourceLevel of sourceLevels) {
    const existingTarget = await prisma.userProgressionLevel.findUnique({
      where: {
        userId_exerciseId: {
          userId: sourceLevel.userId,
          exerciseId: targetExerciseId,
        },
      },
      select: { id: true, currentLevel: true },
    });

    let targetLevelId: string;
    if (existingTarget) {
      targetLevelId = existingTarget.id;
      if (sourceLevel.currentLevel > existingTarget.currentLevel) {
        await prisma.userProgressionLevel.update({
          where: { id: existingTarget.id },
          data: { currentLevel: sourceLevel.currentLevel },
        });
      }
    } else {
      const created = await prisma.userProgressionLevel.create({
        data: {
          userId: sourceLevel.userId,
          exerciseId: targetExerciseId,
          currentLevel: sourceLevel.currentLevel,
        },
        select: { id: true },
      });
      targetLevelId = created.id;
    }

    const logs = await prisma.progressionLog.findMany({
      where: { userProgressionId: sourceLevel.id },
      select: { id: true, variant: true },
    });

    for (const log of logs) {
      await prisma.progressionLog.update({
        where: { id: log.id },
        data: {
          userProgressionId: targetLevelId,
          variant: log.variant?.trim() ? log.variant : (targetVariant ?? log.variant),
        },
      });
      movedLogs += 1;
    }
  }

  if (sourceLevels.length > 0) {
    await prisma.userProgressionLevel.deleteMany({ where: { exerciseId: sourceExerciseId } });
  }

  return movedLogs;
}

async function syncExerciseRow(prisma: PrismaClient, ownerId: string, row: CatalogRow, nameToId: Map<string, string>) {
  const { bodyweight, weighted, rings } = inferFlags(row);
  const progression = dedupe(row.progression.length > 0 ? row.progression : ["Standard"]);
  const variations = dedupe(row.variations);
  const setupOptions = dedupe(row.setupOptions);

  const key = normalizeName(row.exercise);
  const existingId = nameToId.get(key);

  const applyChildren = async (exerciseId: string) => {
    await prisma.progressionTier.deleteMany({ where: { exerciseId } });
    await prisma.progressionVariation.deleteMany({ where: { exerciseId } });
    await prisma.progressionModifier.deleteMany({ where: { exerciseId } });

    if (progression.length > 0) {
      await prisma.progressionTier.createMany({
        data: progression.map((name, index) => ({
          exerciseId,
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
          exerciseId,
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
          exerciseId,
          type,
          available: true,
          difficultyMod: 0,
          notes: "",
          method: "",
          difficultyIncrease: "",
        })),
      });
    }

    if (progression.length > 0) {
      await prisma.userProgressionLevel.updateMany({
        where: { exerciseId, currentLevel: { gt: progression.length } },
        data: { currentLevel: progression.length },
      });
    }
  };

  if (existingId) {
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
    await applyChildren(existingId);
    return { id: existingId, created: false };
  }

  const created = await prisma.progressionExercise.create({
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

  await applyChildren(created.id);
  return { id: created.id, created: true };
}

async function main() {
  const prisma = createPrismaClient();

  try {
    const caliRows = parseMarkdownTable(CALISTHENICS_TABLE, "cali");
    const yogaRows = parseMarkdownTable(YOGA_TABLE, "yoga");
    const gymRows = parseMarkdownTable(GYM_TABLE, "gym");
    const rows = [...caliRows, ...yogaRows, ...gymRows];

    const canonicalNames = new Set(rows.map((row) => normalizeName(row.exercise)));

    const ownerId = await ensureLibraryOwner(prisma);

    const existingExercises = await prisma.progressionExercise.findMany({
      select: { id: true, name: true },
    });

    const nameToId = new Map<string, string>();
    for (const ex of existingExercises) {
      const key = normalizeName(ex.name);
      if (!nameToId.has(key)) nameToId.set(key, ex.id);
    }

    let createdExercises = 0;
    let updatedExercises = 0;

    for (const row of rows) {
      const result = await syncExerciseRow(prisma, ownerId, row, nameToId);
      nameToId.set(normalizeName(row.exercise), result.id);
      if (result.created) createdExercises += 1;
      else updatedExercises += 1;
    }

    let movedLogs = 0;
    let mergedExercises = 0;

    for (const rule of REMOVED_DUPLICATE_MERGES) {
      const sourceId = nameToId.get(normalizeName(rule.sourceName));
      const targetId = nameToId.get(normalizeName(rule.targetName));
      if (!sourceId || !targetId || sourceId === targetId) continue;

      movedLogs += await moveLogsToTarget(prisma, sourceId, targetId, rule.targetVariant);
      await prisma.progressionExercise.delete({ where: { id: sourceId } });
      nameToId.delete(normalizeName(rule.sourceName));
      mergedExercises += 1;
    }

    const postMergeExercises = await prisma.progressionExercise.findMany({
      select: { id: true, name: true },
    });

    const toDelete = postMergeExercises.filter((exercise) => !shouldKeepExercise(exercise.name, canonicalNames));

    let removedExercises = 0;
    for (const exercise of toDelete) {
      await prisma.progressionExercise.delete({ where: { id: exercise.id } });
      removedExercises += 1;
    }

    console.log("Exercise catalog reconciliation complete.");
    console.log(`Catalog rows: ${rows.length}`);
    console.log(`Created exercises: ${createdExercises}`);
    console.log(`Updated exercises: ${updatedExercises}`);
    console.log(`Merged duplicate exercises: ${mergedExercises}`);
    console.log(`Moved logs: ${movedLogs}`);
    console.log(`Removed out-of-list exercises (excluding Netball): ${removedExercises}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("Failed to reconcile exercise catalog:", error);
  process.exitCode = 1;
});
