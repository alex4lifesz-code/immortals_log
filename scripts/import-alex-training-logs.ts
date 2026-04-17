import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";

type ParsedRow = {
  date: string;
  sourceExercise: string;
  w1: number | null;
  r1: number | null;
  w2: number | null;
  r2: number | null;
  w3: number | null;
  r3: number | null;
  notes: string;
};

type Inference = {
  canonicalExercise: string;
  progressionHint?: string;
  variantHint?: string;
  noteSuffix?: string;
};

// Alex's workout log data (from alexworkout.xlsx)
const RAW_TSV = `Date	Exercise	W1	R1	W2	R2	W3	R3	Notes
1/1/24	Lat Pulldown	50	8	50	8	50	8	
1/1/24	Cable Row	45	8	45	8	45	8	
1/1/24	Dumbbell Shoulder Press	16	8	16	8	16	8	
1/1/24	Cable Face Pull	36	9	36	9	36	9	
1/1/24	Dumbbell Lateral Raise	7	10	7	10	7	10	
1/1/24	Dumbbell Curl	9	8	9	8	9	8	
1/2/24	Barbell Bench Press	40	8	40	8	40	8	
1/2/24	Incline Barbell Bench Press	30	8	30	8	30	8	
1/2/24	Decline Barbell Bench Press	30	8	30	8	30	8	
1/2/24	Dumbbell Forearm Curl	8	10	8	10	8	10	
1/3/24	Barbell Squat	30	8	30	8	30	8	
1/3/24	Deadlift	30	8	30	8	30	8	
1/3/24	Seated Leg Extension	22.7	8	22.7	8	22.7	8	
1/3/24	Seated Leg Curl	31.7	8	31.7	8	31.7	8	
1/3/24	Calf Raise	73	8	73	8	73	8	
1/4/24	Pull Up	81	4	81	4	81	4	blue resistance (4sets)
1/4/24	Front Lever	81	3	81	3	81	3	no resistance band
1/4/24	Pull Up	81	5	81	5	81	5	blue resistance band
1/4/24	Dumbbell Curl	13	8	13	8	13	8	assisted last 2 reps last set
1/4/24	Dumbbell Lateral Raise	9	10	9	10	9	10	did 4 set
1/4/24	Planche	81.3	4	81.3	4	81.3	4	
1/4/24	Planche	81.3	4	81.3	4	81.3	4	3rd pin flat bar
1/8/24	Lat Pulldown	54	8	54	8	54	8	
1/8/24	Cable Row	50	8	50	8	50	8	
1/8/24	Dumbbell Shoulder Press	18	8	18	8	18	8	
1/8/24	Cable Face Pull	40	9	40	9	40	9	
1/8/24	Dumbbell Lateral Raise	7	10	7	10	7	10	
1/8/24	Dumbbell Curl	10	8	10	8	10	8	
1/9/24	Barbell Bench Press	50	8	50	8	50	6	
1/9/24	Incline Barbell Bench Press	30	8	30	8	30	8	
1/9/24	Decline Barbell Bench Press	30	8	30	8	30	8	
1/9/24	Dumbbell Forearm Curl	10	10	10	10	10	10	
1/10/24	Barbell Squat	40	8	40	8	40	8	
1/10/24	Deadlift	40	8	40	8	40	8	felt like vomiting
1/10/24	Seated Leg Extension	31.74	8	31.74	8	31.74	8	
1/10/24	Seated Leg Curl	40.8	8	40.8	8	40.8	8	
1/10/24	Calf Raise	82	8	82	8	82	8	did some with 10reps
1/15/24	Lat Pulldown	59	8	59	8	59	8	needed to stretch
1/15/24	Cable Row	54	8	54	8	54	8	
1/15/24	Dumbbell Shoulder Press	20	8	20	8	20	8	
1/15/24	Cable Face Pull	41	9	41	9	41	9	
1/15/24	Dumbbell Lateral Raise	7	10	7	10	7	10	
1/15/24	Dumbbell Curl	12.5	6	12.5	6	12.5	6	
1/16/24	Barbell Bench Press	50	8	50	8	50	8	
1/16/24	Incline Barbell Bench Press	30	8	30	8	30	8	
1/16/24	Decline Barbell Bench Press	30	1	0	0	0	0	felt pinch in shoulders
1/16/24	Dumbbell Forearm Curl	12.5	7	12.5	8	12.5	10	
1/17/24	Barbell Squat	60	5	60	5	60	5	weak lower back, felt nauseous
1/17/24	Deadlift	60	5	60	6	60	7	
1/17/24	Seated Leg Extension	40.8	8	40.8	8	40.8	10	
1/17/24	Seated Leg Curl	40.8	8	40.8	8	40.8	8	knee pointed towards ceiling
1/17/24	Calf Raise	91	10	91	10	91	10	felt burn/hold at the top
1/22/24	Lat Pulldown	59	8	59	8	59	8	
1/22/24	Cable Row	54	8	54	8	54	8	
1/22/24	Dumbbell Shoulder Press	20	8	20	8	20	8	no new pr cus fatigue
1/22/24	Cable Face Pull	45	9	45	9	45	9	used short rope
1/22/24	Dumbbell Lateral Raise	7	10	7	10	7	10	
1/22/24	Dumbbell Curl	12.5	9	12.5	6	12.5	7	
1/23/24	Barbell Bench Press	50	4	50	4	50	4	consumed half a red bull, 4rep(40)
1/23/24	Incline Barbell Bench Press	30	6	30	6	30	6	
1/23/24	Dumbbell Forearm Curl	15	7	15	7	15	7	
1/24/24	Barbell Squat	60	5	60	6	60	7	
1/24/24	Deadlift	60	7	60	7	60	8	
1/24/24	Seated Leg Extension	49.9	8	49.9	8	49.9	8	
1/24/24	Seated Leg Curl	49.9	8	49.9	8	49.9	8	
1/24/24	Calf Raise	91	10	91	10	91	10	return
1/29/24	Lat Pulldown	64	6	64	6	64	6	did 130 1 set prior
1/29/24	Cable Row	59	8	59	8	59	8	did 120 first set
1/29/24	Dumbbell Shoulder Press	22	8	22	8	22	8	
1/29/24	Cable Face Pull	50	8	50	8	50	8	
1/29/24	Dumbbell Lateral Raise	8	10	8	8	8	7	
1/29/24	Dumbbell Curl	15	8	15	8	15	6	3rd set used standard curls
1/30/24	Barbell Bench Press	50	7	50	7	50	7	hsp kebab redbull within 48hrs
1/30/24	Incline Barbell Bench Press	40	7	40	7	40	7	hsp kebab redbull within 48hrs
1/30/24	Dumbbell Forearm Curl	12.5	10	12.5	10	12.5	10	
1/31/24	Barbell Squat	30	8	30	8	30	8	
1/31/24	Deadlift	30	8	30	8	30	6	
1/31/24	Seated Leg Extension	31.74	8	31.74	10	31.74	10	
1/31/24	Seated Leg Curl	31.7	10	31.7	10	31.7	10	
2/5/24	Lat Pulldown	64	6	64	6	64	6	
2/5/24	Cable Row	64	7	64	7	64	7	
2/5/24	Dumbbell Shoulder Press	22	7	22	7	22	7	
2/5/24	Cable Face Pull	50	8	50	8	50	8	
2/5/24	Dumbbell Lateral Raise	8	8	8	8	8	8	
2/5/24	Dumbbell Curl	15	6	15	6	15	6	
2/6/24	Barbell Bench Press	55	6	55	7	55	7	
2/6/24	Incline Barbell Bench Press	45	4	45	4	45	4	
2/6/24	Dumbbell Forearm Curl	10	10	10	10	10	10	
2/7/24	Barbell Squat	30	8	30	8	30	8	return controlled rep, tight pecs
2/7/24	Deadlift	30	8	30	8	30	8	return controlled reps
2/7/24	Seated Leg Extension	31.74	8	31.74	8	31.74	8	return
2/7/24	Seated Leg Curl	31.7	10	31.7	10	31.7	10	return
2/12/24	Lat Pulldown	64	8	64	7	64	7	
2/12/24	Cable Row	64	8	64	8	64	8	
2/12/24	Dumbbell Shoulder Press	22	6	22	6	22	4	
2/12/24	Cable Face Pull	50	8	50	8	50	8	
2/12/24	Dumbbell Lateral Raise	7	8	7	8	7	8	
2/12/24	Dumbbell Curl	15	8	15	8	15	8	strict form, leaning to side doing 1 arm curls
2/13/24	Barbell Bench Press	60	4	60	5	60	5	warmed up with 40 8 reps
2/13/24	Incline Barbell Bench Press	40	4	40	4	40	4	extremely hungry
2/13/24	Dumbbell Forearm Curl	10	10	10	10	10	10	
2/19/24	Lat Pulldown	68	7	68	7	68	7	
2/19/24	Cable Row	68	6	68	6	68	6	used flat close grip
2/19/24	Dumbbell Shoulder Press	22	7	22	7	22	7	
2/19/24	Cable Face Pull	45	8	45	8			
2/19/24	Dumbbell Lateral Raise	7	10	7	10	7	10	
2/19/24	Dumbbell Curl	10	8	10	8	9	7	
2/20/24	Barbell Bench Press	50	6	50	6	50	6	extremely hungry
2/20/24	Incline Barbell Bench Press	40	10	40	10	40	10	home dumbbells
2/20/24	Dumbbell Forearm Curl	10	10	10	10	10	10	
2/26/24	Lat Pulldown	68	7	68	7	68	7	
2/26/24	Cable Row	68	7	68	7	68	7	
2/26/24	Dumbbell Shoulder Press	22	7	22	7	22	7	
2/26/24	Dumbbell Lateral Raise	7	8	7	8			return difficult
2/26/24	Dumbbell Curl	10	10	12.5	10	12.5	10	
2/27/24	Barbell Bench Press	60	4	60	4	60	4	
2/27/24	Incline Barbell Bench Press	40	6	40	6	40	5	gym
2/27/24	Dumbbell Forearm Curl	10	10	10	10	10	10	
3/4/24	Lat Pulldown	68	7	68	7	68	7	
3/4/24	Cable Row	68	7	68	7	68	7	
3/4/24	Dumbbell Shoulder Press	22	7	22	7	22	7	
3/4/24	Dumbbell Lateral Raise	7	10	7	10	7	10	
3/5/24	Barbell Bench Press	40	10	40	10	40	10	home dumbbells
3/5/24	Incline Barbell Bench Press	22	8	22	8	22	8	dumbbell incline
3/11/24	Lat Pulldown	64	7	64	7	64	7	
3/11/24	Cable Row	64	7	64	7	64	7	
3/11/24	Dumbbell Shoulder Press	20	8	20	8	20	8	
3/12/24	Barbell Bench Press	40	8	40	8	40	8	gym
3/12/24	Incline Barbell Bench Press	22	8	22	8	22	8	
3/18/24	Lat Pulldown	59	8	59	8	59	8	
3/18/24	Cable Row	59	8	59	8	59	8	
3/18/24	Dumbbell Shoulder Press	20	8	20	8	20	8	return felt nauseous
3/19/24	Barbell Bench Press	26	8	26	8	26	8	dumbbell flat bench
3/19/24	Incline Barbell Bench Press	30	7	30	7	30	7	
3/25/24	Lat Pulldown	68	8	68	8	68	8	return - last set was very hard
3/25/24	Cable Row	64	8	64	8	64	8	return - 2nd set was very hard
3/25/24	Dumbbell Shoulder Press	18	10	18	10	18	10	
3/26/24	Barbell Bench Press	24	8	28	8	28	8	
4/1/24	Lat Pulldown	59	10	59	10	59	10	growth
4/1/24	Cable Row	54	10	54	10	54	10	
4/2/24	Barbell Bench Press	60	6	60	6	60	6	
1/28/26	Pull Up	81.05	8	81.05	6	81.05	8	
1/28/26	Pull Up	81.05	6	81.05	6	81.05	6	
1/28/26	Dip	81.05	1	81.05	1	81.05	0	
1/29/26	Pull Up	83.6	4	83.6	4	83.6	4	
1/29/26	Pull Up	83.6	6	83.6	3	83.6	3	
1/29/26	Dragon Flag	83.6	3	83.6	3	83.6	3	
1/29/26	Dumbbell Curl	13	8	13	8	13	9	long rest breaks
1/29/26	Dumbbell Lateral Raise	9	10	9	10	9	10	
1/30/26	Dumbbell Bench Press	22	10	22	11	22	10	gyg burrito fuel
1/30/26	Pull Up	83.4	8	83.4	9	83.4	9	
1/31/26	Dip	83.4	8	83.4	9	83.4	10	
2/1/26	Front Lever	82.85	3	82.85	4	82.85	4	empty stomach black coffee
2/1/26	Barbell Squat	20	10	20	10	20	8	bar, mobility
2/1/26	Seated Leg Extension	22.7	9	22.7	9	22.7	9	
2/1/26	Cable Row	36.2	5	36.2	4	36.2	4	holds for neck posture
2/1/26	Dumbbell Shoulder Press	18	10	18	11	20	8	
2/2/26	Pull Up	83.05	9	83.05	8	83.05	8	
2/2/26	Front Lever	83.05	3	83.05	4	83.05	5	
2/2/26	Dumbbell Lateral Raise	11	10	11	11	11	12	
2/2/26	Front Lever	5	1	6	1	7	1	tucked
2/3/26	Pull Up	82.95	9	82.95	8	82.95	9	
2/3/26	Front Lever	82.95	4	82.95	5	82.95	5	
2/3/26	Dumbbell Bench Press	25	10	25	11	25	12	
2/3/26	Incline Dumbbell Bench Press	25	10	25	10	25	10	
2/3/26	Dumbbell Lateral Raise	13	7	11	10	11	10	too heavy
2/4/26	Pull Up	82.25	10	82.25	8	82.25	8	
2/5/26	Dip	82.25	9	82.25	10	82.25	10	very long break 1hr+ r3
2/5/26	Front Lever	82.25	4	82.25	5	82.25	6	gyg and coffee
2/5/26	Dumbbell Curl	13	10	13	10	13	10	r3 7-19 hard
2/5/26	Dragon Flag	82.25	6	82.25	6	82.25	6	
2/6/26	Barbell Squat	40	8	40	8	40	8	easing in
2/6/26	Cable Row	100	5	100	5	100	5	neck
2/6/26	Seated Leg Extension	40.8	8	40.8	9	40.8	8	
2/7/26	Pull Up	5	7	5	6	5	6	very hungry
2/9/26	Pull Up	5	7	5	7	5	7	
2/9/26	Front Lever	82.35	5	82.35	5	82.35	5	
2/9/26	Dip	82.35	9	82.35	10	82.35	10	
2/10/26	Front Lever	82.85	5	82.85	3	82.85	5	full
2/10/26	Pull Up	10	4	10	5	10	5	
2/10/26	Dumbbell Bench Press	27	10	27	10	27	10	
2/10/26	Incline Dumbbell Bench Press	27	10	27	10	27	10	
2/11/26	One Arm Pull Up	83.25	3	83.25	3	83.25	4	1 arm assist- w3-r4 hard
2/12/26	Front Lever	82.35	4	82.25	5	82.25	5	full
2/12/26	Front Lever	82.35	5	82.25	5	82.25	5	tucked- had better control
2/12/26	Dumbbell Curl	15	7	15	7	15	8	
2/13/26	Cable Row	110	10	110	10	110	10	neck
2/13/26	Barbell Squat	50	8	50	8	50	7	
2/13/26	Seated Leg Extension	49.9	8	49.9	8	49.9	7	
2/13/26	Dumbbell Shoulder Press	18	10	18	10	18	10	fatigued
2/13/26	Dumbbell Curl	12.5	6	10	8	10	10	gym db
2/16/26	Pull Up	5	7	5	7	5	7	no food no coffee
2/16/26	Dip	83.05	10	83.05	10	83.05	10	
2/16/26	Front Lever	83.05	4	83.05	4	83.05	4	
2/17/26	Dumbbell Bench Press	27	10	27	10	27	10	4hr sleep
2/17/26	Incline Dumbbell Bench Press	27	10	27	9	27	9	
2/18/26	Pull Up	10	6	10	6	10	6	
2/18/26	Dip	82.4	9					
2/24/26	Front Lever	80.7	4	80.7	4			
2/24/26	Dumbbell Bench Press	27	10	27	10	27	10	
2/24/26	Incline Dumbbell Bench Press	27	9	27	10	27	10	`;

function createPrismaClient() {
  const databaseUrl = process.env.DATABASE_URL || "file:./dev.db";
  const adapter = new PrismaLibSql({ url: databaseUrl });
  return new PrismaClient({ adapter });
}

function normalizeKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function parseNumber(value: string): number | null {
  const trimmed = (value || "").trim();
  if (!trimmed) return null;
  const parsed = Number.parseFloat(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseIntOrNull(value: string): number | null {
  const num = parseNumber(value);
  if (num == null) return null;
  const rounded = Math.round(num);
  return Number.isFinite(rounded) ? rounded : null;
}

/** Parse M/D/YY date format */
function parseDate(value: string): Date {
  const raw = value.trim();
  const parts = raw.split("/");
  if (parts.length !== 3) throw new Error(`Invalid date: ${value}`);
  const month = Number.parseInt(parts[0], 10) - 1; // 0-indexed
  const day = Number.parseInt(parts[1], 10);
  let year = Number.parseInt(parts[2], 10);
  if (year < 100) year += 2000;
  if (!Number.isFinite(day) || !Number.isFinite(month) || !Number.isFinite(year)) {
    throw new Error(`Invalid date parts: ${value}`);
  }
  return new Date(Date.UTC(year, month, day, 12, 0, 0));
}

function parseRows(): ParsedRow[] {
  const lines = RAW_TSV.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length <= 1) return [];
  const rows: ParsedRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split("\t");
    while (parts.length < 9) parts.push("");
    const [date, sourceExercise, w1, r1, w2, r2, w3, r3, ...rest] = parts;
    rows.push({
      date: date.trim(),
      sourceExercise: sourceExercise.trim(),
      w1: parseNumber(w1),
      r1: parseIntOrNull(r1),
      w2: parseNumber(w2),
      r2: parseIntOrNull(r2),
      w3: parseNumber(w3),
      r3: parseIntOrNull(r3),
      notes: rest.join("\t").trim(),
    });
  }

  return rows;
}

function inferMapping(sourceExercise: string, notes: string): Inference | null {
  const name = normalizeKey(sourceExercise);
  const note = normalizeKey(notes);

  // --- Pull / Back exercises ---
  if (name === "lat pulldown") return { canonicalExercise: "Lat pulldown" };
  if (name === "cable row") return { canonicalExercise: "Row", progressionHint: "Cable", variantHint: "Seated" };

  // --- Face Pull ---
  if (name === "cable face pull") return { canonicalExercise: "Face pull", progressionHint: "Cable" };

  // --- Shoulder ---
  if (name === "dumbbell shoulder press") return { canonicalExercise: "Shoulder press", progressionHint: "Dumbbell" };
  if (name === "dumbbell lateral raise") return { canonicalExercise: "Lateral raise", progressionHint: "Dumbbell" };

  // --- Bicep ---
  if (name === "dumbbell curl") {
    // Notes hint: "3rd set used standard curls" → Standard variant
    if (note.includes("1 arm curl")) return { canonicalExercise: "Bicep curl", progressionHint: "Dumbbell", variantHint: "Concentration" };
    return { canonicalExercise: "Bicep curl", progressionHint: "Dumbbell" };
  }

  // --- Bench Press ---
  // "Barbell Bench Press" → Bench press, Barbell tier, Flat variant
  if (name === "barbell bench press") {
    // Notes: "home dumbbells" or "dumbbell flat bench" → actually dumbbell
    if (note.includes("home dumbbell") || note.includes("dumbbell flat")) {
      return { canonicalExercise: "Bench press", progressionHint: "Dumbbell", variantHint: "Flat" };
    }
    return { canonicalExercise: "Bench press", progressionHint: "Barbell", variantHint: "Flat" };
  }
  if (name === "incline barbell bench press") {
    // "home dumbbells" or "dumbbell incline" → dumbbell incline
    if (note.includes("home dumbbell") || note.includes("dumbbell incline") || note.includes("dumbell incline")) {
      return { canonicalExercise: "Bench press", progressionHint: "Dumbbell", variantHint: "Incline" };
    }
    return { canonicalExercise: "Bench press", progressionHint: "Barbell", variantHint: "Incline" };
  }
  if (name === "decline barbell bench press") return { canonicalExercise: "Bench press", progressionHint: "Barbell", variantHint: "Decline" };
  if (name === "dumbbell bench press") return { canonicalExercise: "Bench press", progressionHint: "Dumbbell", variantHint: "Flat" };
  if (name === "incline dumbbell bench press") return { canonicalExercise: "Bench press", progressionHint: "Dumbbell", variantHint: "Incline" };

  // --- Forearm ---
  if (name === "dumbbell forearm curl") return { canonicalExercise: "Forearm curl", progressionHint: "Dumbbell" };

  // --- Legs ---
  if (name === "barbell squat") return { canonicalExercise: "Squat", progressionHint: "Barbell", variantHint: "Back" };
  if (name === "deadlift") return { canonicalExercise: "Deadlift", progressionHint: "Conventional" };
  if (name === "seated leg extension") return { canonicalExercise: "Leg extension", progressionHint: "Seated" };
  if (name === "seated leg curl") return { canonicalExercise: "Leg curl", progressionHint: "Seated" };
  if (name === "calf raise") return { canonicalExercise: "Calf raise" };

  // --- Calisthenics ---
  // Pull Up: weight values around 81-84 = bodyweight (BW). Notes give context.
  // "blue resistance (4sets)" → Assisted tier
  // "blue resistance band" → Assisted tier
  // Weight ~5-10 = weighted pull-ups (added weight in kg)
  if (name === "pull up") {
    if (note.includes("blue resistance") || note.includes("resistance band")) {
      return { canonicalExercise: "Pull up", progressionHint: "Assisted" };
    }
    return { canonicalExercise: "Pull up", progressionHint: "Weighted" };
  }
  if (name === "one arm pull up") return { canonicalExercise: "Pull up", progressionHint: "One Arm Assisted", noteSuffix: "1 arm assisted" };

  if (name === "front lever") {
    if (note.includes("tucked")) return { canonicalExercise: "Front lever", progressionHint: "Tuck Hold" };
    if (note.includes("full")) return { canonicalExercise: "Front lever", progressionHint: "Full Hold" };
    return { canonicalExercise: "Front lever", progressionHint: "Full Hold" };
  }

  if (name === "planche") return { canonicalExercise: "Planche" };

  if (name === "dragon flag") return { canonicalExercise: "Dragon flag", progressionHint: "Full" };

  if (name === "dip") return { canonicalExercise: "Dip", progressionHint: "Standard" };

  return null;
}

function bestTierLevel(
  tiers: Array<{ level: number; name: string }>,
  progressionHint: string | undefined,
): number {
  if (!tiers || tiers.length === 0) return 1;
  if (!progressionHint) return tiers[0].level;

  const hint = normalizeKey(progressionHint);
  const direct = tiers.find((tier) => normalizeKey(tier.name) === hint);
  if (direct) return direct.level;

  const fuzzy = tiers.find((tier) => {
    const t = normalizeKey(tier.name);
    return t.includes(hint) || hint.includes(t);
  });
  if (fuzzy) return fuzzy.level;

  return tiers[0].level;
}

function bestVariantName(
  variations: Array<{ name: string }>,
  variantHint: string | undefined,
): string | null {
  if (!variantHint) return null;
  if (!variations || variations.length === 0) return variantHint;

  const hint = normalizeKey(variantHint);
  const direct = variations.find((v) => normalizeKey(v.name) === hint);
  if (direct) return direct.name;

  const fuzzy = variations.find((v) => {
    const key = normalizeKey(v.name);
    return key.includes(hint) || hint.includes(key);
  });
  if (fuzzy) return fuzzy.name;

  return variantHint;
}

async function main() {
  const prisma = createPrismaClient();

  try {
    const admin = await prisma.user.findFirst({
      where: { role: "admin" },
      select: { id: true, username: true, name: true },
    });

    if (!admin) {
      throw new Error("Could not find admin user.");
    }

    console.log(`Admin user: ${admin.username || admin.name} (${admin.id})`);

    const exercises = await prisma.progressionExercise.findMany({
      include: {
        tiers: { select: { level: true, name: true }, orderBy: { level: "asc" } },
        variations: { select: { name: true }, orderBy: { name: "asc" } },
      },
    });

    const exerciseByName = new Map<string, (typeof exercises)[number]>();
    for (const exercise of exercises) {
      exerciseByName.set(normalizeKey(exercise.name), exercise);
    }

    const rows = parseRows();
    console.log(`Parsed ${rows.length} rows from spreadsheet.`);

    let inserted = 0;
    let skippedDuplicates = 0;
    let unmapped = 0;
    const unmappedNames = new Set<string>();
    const exercisesTouched = new Map<string, { tier: number; variant: string | null }>();

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const inferred = inferMapping(row.sourceExercise, row.notes);
      if (!inferred) {
        unmapped++;
        unmappedNames.add(row.sourceExercise);
        continue;
      }

      const exercise = exerciseByName.get(normalizeKey(inferred.canonicalExercise));
      if (!exercise) {
        unmapped++;
        unmappedNames.add(`${row.sourceExercise} -> ${inferred.canonicalExercise} (missing in library)`);
        continue;
      }

      const level = bestTierLevel(exercise.tiers, inferred.progressionHint);
      const variant = bestVariantName(exercise.variations, inferred.variantHint);

      const userProgress = await prisma.userProgressionLevel.upsert({
        where: {
          userId_exerciseId: {
            userId: admin.id,
            exerciseId: exercise.id,
          },
        },
        update: {},
        create: {
          userId: admin.id,
          exerciseId: exercise.id,
          currentLevel: level,
        },
        select: { id: true },
      });

      exercisesTouched.set(exercise.name, { tier: level, variant });

      const baseDate = parseDate(row.date);
      const createdAt = new Date(baseDate.getTime() + i * 1000);
      const dayStart = new Date(Date.UTC(baseDate.getUTCFullYear(), baseDate.getUTCMonth(), baseDate.getUTCDate(), 0, 0, 0));
      const dayEnd = new Date(Date.UTC(baseDate.getUTCFullYear(), baseDate.getUTCMonth(), baseDate.getUTCDate(), 23, 59, 59));

      const finalNotes = [row.notes, inferred.noteSuffix].filter(Boolean).join(" | ").trim() || null;

      // Check for duplicate
      const existing = await prisma.progressionLog.findFirst({
        where: {
          userProgressionId: userProgress.id,
          level,
          createdAt: { gte: dayStart, lte: dayEnd },
          weight1: row.w1,
          reps1: row.r1,
          weight2: row.w2,
          reps2: row.r2,
          weight3: row.w3,
          reps3: row.r3,
          variant,
          notes: finalNotes,
        },
        select: { id: true },
      });

      if (existing) {
        skippedDuplicates++;
        continue;
      }

      await prisma.progressionLog.create({
        data: {
          userProgressionId: userProgress.id,
          level,
          weight1: row.w1,
          reps1: row.r1,
          weight2: row.w2,
          reps2: row.r2,
          weight3: row.w3,
          reps3: row.r3,
          modifier: null,
          variant,
          notes: finalNotes,
          completed: false,
          createdAt,
        },
      });

      inserted++;
    }

    console.log("\n=== Alex import complete ===");
    console.log(`User: ${admin.username || admin.name} (${admin.id})`);
    console.log(`Rows parsed: ${rows.length}`);
    console.log(`Inserted logs: ${inserted}`);
    console.log(`Skipped as duplicates: ${skippedDuplicates}`);
    console.log(`Unmapped rows: ${unmapped}`);
    if (unmappedNames.size > 0) {
      console.log(`Unmapped labels: ${JSON.stringify(Array.from(unmappedNames).sort())}`);
    }
    console.log(`\nExercises touched:`);
    for (const [name, info] of Array.from(exercisesTouched.entries()).sort()) {
      console.log(`  ${name} → tier ${info.tier}${info.variant ? `, variant: ${info.variant}` : ""}`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
