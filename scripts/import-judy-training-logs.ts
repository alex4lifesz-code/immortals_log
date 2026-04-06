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

const RAW_TSV = `Date	Judy-Exercise	W1	R1	W2	R2	W3	R3	Notes
29-Jan-26	Lat Pulldown	30	12	40	8	50	6	Trying to do as heavy as I can so I can do a pull up :)
29-Jan-26	Seated Cable Row	25	12	30	8	42.5	6	
29-Jan-26	Cable Face Pulls	8	12	11	12	13	12	
29-Jan-26	Machine Row	10	12	20	12	30	8	Underarm Grip
29-Jan-26	EB Bicep Curl  (Ezy Bar)	10	12	10	15	10	15	Outer/Inner Grip
29-Jan-26	Hammer Curl	8	12	8	12	8	15	
29-Jan-26	Cable Bicep Curl	6	12	8	12	10	12	Straight or bent bar
30-Jan-26	DB Shoulder Press	10	8	12.5	8	15	6	
30-Jan-26	DB Lateral Raises	6	12	6	12	6	15	
30-Jan-26	Front Raises	4	12	4	12	4	15	
30-Jan-26	1-Arm Cable Tricep Pushdowns	2.5	12	2.5	12	2.5	12	Single Arm with Cable
30-Jan-26	Cable Tricep Pushdowns	13.5	12	17.5	12	22.5	12	V Bar
30-Jan-26	Cable Face Pulls	13.5	12	22.5	12	27.5	12	
30-Jan-26	Cable Rear Delt	2.5	12	2.5	12	2.5	12	
30-Jan-26	Assisted Pull Ups	35	6	35	6	25	6	
31-Jan-26	Hamstring Curls	15	12	20	12	20	15	
31-Jan-26	Cable Rear Delt	2.5	12	2.5	12	2.5	12	
31-Jan-26	Cable Bicep Curl	11	12	11	12	11	15	Rope Attachment
31-Jan-26	1-Arm Cable Tricep Pushdowns	2.5	12	2.5	12	2.5	12	Single Arm with Cable
2-Feb-26	DB Shoulder Press	12	12	14	8	14	8	
2-Feb-26	DB Lateral Raises	6	12	6	12	6	12	
2-Feb-26	Front Raises	4	12	4	12	4	12	
2-Feb-26	1-Arm Cable Tricep Pushdowns	2.5	12	2.5	12	2.5	12	
2-Feb-26	Cable Tricep Pushdowns	13.5	12	17.5	12	22.5	12	
2-Feb-26	Cable Face Pulls	13.5	12	22.5	12	27.5	12	
2-Feb-26	Cable Rear Delt	2.5	12	2.5	12	2.5	12	
3-Feb-26	Lat Pulldown	30	12	37.5	12	40	10	
3-Feb-26	Seated Cable Row	25	12	30	8	42.5	6	
3-Feb-26	Cable Face Pulls	8.25	12	13	12	20	8	
3-Feb-26	Machine Row	15	12	20	12	30	6	
3-Feb-26	EB Bicep Curl  (Ezy Bar)	10	12	10	12	10	12	Inner and outer
3-Feb-26	Hammer Curl	7.5	12	7.5	12	7.5	12	
4-Feb-26	Leg Press	35	12	42.5	12	42.5	20	
4-Feb-26	BB Squats	40	8	50	8	60	2	
4-Feb-26	Single-Leg Extensions	8	15	10.5	15	13	15	Each Leg
4-Feb-26	Seated Leg Extensions	8	25	10.5	25	13	25	
4-Feb-26	Hip Abduction - (Leaning Back)	50	12	60	12	80	12	
4-Feb-26	Hip Abduction - (Leaning Forward)	50	12	60	12	80	12	
4-Feb-26	Hip Abduction - (Pulses)	50	12	60	12	80	12	
4-Feb-26	Hanging Leg Raises	0	15	0	15	0	15	
5-Feb-26	DB Bench Press	10	12	12.5	10	15	10	
5-Feb-26	Chest Fly (Machine & Cable)	5	12	10	12	12.5	12	
5-Feb-26	DB Lateral Raises	5	12	5	12	5	12	
5-Feb-26	Rear Delt Flys	1.25	12	1.25	12	1.25	12	
5-Feb-26	Hanging Leg Raises	0	15	0	15	0	15	
6-Feb-26	Lat Pulldown	22	12	30	12	45	12	
6-Feb-26	Machine Row	10	12	20	12	30	6	Each arm
6-Feb-26	Overhead Lat Pulldowns	6	12	9	12	9	12	
6-Feb-26	DB Hammer Curl	8	12	8	12	8	12	
6-Feb-26	EB Bicep Curl  (Ezy Bar)	13	12	13	12	13	12	Inner and outer
6-Feb-26	Assisted Pull Ups	35	6	35	6	25	6	
8-Feb-26	Hanging Leg Raises	0	15	0	15	0	15	
8-Feb-26	Lat Pulldown	22	12	30	12	45	12	
8-Feb-26	Machine Row	10	12	20	12	30	6	Each Arm
8-Feb-26	Cable Face Pulls	8.25	12	13	12	20	12	
8-Feb-26	EB Bicep Curl  (Ezy Bar)	10	12	10	12	10	12	
8-Feb-26	Hammer Curl	8	12	8	12	8	12	
8-Feb-26	Cable Bicep Curl	6	12	12.5	12	12.5	12	
9-Feb-26	DB Shoulder Press	12	12	14	10	14	10	
9-Feb-26	DB Lateral Raises	7	12	7	12	7	12	
9-Feb-26	Front Raises	4	12	4	12	4	12	
9-Feb-26	Rear Delt Flys	1.25	12	1.25	12	1.25	12	
9-Feb-26	Cable Face Pulls	8.25	12	13	12	20	12	
10-Feb-26	Lat Pulldown	30	12	40	8	40	8	
10-Feb-26	Machine Row	20	12	25	12	30	8	Each Arm
10-Feb-26	Cable Face Pulls	8.25	12	13	12	20	12	
10-Feb-26	EB Bicep Curl  (Ezy Bar)	10	12	10	12	10	12	Inner and outer
10-Feb-26	Hammer Curl	8	12	8	12	8	12	Lets do heavier next time!
10-Feb-26	Overhead Lat Pulldowns	6	12	12	12	12	12	
11-Feb-26	Pendulum Squat	37	8	37	8	47	6	37kg is the machine without weight, that shit heavy
11-Feb-26	B Stance RDL	30	12	40	12	40	12	Each leg
11-Feb-26	Cable Kickbacks	1.25	12	1.25	12	1.25	12	Each leg
11-Feb-26	Negative Pull Ups	0	3	0	3	0	3	
11-Feb-26	Seated Leg Extensions	5	12	8	12	12	12	Each leg, then both legs till failure
11-Feb-26	Hip Abduction - (Leaning Forward)	50	12	70	12	80	12	
11-Feb-26	Hip Abduction - (Leaning Back)	50	12	70	12	80	12	
11-Feb-26	Hip Abduction - (Pulses)	50	12	70	12	80	12	
13-Feb-26	T-Bar 	10	8	10	8	10	8	
13-Feb-26	BB Row	30	12	30	12	30	12	
13-Feb-26	Lat Pulldown	30	12	40	8	40	8	
13-Feb-26	Machine Row	10	8	10	8	10	12	Each Arm
13-Feb-26	Cable Face Pulls	8.25	12	13	12	20	12	
13-Feb-26	EB Bicep Curl  (Ezy Bar)	10	12	10	12	10	12	
13-Feb-26	Hammer Curl	8	12	8	12	8	12	
14-Feb-26	Incline DB Bench Press (45)	10	12	12.5	10	15	10	
14-Feb-26	Chest Fly (Machine & Cable)	5	10	10	12	12	12	
14-Feb-26	1-Arm Cable Tricep Pushdowns	2.5	12	2.5	12	2.5	12	Each Arm
14-Feb-26	Cable Tricep Pushdowns	10	15	12.5	15	12.5	15	
16-Feb-26	DB Shoulder Press	10	10	12	10	14	8	
16-Feb-26	DB Lateral Raises	8	12	7	12	7	12	
16-Feb-26	Front Raises	4	12	4	12	4	12	
16-Feb-26	Cable Tricep Pushdowns	11.25	20	13.75	15	16.25	15	
16-Feb-26	1-Arm Cable Tricep Pushdowns	1.25	12	3.25	12	3.25	12	
16-Feb-26	Cable Face Pulls	11.25	12	13.75	12	16.25	12	
17-Feb-26	Lat Pulldown	27.5	10	35	10	42.5	8	Bear grip
17-Feb-26	Lat Pulldown	20	12	35	10	50	6	Close grip
17-Feb-26	DB Hammer Curl	9	12	9	12	9	12	
17-Feb-26	EB Bicep Curl  (Ezy Bar)	10	12	10	12	10	12	
17-Feb-26	Overhead Lat Pulldowns	8.75	10	11.25	10	12.5	10	
17-Feb-26	Cable Face Pulls	11.25	10	13.75	10	16.25	10	
20-Feb-26	Lat Pulldown	35	10	42.5	8	50	6	
20-Feb-26	Seated Cable Row	27.5	12	35	12	42.5	12	
20-Feb-26	Machine Row	20	12	25	12	35	12	
20-Feb-26	Rear Delt Flys	5	12	12	12	12	12	
20-Feb-26	Hammer Curl	10	10	10	10	10	10	
20-Feb-26	EB Bicep Curl  (Ezy Bar)	10	10	12.5	8	12.5	8	
1-Mar-26	DB Shoulder Press	10	10	12	10	14	8	
1-Mar-26	DB Lateral Raises	8	12	7	12	7	12	
1-Mar-26	Front Raises	4	12	4	12	4	12	
1-Mar-26	Cable Tricep Pushdowns	11.25	20	13.75	15	16.25	15	
1-Mar-26	1-Arm Cable Tricep Pushdowns	1.25	12	3.25	12	3.25	12	
1-Mar-26	Cable Face Pulls	11.25	12	13.75	12	16.25	12	
2-Mar-26	Lat Pulldown	27.5	10	35	10	42.5	8	Bear Grip
2-Mar-26	Lat Pulldown	20	12	35	10	50	6	Close Grip
2-Mar-26	DB Hammer Curl	9	12	9	12	9	12	
2-Mar-26	EB Bicep Curl  (Ezy Bar)	10	12	10	12	10	12	
2-Mar-26	Overhead Lat Pulldowns	8.75	10	11.25	10	12.5	10	
2-Mar-26	Cable Face Pulls	11.25	10	13.75	10	16.25	10	
4-Mar-26	BB Squats	30	8	40	6	40	8	
4-Mar-26	Leg Press	60	10	80	8	80	8	
4-Mar-26	Romanian Deadlifts	18	10	28	10	28	10	
4-Mar-26	Hip Abduction - (Leaning Back)	50	12	70	12	80	12	
4-Mar-26	Hip Abduction - (Leaning Forward)	50	12	70	12	80	12	
4-Mar-26	Hip Abduction - (Pulses)	50	12	70	12	80	12	
5-Mar-26	DB Shoulder Press	10	10	12	10	14	8	
5-Mar-26	DB Lateral Raises	8	12	7	12	7	12	
5-Mar-26	Front Raises	4	12	4	12	4	12	
5-Mar-26	Cable Tricep Pushdowns	11.25	20	13.75	15	16.25	15	
5-Mar-26	1-Arm Cable Tricep Pushdowns	1.25	12	3.25	12	3.25	12	
5-Mar-26	Cable Face Pulls	11.25	12	13.75	12	16.25	12	
6-Mar-26	Lat Pulldown	35	10	42.5	8	50	6	
6-Mar-26	Seated Cable Row	27.5	12	35	12	42.5	12	
6-Mar-26	Machine Row	20	12	25	12	35	12	
6-Mar-26	Rear Delt Flys	5	12	12	12	12	12	
6-Mar-26	Hammer Curl	10	10	10	10	10	10	
6-Mar-26	EB Bicep Curl  (Ezy Bar)	10	10	12.5	8	12.5	8	
9-Mar-26	DB Shoulder Press	10	10	12	10	14	8	
9-Mar-26	DB Lateral Raises	8	12	7	12	7	12	
9-Mar-26	Front Raises	4	12	4	12	4	12	
9-Mar-26	Cable Tricep Pushdowns	11.25	20	13.75	15	16.25	15	
9-Mar-26	1-Arm Cable Tricep Pushdowns	1.25	12	3.25	12	3.25	12	
9-Mar-26	Cable Face Pulls	11.25	12	13.75	12	16.25	12	
10-Mar-26	Lat Pulldown	35	10	42.5	8	50	6	
10-Mar-26	Seated Cable Row	27.5	12	35	12	42.5	12	
10-Mar-26	Machine Row	20	12	25	12	35	12	
10-Mar-26	Rear Delt Flys	5	12	12	12	12	12	
10-Mar-26	Hammer Curl	10	10	10	10	10	10	
10-Mar-26	EB Bicep Curl  (Ezy Bar)	10	10	12.5	8	12.5	8	
11-Mar-26	BB Squats	30	8	40	6	40	8	
11-Mar-26	Leg Press	60	10	80	8	80	8	
11-Mar-26	Romanian Deadlifts	18	10	28	10	28	10	
11-Mar-26	Hip Abduction - (Leaning Back)	50	12	70	12	80	12	
11-Mar-26	Hip Abduction - (Leaning Forward)	50	12	70	12	80	12	
11-Mar-26	Hip Abduction - (Pulses)	50	12	70	12	80	12	
12-Mar-26	DB Shoulder Press	10	8	12	8	14	6	
12-Mar-26	DB Lateral Raises	6	12	5	12	5	12	
12-Mar-26	Front Raises	4	12	4	12	4	12	
12-Mar-26	1-Arm Cable Tricep Pushdowns	1.25	12	1.25	12	1.25	12	
12-Mar-26	Cable Tricep Pushdowns	11.25	15	13.75	15	15.25	15	
12-Mar-26	Rear Delt Flys	5	12	12	12	18	12	
17-Mar-26	DB Shoulder Press	10	10	12	10	14	8	
17-Mar-26	DB Lateral Raises	8	12	7	12	7	12	
17-Mar-26	Front Raises	4	12	4	12	4	12	
17-Mar-26	Cable Tricep Pushdowns	11.25	20	13.75	15	16.25	15	
17-Mar-26	1-Arm Cable Tricep Pushdowns	1.25	12	3.25	12	3.25	12	
17-Mar-26	Cable Face Pulls	11.25	12	13.75	12	16.25	12	
18-Mar-26	Lat Pulldown	35	10	42.5	8	50	6	
18-Mar-26	Seated Cable Row	27.5	12	35	12	42.5	12	
18-Mar-26	Machine Row	20	12	25	12	35	12	
18-Mar-26	Rear Delt Flys	5	12	12	12	12	12	
18-Mar-26	Hammer Curl	10	10	10	10	10	10	
18-Mar-26	EB Bicep Curl  (Ezy Bar)	10	10	12.5	8	12.5	8	
20-Mar-26	Incline DB Bench Press (45)	12	10	15	10	15	10	
20-Mar-26	Chest Fly (Machine & Cable)	5	10	5	10	12	8	
20-Mar-26	1-Arm Cable Tricep Pushdowns	2.5	12	2.5	12	2.5	12	Each arm
20-Mar-26	Cable Tricep Pushdowns	11.75	12	13.25	12	15	10	
21-Mar-26	Lat Pulldown	35	10	42.5	8	50	6	
21-Mar-26	Seated Cable Row	27.5	12	35	12	42.5	12	
21-Mar-26	Machine Row	20	12	25	12	35	12	
21-Mar-26	Rear Delt Flys	5	12	12	12	12	12	
21-Mar-26	Hammer Curl	10	10	10	10	10	10	
21-Mar-26	EB Bicep Curl  (Ezy Bar)	10	10	12.5	8	12.5	8	
22-Mar-26	BB Squats	30	8	40	6	40	8	
22-Mar-26	Romanian Deadlifts	18	10	28	10	28	10	
22-Mar-26	Hip Abduction - (Leaning Back)	50	12	70	12	80	12	
22-Mar-26	Hip Abduction - (Leaning Forward)	50	12	70	12	80	12	
22-Mar-26	Hip Abduction - (Pulses)	50	12	70	12	80	12	
22-Mar-26	Stairmaster							10 minutes
23-Mar-26	Lat Pulldown	35	10	42.5	8	50	6	
23-Mar-26	Seated Cable Row	27.5	12	35	12	42.5	12	
23-Mar-26	Machine Row	20	12	25	12	35	12	
23-Mar-26	Rear Delt Flys	5	12	12	12	12	12	
23-Mar-26	Hammer Curl	10	10	10	10	10	10	
23-Mar-26	EB Bicep Curl  (Ezy Bar)	10	10	12.5	8	12.5	8	
25-Mar-26	DB Shoulder Press	10	10	12	10	14	8	
25-Mar-26	DB Lateral Raises	5	12	5	12	5	12	
25-Mar-26	Front Raises	4	12	4	12	4	12	
25-Mar-26	Rear Delt Flys	5	12	5	12	5	12	
25-Mar-26	1-Arm Cable Tricep Pushdowns	2.5	12	2.5	12	2.5	12	
25-Mar-26	Cable Tricep Pushdowns	13.25	12	15	12	15	12	
25-Mar-26	Cable Face Pulls	12.5	10	15	10	17.5	10	
27-Mar-26	Lat Pulldown	30	10	40	10	50	6	Bear Grip
27-Mar-26	Lat Pulldown	22.5	10	30	10	37.5	8	Close Grip
27-Mar-26	Machine Row	20	10	22.5	10	25	8	Each arm
27-Mar-26	Overhead Lat Pulldowns	12.5	10	15	8	15	8	
27-Mar-26	DB Hammer Curl	7	10	7	10	7	10	Each arm
27-Mar-26	EB Bicep Curl  (Ezy Bar)	15	10	15	10	15	10	
27-Mar-26	Cable Face Pulls	12.5	10	15	10	17.5	10	
28-Mar-26	BB Squats	40	8	50	8	50	8	Heels Elevated
28-Mar-26	Romanian Deadlifts	10	12	30	12	30	12	
28-Mar-26	Hip Abduction - (Leaning Back)	50	12	70	12	80	12	
28-Mar-26	Hip Abduction - (Leaning Forward)	50	12	70	12	80	12	
28-Mar-26	Hip Abduction - (Pulses)	50	12	70	12	80	12	
28-Mar-26	Treadmill							10 Minutes Incline; 6 - Speed ;4.5
28-Mar-26	Bike							10 Minutes or 3kms - Level 7
29-Mar-26	Treadmill							10 Minutes
29-Mar-26	Bike							3kms
29-Mar-26	Incline DB Bench Press (45)	12	12	14	8	14	8	
29-Mar-26	Chest Fly (Machine & Cable)	5	10	12	10	13.25	8	
29-Mar-26	1-Arm Cable Tricep Pushdowns	1.25	8	3.75	8	3.75	8	Each Arm
29-Mar-26	Cable Tricep Pushdowns	12.5	10	15	10	17.5	10	
29-Mar-26	Chest Press (Machine)	12	10	12	10	12	10	
29-Mar-26	DB Lateral Raises	6	10	6	10	6	10	
29-Mar-26	EB Upright Row	10	10	10	10	10	10	
3-Apr-26	DB Shoulder Press	10	10	12	8	14	6	
3-Apr-26	DB Lateral Raises	5	12	5	12	5	12	
3-Apr-26	Front Raises	4	12	4	12	4	12	
3-Apr-26	Cable Face Pulls	13.75	10	16.25	10	18.75	8	
3-Apr-26	1-Arm Cable Tricep Pushdowns	1.25	8	3.75	8	3.75	8	
3-Apr-26	Cable Tricep Pushdowns	13.75	12	15	10	17.5	10	V Grip
3-Apr-26	Cable Tricep Pushdowns	13.75	12	13.75	12	13.75	12	Rope
3-Apr-26	Treadmill							10 Minutes
3-Apr-26	Row							5 Minutes`;

function createPrismaClient() {
  const databaseUrl = process.env.DATABASE_URL || "file:./dev.db";
  const adapter = new PrismaLibSql({ url: databaseUrl });
  return new PrismaClient({ adapter });
}

function normalizeKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/°/g, "")
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

function parseDate(value: string): Date {
  const raw = value.trim();
  const parts = raw.split("-");
  if (parts.length !== 3) throw new Error(`Invalid date: ${value}`);
  const day = Number.parseInt(parts[0], 10);
  const monthMap: Record<string, number> = {
    jan: 0,
    feb: 1,
    mar: 2,
    apr: 3,
    may: 4,
    jun: 5,
    jul: 6,
    aug: 7,
    sep: 8,
    oct: 9,
    nov: 10,
    dec: 11,
  };
  const month = monthMap[parts[1].toLowerCase()];
  const year = 2000 + Number.parseInt(parts[2], 10);
  if (!Number.isFinite(day) || month == null || !Number.isFinite(year)) {
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

  if (name.includes("lat pulldown") || name.includes("overhead lat pulldown")) {
    if (name.includes("overhead")) return { canonicalExercise: "Lat pulldown", variantHint: "Overhead" };
    if (name.includes("close") || note.includes("close grip")) return { canonicalExercise: "Lat pulldown", variantHint: "Close" };
    if (name.includes("wide") || note.includes("wide grip") || note.includes("bear grip")) return { canonicalExercise: "Lat pulldown", variantHint: "Wide" };
    return { canonicalExercise: "Lat pulldown" };
  }

  if (name.includes("seated cable row")) return { canonicalExercise: "Row", variantHint: "Seated Cable" };
  if (name.includes("machine row")) return { canonicalExercise: "Row", variantHint: "Machine" };
  if (name === "t bar" || name.includes("t bar")) return { canonicalExercise: "Row", variantHint: "T-Bar" };
  if (name.includes("bb row") || name.includes("barbell row")) return { canonicalExercise: "Row", variantHint: "Barbell" };

  if (name.includes("cable face pull")) return { canonicalExercise: "Face pull", variantHint: "Cable" };

  if (name.includes("assisted pull up")) return { canonicalExercise: "Pull up", progressionHint: "Assisted" };
  if (name.includes("negative pull up")) return { canonicalExercise: "Pull up", progressionHint: "Negative" };

  if (name.includes("eb bicep curl") || name.includes("ezy bar") || name.includes("ez bar")) {
    return { canonicalExercise: "Bicep curl", variantHint: "EZ Bar" };
  }
  if (name.includes("hammer curl")) return { canonicalExercise: "Bicep curl", variantHint: "Hammer" };
  if (name.includes("cable bicep curl")) return { canonicalExercise: "Bicep curl", variantHint: "Cable" };

  if (name.includes("db shoulder press")) return { canonicalExercise: "Shoulder press", progressionHint: "Dumbbell" };
  if (name.includes("db lateral raise")) return { canonicalExercise: "Lateral raise", variantHint: "Dumbbell" };
  if (name.includes("front raise")) return { canonicalExercise: "Front raise", variantHint: "Dumbbell" };

  if (name.includes("1 arm cable tricep pushdown")) return { canonicalExercise: "Tricep pushdown", variantHint: "One Arm Cable" };
  if (name.includes("cable tricep pushdown")) return { canonicalExercise: "Tricep pushdown", variantHint: "Cable" };

  if (name.includes("cable rear delt")) return { canonicalExercise: "Rear delt fly", variantHint: "Cable" };
  if (name.includes("rear delt fly")) return { canonicalExercise: "Rear delt fly" };

  if (name.includes("hamstring curl")) return { canonicalExercise: "Leg curl", variantHint: "Hamstring" };

  if (name.includes("bb squat")) return { canonicalExercise: "Squat", progressionHint: "Barbell" };
  if (name.includes("pendulum squat")) return { canonicalExercise: "Squat", variantHint: "Pendulum" };

  if (name.includes("single leg extension")) return { canonicalExercise: "Leg extension", progressionHint: "Single Leg" };
  if (name.includes("seated leg extension")) return { canonicalExercise: "Leg extension", progressionHint: "Seated" };

  if (name.includes("hip abduction")) {
    if (name.includes("leaning back")) return { canonicalExercise: "Hip abduction", variantHint: "Leaning Back" };
    if (name.includes("leaning forward")) return { canonicalExercise: "Hip abduction", variantHint: "Leaning Forward" };
    if (name.includes("pulses")) return { canonicalExercise: "Hip abduction", variantHint: "Pulses" };
    return { canonicalExercise: "Hip abduction" };
  }

  if (name.includes("hanging leg raise")) return { canonicalExercise: "Leg raise", progressionHint: "Hanging" };
  if (name.includes("leg press")) return { canonicalExercise: "Leg press" };

  if (name.includes("db bench press")) return { canonicalExercise: "Bench press", progressionHint: "Dumbbell", variantHint: "Flat" };
  if (name.includes("incline db bench press")) return { canonicalExercise: "Bench press", progressionHint: "Dumbbell", variantHint: "Incline 45" };

  if (name.includes("chest fly")) return { canonicalExercise: "Chest fly" };
  if (name.includes("chest press")) return { canonicalExercise: "Chest press", progressionHint: "Machine", variantHint: "Flat" };

  if (name.includes("db hammer curl")) return { canonicalExercise: "Bicep curl", variantHint: "Hammer" };

  if (name.includes("b stance rdl")) return { canonicalExercise: "Deadlift", progressionHint: "Romanian", variantHint: "B Stance" };
  if (name.includes("romanian deadlift")) return { canonicalExercise: "Deadlift", progressionHint: "Romanian" };

  if (name.includes("cable kickback")) return { canonicalExercise: "Glute kickback", variantHint: "Cable" };

  if (name.includes("eb upright row") || name.includes("upright row")) return { canonicalExercise: "Upright row", progressionHint: "EZ Bar" };

  if (name.includes("stairmaster")) {
    if (note.includes("interval")) return { canonicalExercise: "Stairmaster", variantHint: "Intervals" };
    return { canonicalExercise: "Stairmaster" };
  }

  if (name.includes("treadmill")) {
    if (note.includes("incline")) return { canonicalExercise: "Treadmill", variantHint: "Incline" };
    if (note.includes("interval")) return { canonicalExercise: "Treadmill", variantHint: "Intervals" };
    return { canonicalExercise: "Treadmill" };
  }

  if (name === "bike") {
    if (note.includes("steady")) return { canonicalExercise: "Stationary bike", variantHint: "Steady state" };
    if (note.includes("interval")) return { canonicalExercise: "Stationary bike", variantHint: "Intervals" };
    return { canonicalExercise: "Stationary bike" };
  }

  if (name === "row" && (!note || note.includes("minute") || note.includes("km"))) {
    return { canonicalExercise: "Rowing machine" };
  }

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
    const judy = await prisma.user.findFirst({
      where: {
        OR: [
          { username: "judy" },
          { username: "Judy" },
          { name: "judy" },
          { name: "Judy" },
        ],
      },
      select: { id: true, username: true, name: true },
    });

    if (!judy) {
      throw new Error("Could not find user 'judy' by username/name.");
    }

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

    let inserted = 0;
    let skippedDuplicates = 0;
    let unmapped = 0;
    const unmappedNames = new Set<string>();

    const levelsByExercise = new Map<string, string>();

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
            userId: judy.id,
            exerciseId: exercise.id,
          },
        },
        update: {
          currentLevel: level,
        },
        create: {
          userId: judy.id,
          exerciseId: exercise.id,
          currentLevel: level,
        },
        select: { id: true },
      });

      levelsByExercise.set(exercise.name, String(level));

      const baseDate = parseDate(row.date);
      const createdAt = new Date(baseDate.getTime() + i * 1000);
      const dayStart = new Date(Date.UTC(baseDate.getUTCFullYear(), baseDate.getUTCMonth(), baseDate.getUTCDate(), 0, 0, 0));
      const dayEnd = new Date(Date.UTC(baseDate.getUTCFullYear(), baseDate.getUTCMonth(), baseDate.getUTCDate(), 23, 59, 59));

      const finalNotes = [row.notes, inferred.noteSuffix].filter(Boolean).join(" | ").trim() || null;

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

    console.log("Judy import complete.");
    console.log(`User: ${judy.username || judy.name || judy.id} (${judy.id})`);
    console.log(`Rows parsed: ${rows.length}`);
    console.log(`Inserted logs: ${inserted}`);
    console.log(`Skipped as duplicates: ${skippedDuplicates}`);
    console.log(`Unmapped rows: ${unmapped}`);
    console.log(`Unmapped labels: ${JSON.stringify(Array.from(unmappedNames).sort())}`);
    console.log(`Exercises touched: ${JSON.stringify(Array.from(levelsByExercise.keys()).sort())}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("Failed to import Judy logs:", error);
  process.exitCode = 1;
});
