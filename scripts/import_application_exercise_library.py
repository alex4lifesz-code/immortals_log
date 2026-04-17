import json
import re
import sqlite3
import uuid
from datetime import datetime, timezone

DATA = r"""
Exercise	Progression	Variation
Muscle up	Transition Drill, Band Assisted, Negative, Strict, Slow	Bar, Ring, L-sit, Weighted, Behind the neck, Impossible, Typewriter, Clapping
Pull up	Scapular, Assisted, Standard, Strict, Weighted, One Arm Assisted, One Arm Negatives, One Arm	Wide grip, Close grip, Chin up, Neutral grip, Archer, Typewriter, L-sit, Commando, Chest-to-bar, High, Ring, Explosive, Kipping, Behind the neck, Clapping, Rope
Dip	Bench, Negative, Assisted, Standard, Weighted	Parallel bar, Ring, Straight bar, Korean, L-sit, Russian, Archer, Bulgarian, Impossible
Push up	Incline, Standard, Decline, Weighted	Wide, Diamond, Archer, One arm, Clapping, Planche, Pike, Pseudo planche, Explosive, Typewriter, Staggered, Spiderman, Hindu, Aztec, Superman, Dive bomber, Lalanne, Knuckle, Fingertip, Ring
Handstand	Wall Hold, Freestanding, One arm	Tuck, Straddle, Press to handstand, Walking, Fingertip, Pirouette, Tiger bend
Handstand push up	Pike, Elevated Pike, Wall, Deficit Wall, Freestanding	90 degree, Weighted, Clapping, Tiger bend
Front lever	Tuck Hold, Tucked Negative, Advanced Tuck Hold, One Leg Hold, Straddle Hold, Full Hold	Pulls, Raises, Ice Cream Maker, Touch, Rows
Back lever	Tuck, Advanced tuck, Straddle, Half lay, Full	One leg, Pulls, Raises, To German hang
Planche	Lean, Tuck, Tucked Press, Advanced tuck, Straddle, Full	Push up, Press, One arm, Rings
Dragon flag	Tuck, Advanced tuck, Straddle, Full	Negatives, Raises, Side
L-sit	Tuck, One leg, Full, Straddle, V-sit, Manna	Floor, Parallettes, Rings, Bar
Human flag	Tuck, Straddle, Half, Full	Vertical, Pulls, Raises, Press
Hang	Dead, Active	One arm, Weighted, Scapular, False grip
Support hold	Parallel bar, Ring	Tuck, L-sit, Turned out, Wide
Leg raise	Lying, Hanging	Tuck, Straight, Windshield wiper, Side to side, Toes to bar
Pistol squat	Assisted, Standard, Weighted	Jumping, Elevated, Airborne, Dragon
Squat	Bodyweight, Weighted	Sumo, Cossack, Shrimp, Sissy, Hindu, Jump, Bulgarian split, Single leg box
Lunge	Standard, Weighted	Forward, Reverse, Walking, Jumping, Lateral, Curtsy, Clock
Step up	Standard, Weighted	Lateral, Crossover, Explosive, Box jump
Glute bridge	Standard, Single leg, Weighted	Elevated, Marching, Frog
Hip thrust	Standard, Single leg, Weighted	Elevated, Banded, Frog
Nordic curl	Assisted, Eccentric, Full	Banded, Weighted, Single leg
Reverse nordic	Assisted, Standard, Full	Weighted, Banded
Calf raise	Standard, Single leg, Weighted	Elevated, Seated, Jumping
Inverted row	Incline, Standard, Elevated feet	Wide, Close, Archer, One arm, Underhand
Australian pull up	Incline, Standard, Elevated feet	Wide, Close, Underhand, Ring
Skin the cat	Assisted, Standard, Full	German hang, Reverse, Shouldered
Toes to bar	Knees to chest, Knees to bar, Full	Strict, Kipping, L-hang
Hollow body	Tuck, Straddle, Full	Rocks, Hold, Flutter kicks
Arch body	Tuck, Full	Rocks, Hold, Superman, Swimmers
Plank	Knee, Standard, Weighted	Forearm, High, Side, Reverse, Copenhagen, Star, Ring
Ab wheel rollout	Kneeling, Standing	Wide, Narrow, One arm, Oblique
Windmill	Standard, Weighted	Standing, Kneeling
Crow pose	Frogger, Toes down, Full	Side crow, One leg, Crane
Elbow lever	Straddle, Full	One arm, Press
360 pull	Assisted, Standard	Bar, Ring
Impossible dip	Negative, Assisted, Full	Weighted
Victorian cross	Tuck, Advanced tuck, Straddle, Full	Rings
Iron cross	Band assisted, Negative, Full	Rings, Wide, Inverted
Maltese	Tuck, Advanced tuck, Straddle, Full	Rings, Floor, Press
Reverse planche	Tuck, Advanced tuck, Straddle, Full	Rings
Press to handstand	Tuck, Straddle, Pike, Full	Floor, Parallettes, Rings, Jump
Hefesto	Assisted, Negative, Full	Bar, Rings
Pelican curl	Band assisted, Negative, Full	Rings
Azarian	Assisted, Negative, Full	Rings
Zanetti	Assisted, Negative, Full	Rings
Nakayama	Assisted, Negative, Full	Rings
Stalder press	Tuck, Straddle, Full	Floor, Parallettes, Rings
Felge	Assisted, Full	Bar, Rings, Forward, Backward
Giant swing	Assisted, Full	Bar, Forward, Backward
Kip up	Assisted, Standard	Nip up, No hands
Backflip	Wall assisted, Trampoline, Full	Standing, Running, Gainer, Layout, Twist
Frontflip	Wall assisted, Trampoline, Full	Standing, Running, Layout, Twist
Side flip	Trampoline, Full	Standing, Running, Aerial
Wall flip	Standard	Backflip, Frontflip, Side
Bar spin	Assisted, Full	180, 360, Flying
Straight arm press	Tuck, Straddle, Full	Floor, Parallettes, Rings
Lever to lever	Assisted, Full	Front to back, Back to front
Typewriter push up	Standard, Weighted	Wide, Decline
Clapping push up	Single clap, Double clap, Triple clap	Behind back, Superman clap
Burpee	Standard, Weighted	Box jump, Pull up, Muscle up, One arm
Mountain climber	Standard, Fast	Cross body, Slider
Bear crawl	Forward, Backward	Weighted, Elevated
Crab walk	Forward, Backward, Sideways	Elevated
Frog stand	Standard, Elevated	One arm
Pseudo planche push up	Standard, Weighted	Wide, Narrow, Decline
Pike hold	Standard	Elevated, Straddle
Wall walk	Standard	Weighted, One arm
Rope climb	L-sit, Standard	Legless, One arm, Weighted
Pegboard	Standard	Legless, L-sit, Weighted
Yoga

Exercise	Progression	Variation
Downward Dog	Puppy Pose, Dolphin Pose, Full	One Leg, Bent Knee, Three Legged
Upward Dog	Cobra, Baby Cobra, Full	One Leg
Warrior I	Low Lunge, Crescent Lunge, Full	Arms Overhead, Hands at Heart, Humble
Warrior II	Wide Stance, Full	Extended, Reverse, Peaceful
Warrior III	Kickstand, Full	Arms Forward, Arms Back, Arms Wide, Half Moon transition
Triangle Pose	Half, Full, Extended	Revolved, Bound, Twisted
Chair Pose	Half, Full	Twisted, One Leg, Prayer twist
Tree Pose	Kickstand, Ankle, Calf, Thigh	Arms at Heart, Arms Overhead, Arms Wide, Swaying
Eagle Pose	Half Wrap, Full	Standing, Seated, Reclined
Crow Pose	Frogger, Toes Down, Full	Side Crow, One Leg, Flying crow
Headstand	Tripod, Supported, Full	Tuck, Straddle, Pike, Lotus, Scorpion, One Leg
Forearm Stand	Wall, Scorpion Prep, Full	Tuck, Straddle, Scorpion, Hollowback
Shoulder Stand	Supported, Full	Plow, Lotus, Legs wide
Bridge Pose	Supported, Full	One Leg, Wheel Prep, Dynamic
Wheel Pose	Bridge, Half Wheel, Full	One Leg, One Arm, Scorpion, Walking, Drop back
Cobra Pose	Baby Cobra, Full	Upward Dog, Sphinx
Locust Pose	Arms Back, Arms Forward, Full	One Leg, Superman, Half
Bow Pose	Half, Full	One Leg, Side, Rocking
Pigeon Pose	Supported, Sleeping, Full	King Pigeon, One Legged King, Mermaid
Lotus Pose	Easy Seat, Half Lotus, Full	Bound, Elevated, Floating
Seated Forward Fold	Half, Full	Wide Leg, One Leg, Head to knee
Standing Forward Fold	Half, Full	Wide Leg, Ragdoll, Gorilla
Camel Pose	Hands on Hips, Blocks, Full	One Arm, Kapotasana
Fish Pose	Supported, Full	Lotus, Bound
Boat Pose	Bent Knee, Half, Full	Low Boat, Twisted, Floating
Side Plank	Knee Down, Half, Full	Tree, Top Leg Raised, Wild Thing, Forearm
Plank	Knee, Forearm, High	Side, Reverse, Dolphin
Chaturanga	Knee Down, Full	Hover, Slow Lower, One Leg
Cat Cow	Seated, Tabletop	Flow, Isolated, Extended
Child's Pose	Narrow, Wide	Extended Arms, Side Stretch, Thread the needle
Corpse Pose	Supported, Full	Legs Up Wall, Side lying
Half Moon Pose	Block, Full	Revolved, Sugarcane, Chapasana
Dancer Pose	Kickstand, Half, Full	King Dancer, Natarajasana
Standing Split	Half, Full	Wall Supported, Handstand transition
Compass Pose	Seated Side Stretch, Half, Full	Bound, Flying
Firefly Pose	Tuck, Half, Full	Floating, Straight legs
Eight Angle Pose	Prep, Full	Flying, Transitional
Peacock Pose	Wrist Prep, Lotus Peacock, Full	One Leg, Forearm
Handstand	Wall, L-Shape, Full	Scorpion, Lotus, Straddle, Press
Splits	Half, Wall Supported, Full	Oversplit, Standing, Middle
Frog Pose	Half, Full	Deep Frog, Mandukasana
Lizard Pose	High, Low, Full	Twisted, Bound, Flying
Malasana	Supported, Full	Twisted, Arms Bound, Prayer
Crescent Lunge	Low, High	Twisted, Arms Overhead, Hands to floor
Gate Pose	Half, Full	Extended, Side bend
Reclined Twist	Bent Knee, Full	Eagle Legs, Straight Leg, Revolved
Happy Baby	One Leg, Full	Extended, Rocking
Thread the Needle	Half, Full	Extended, Dynamic
Puppy Pose	Half, Full	Extended, Twisted, Melting heart
Sphinx Pose	Half, Full	Seal, One arm
Side Angle Pose	Forearm on Thigh, Full	Extended, Bound, Revolved, Bird of paradise
Revolved Chair	Half Twist, Full	Bound, Prayer twist
Garland Pose	Elevated Heels, Full	Twisted, Arms Bound, Tiptoe
Mountain Pose	Standard	Arms Overhead, Prayer, Side bend
Standing Backbend	Supported, Full	Arms overhead, Hands at heart
Sun Salutation A	Modified, Full	With variations
Sun Salutation B	Modified, Full	With variations
Moon Salutation	Modified, Full	With variations
Cow Face Pose	Arms only, Legs only, Full	Forward fold, Twist
Hero Pose	Supported, Full	Reclined, Arms overhead
Thunderbolt Pose	Standard	Toe stretch, Ankle stretch
Staff Pose	Standard	Arms overhead, Twist
Bound Angle Pose	Supported, Full	Reclined, Forward fold
Wide Legged Forward Fold	Half, Full	Hands clasped, Twist, Head to floor
Pyramid Pose	Blocks, Full	Revolved, Hands clasped
Revolved Triangle	Block, Full	Bound
Extended Hand to Big Toe	Kickstand, Bent knee, Full	Front, Side, Revolved
Toe Stand	Supported, Full	Arms overhead, Prayer
Monkey Pose	Half, Full	Arms overhead, Twisted
Flying Pigeon	Prep, Full	Extended
Grasshopper Pose	Prep, Full	Extended
Dragonfly Pose	Prep, Full	Extended
Eka Pada Koundinyasana I	Prep, Full	Transitional
Eka Pada Koundinyasana II	Prep, Full	Transitional
Astavakrasana	Prep, Full	Extended
Scale Pose	Tuck, Full	Lotus
Pendant Pose	Tuck, Full	Straight legs
Shoulder Pressing Pose	Prep, Full	Extended
Tortoise Pose	Half, Full	Sleeping tortoise
Yoga Nidrasana	Prep, Full	One leg
Embryo Pose	Supported, Full	Rolling
Plow Pose	Supported, Full	Knees to ears, Legs wide
Ear Pressure Pose	Supported, Full	Knees bent
Legs Up the Wall	Supported, Full	Wide legs, Bound angle
Supported Headstand	Wall, Full	Tripod, Bound
Feathered Peacock	Wall, Full	Scorpion
King Pigeon	Prep, Full	One arm overhead
Mermaid Pose	Prep, Full	One arm overhead
Wild Thing	Side plank, Full	Flipped dog
Fallen Angel	Side crow, Full	Extended
Flying Crow	Crow, Full	Transitional
Baby Grasshopper	Prep, Full	Transitional
Gym

Exercise	Progression	Variation
Bench press	Dumbbell, Barbell, Machine	Flat, Incline, Decline, Close grip, Wide grip, Floor press, Board press, Spoto press
Chest fly	Dumbbell, Cable, Machine	Flat, Incline, Decline, High cable, Low cable
Chest press	Machine, Dumbbell, Barbell	Flat, Incline, Decline, Hammer strength
Lat pulldown	Standard, Weighted	Wide, Close, Neutral, Overhead, Reverse grip, Single arm, Behind the neck
Row	Dumbbell, Barbell, Cable, Machine	Bent over, Seated, T-bar, Single arm, Pendlay, Meadows, Kroc, Helms, Seal
Pull up	Assisted, Standard, Weighted	Wide, Close, Neutral, Chin up, Behind the neck
Deadlift	Conventional, Sumo, Romanian, Stiff leg	Barbell, Dumbbell, Trap bar, Single leg, Deficit, Block, Snatch grip, Jefferson
Squat	Bodyweight, Barbell, Dumbbell	Back, Front, Goblet, Hack, Zercher, Pendulum, Safety bar, Belt
Leg press	Standard, Single leg	Wide stance, Narrow stance, High feet, Low feet, 45 degree, Horizontal
Leg extension	Seated	Single leg, Both legs, Paused
Leg curl	Seated, Lying, Standing	Single leg, Both legs, Nordic attachment
Hip abduction	Machine, Cable	Seated, Standing, Leaning back, Leaning forward, Pulses
Hip adduction	Machine, Cable	Seated, Standing
Glute kickback	Cable, Machine	Single leg, Donkey kick
Hip thrust	Barbell, Dumbbell, Machine	Single leg, Banded, B stance, Feet elevated
Calf raise	Standing, Seated	Machine, Smith machine, Single leg, Donkey, Leg press
Shoulder press	Dumbbell, Barbell, Machine	Seated, Standing, Arnold, Push press, Behind the neck, Landmine
Lateral raise	Dumbbell, Cable, Machine	Standing, Seated, Leaning, Lu raise, Lying
Front raise	Dumbbell, Cable, Plate	Standing, Seated, Alternating, Barbell
Rear delt fly	Dumbbell, Cable, Machine	Bent over, Seated, Standing, Face down on bench
Face pull	Cable, Band	Standing, Seated, High, Low, Rope, Wide grip
Upright row	Dumbbell, Barbell, EZ bar, Cable	Wide grip, Close grip, Single arm
Shrug	Dumbbell, Barbell, Trap bar	Standing, Seated, Behind the back, Overhead
Bicep curl	Dumbbell, Barbell, EZ bar, Cable	Standard, Hammer, Preacher, Concentration, Incline, Spider, Drag, Zottman, Bayesian, Cross body
Tricep pushdown	Cable, Band	Rope, Bar, V-bar, Single arm, Reverse grip
Tricep extension	Dumbbell, Barbell, Cable	Overhead, Lying, Skull crusher, French press, JM press, Tate press
Tricep dip	Assisted, Standard, Weighted	Machine, Bench
Tricep kickback	Dumbbell, Cable	Single arm, Both arms
Forearm curl	Dumbbell, Barbell	Wrist flexion, Wrist extension, Reverse, Behind the back
Grip training	Gripper, Plate pinch	Hold, Crush, Pinch, Wrist roller
Crunch	Standard, Weighted	Cable, Machine, Decline, Bicycle, Reverse
Sit up	Standard, Weighted	Decline, Butterfly, Anchored
Leg raise	Lying, Hanging, Captain's chair	Straight, Bent knee, Side
Russian twist	Bodyweight, Weighted	Feet down, Feet elevated, Medicine ball
Wood chop	Cable, Dumbbell, Medicine ball	High to low, Low to high, Horizontal
Pallof press	Cable, Band	Standing, Kneeling, Split stance, Rotating
Back extension	Bodyweight, Weighted	45 degree, Flat, Reverse, GHD
Good morning	Barbell, Dumbbell	Standing, Seated, Zercher
Cable crossover	High, Mid, Low	Single arm, Both arms, Pec fly
Pec deck	Machine	Standard, Reverse
Pullover	Dumbbell, Barbell, Cable	Flat, Decline, Bent arm, Straight arm
Smith machine squat	Standard	Front, Back, Split, Hack
Hack squat	Machine	Narrow, Wide, Reverse
Bulgarian split squat	Dumbbell, Barbell	Standard, Deficit, Smith machine
Walking lunge	Dumbbell, Barbell	Forward, Reverse, Weighted
Step up	Dumbbell, Barbell	Standard, Lateral, Crossover, Box
Box jump	Standard	Single leg, Depth jump, Seated, Rebound
Sled push	Light, Heavy	Sprint, Slow, High handles, Low handles
Sled pull	Light, Heavy	Forward, Backward, Rope, Belt
Battle ropes	Standard	Alternating, Slams, Waves, Circles, Snakes, Lateral
Farmer's walk	Dumbbell, Trap bar, Farmer's handles	Standard, Single arm, Overhead
Kettlebell swing	Two hand, Single hand	Russian, American, Alternating
Kettlebell clean	Standard	Single arm, Double
Kettlebell snatch	Standard	Single arm, Double
Kettlebell goblet squat	Standard	Pulse, Pause, Tempo
Turkish get up	Standard	Half, Windmill
Rowing machine	Light, Moderate, Heavy	Intervals, Steady state, Sprint
Stairmaster	Low, Medium, High	Intervals, Steady state, Skip step
Treadmill	Walk, Jog, Run	Incline, Intervals, Steady state, Sprint
Stationary bike	Low, Medium, High	Intervals, Steady state, Sprint
Elliptical	Low, Medium, High	Intervals, Steady state, Reverse
Assault bike	Low, Medium, High	Intervals, Steady state, Sprint
Ski erg	Low, Medium, High	Intervals, Steady state, Single arm
Clean	Hang, Power, Full	Barbell, Dumbbell, Kettlebell, Single arm
Snatch	Hang, Power, Full	Barbell, Dumbbell, Kettlebell, Single arm
Clean and jerk	Hang, Power, Full	Barbell, Dumbbell, Split jerk, Push jerk
Push press	Standard	Barbell, Dumbbell, Single arm
Thruster	Standard	Barbell, Dumbbell, Kettlebell
Sumo deadlift high pull	Standard	Barbell, Kettlebell
Muscle snatch	Standard	Barbell, Dumbbell
Hang clean	Above knee, Below knee, Full	Barbell, Dumbbell
Front squat	Standard, Paused	Barbell, Cross arm, Clean grip
Overhead squat	Standard	Barbell, Snatch grip
Split jerk	Standard	Behind the neck
Push jerk	Standard	Behind the neck
Power clean	Standard	From floor, From blocks
Power snatch	Standard	From floor, From blocks
Barbell lunge	Forward, Reverse	Front rack, Back rack
Landmine press	Standard	Single arm, Both hands
Landmine row	Standard	Single arm, Both hands
Landmine squat	Standard	Goblet style, Sumo
Landmine rotation	Standard	Anti-rotation, Chop
Hip flexor raise	Hanging, Captain's chair	Straight leg, Bent knee
Cable crunch	Kneeling, Standing	Rope, Bar
Dead bug	Standard	Weighted, Banded
Bird dog	Standard	Weighted, Banded
Bear hold	Standard	Weighted, Shoulder tap
Hollow hold	Tuck, Full	Weighted, Rocking
Medicine ball slam	Standard	Overhead, Side, Rotational
Medicine ball throw	Chest pass, Overhead	Against wall, Partner, Rotational
Box squat	Bodyweight, Barbell	Low box, High box, Paused
Pin squat	Standard	Various heights
Pause squat	Standard	Bottom pause, Half pause
Tempo squat	Standard	3-1-3, 4-0-4, Various tempos
Anderson squat	Standard	From pins, Various heights
Zercher carry	Standard	Walking, Static hold
Yoke walk	Standard	Heavy, Light, Speed
Atlas stones	Standard	Over bar, To platform
Log press	Standard	Clean and press, From rack
Axle bar deadlift	Standard	Conventional, Sumo
Trap bar carry	Standard	Walking, Static hold
Sandbag carry	Shoulder, Bear hug	Walking, Throws
Tire flip	Standard	Weighted
Prowler push	Low handles, High handles	Sprint, Heavy, Light
Reverse hyper	Machine	Bodyweight, Weighted
GHD sit up	Standard	Weighted, Roman chair
GHD hip extension	Standard	Weighted
GHD raise	Standard	Weighted, Nordic style
Sissy squat	Standard, Machine	Bodyweight, Weighted
Hack squat machine	Standard	Single leg, Narrow, Wide
Pendulum squat	Standard	Single leg
Belt squat	Machine	Standard, Marching
Reverse lunge	Dumbbell, Barbell	Deficit, Knee over toes
Curtsy lunge	Dumbbell, Barbell	Standard
Lateral lunge	Dumbbell, Barbell	Standard, Sliding
Single leg deadlift	Dumbbell, Barbell, Kettlebell	Standard, B stance, Kickstand
Glute ham raise	Assisted, Standard	Weighted
Pull through	Cable, Band	Standard
Romanian deadlift	Barbell, Dumbbell	Single leg, B stance, Deficit
Stiff leg deadlift	Barbell, Dumbbell	Standard, Deficit
Sumo deadlift	Standard	Conventional stance, Wide stance
Block pull	Standard	Below knee, Above knee
Deficit deadlift	Standard	1 inch, 2 inch, 3 inch
Rack pull	Standard	Below knee, Above knee
Trap bar deadlift	Standard	High handles, Low handles
Jefferson deadlift	Standard	Alternating stance
Reeves deadlift	Standard	Grip on plates
Snatch grip deadlift	Standard	Deficit, Block
Duck walk	Bodyweight, Weighted	Forward, Backward
Suitcase carry	Dumbbell, Kettlebell	Single arm, Walking
Overhead carry	Dumbbell, Barbell, Kettlebell	Single arm, Both arms
Rack carry	Kettlebell	Single arm, Both arms
Waiter carry	Kettlebell, Dumbbell	Single arm
Cross carry	Kettlebell	Rack and suitcase, Overhead and suitcase
"""

APP_USERNAME = "__app_exercise_library__"
APP_NAME = "Application Exercise Library"


def split_values(text: str) -> list[str]:
    items = []
    seen = set()
    for item in [part.strip() for part in text.split(",") if part.strip()]:
        key = item.casefold()
        if key in seen:
            continue
        seen.add(key)
        items.append(item)
    return items


def extend_unique(target: list[str], incoming: list[str]) -> list[str]:
    seen = {item.casefold() for item in target}
    for item in incoming:
        key = item.casefold()
        if key in seen:
            continue
        seen.add(key)
        target.append(item)
    return target


def parse_rows() -> list[dict]:
    current_category = "Calisthenics"
    merged: dict[str, dict] = {}
    order: list[str] = []

    for raw_line in DATA.splitlines():
        line = raw_line.strip()
        if not line:
            continue
        if line in {"Yoga", "Gym"}:
            current_category = line
            continue
        if line.lower().startswith("exercise"):
            continue

        parts = [part.strip() for part in line.split("\t")]
        if len(parts) != 3:
            parts = [part.strip() for part in re.split(r"\s{2,}", line, maxsplit=2)]
        if len(parts) != 3:
            raise ValueError(f"Could not parse line: {line}")

        name, progression_text, variation_text = parts
        key = name.casefold()
        if key not in merged:
            merged[key] = {
                "name": name,
                "categories": [current_category],
                "progression": split_values(progression_text),
                "variations": split_values(variation_text),
            }
            order.append(key)
        else:
            record = merged[key]
            if current_category not in record["categories"]:
                record["categories"].append(current_category)
            extend_unique(record["progression"], split_values(progression_text))
            extend_unique(record["variations"], split_values(variation_text))
            if name != record["name"] and name.istitle():
                record["name"] = name

    return [merged[key] for key in order]


def ensure_app_owner(conn: sqlite3.Connection) -> str:
    row = conn.execute(
        "SELECT id FROM User WHERE username = ?",
        (APP_USERNAME,),
    ).fetchone()
    if row:
        return row[0]

    owner_id = f"app_{uuid.uuid4().hex}"
    now = datetime.now(timezone.utc).isoformat()
    conn.execute(
        """
        INSERT INTO User (
            id, friendCode, username, password, name, role,
            onboardingCompleted, onboardingSkipped, onboardingStep,
            createdAt, updatedAt
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            owner_id,
            uuid.uuid4().hex[:12],
            APP_USERNAME,
            f"system:{uuid.uuid4().hex}",
            APP_NAME,
            "system",
            1,
            1,
            0,
            now,
            now,
        ),
    )
    return owner_id


def infer_type(categories: list[str]) -> tuple[str, str, int, int, int]:
    category_set = set(categories)
    if category_set == {"Gym"}:
        return "Weighted", "gym", 0, 1, 0
    if "Yoga" in category_set and len(category_set) == 1:
        return "Timed", "bodyweight", 1, 0, 0
    rings = 1 if "Calisthenics" in category_set else 0
    if "Gym" in category_set:
        return "Bodyweight", "mixed", 1, 0, rings
    return "Bodyweight", "bodyweight", 1, 0, rings


def upsert_library(conn: sqlite3.Connection, rows: list[dict]) -> dict:
    owner_id = ensure_app_owner(conn)
    now = datetime.now(timezone.utc).isoformat()
    created = 0
    updated = 0

    for row in rows:
        categories = row["categories"]
        category_text = ", ".join(categories)
        type_label, equipment_type, bodyweight, weighted, rings = infer_type(categories)
        name = row["name"]
        progression = row["progression"] or [name]
        variations = row["variations"]

        existing = conn.execute(
            "SELECT id FROM ProgressionExercise WHERE lower(name) = lower(?) ORDER BY createdAt ASC LIMIT 1",
            (name,),
        ).fetchone()

        if existing:
            exercise_id = existing[0]
            conn.execute(
                """
                UPDATE ProgressionExercise
                SET name = ?, wuxiaName = ?, difficulty = '', wuxiaDifficulty = '',
                    type = ?, wuxiaType = ?, story = '', tips = '[]',
                    category = ?, equipmentType = ?, bodyweight = ?, weighted = ?, rings = ?,
                    primaryMuscles = 'Other', secondaryMuscles = '', prerequisites = '[]',
                    cues = '[]', commonMistakes = '[]', breathing = '',
                    safetyConsiderations = '[]', competitionStandards = '{}',
                    progression = ?, assignedDays = '', userId = ?
                WHERE id = ?
                """,
                (
                    name,
                    name,
                    type_label,
                    type_label,
                    category_text,
                    equipment_type,
                    bodyweight,
                    weighted,
                    rings,
                    json.dumps(progression, ensure_ascii=False),
                    owner_id,
                    exercise_id,
                ),
            )
            updated += 1
        else:
            exercise_id = f"app_ex_{uuid.uuid4().hex}"
            conn.execute(
                """
                INSERT INTO ProgressionExercise (
                    id, name, wuxiaName, difficulty, wuxiaDifficulty,
                    type, wuxiaType, story, tips, category, equipmentType,
                    bodyweight, weighted, rings, primaryMuscles, secondaryMuscles,
                    prerequisites, cues, commonMistakes, breathing,
                    safetyConsiderations, competitionStandards, progression,
                    assignedDays, createdAt, userId
                )
                VALUES (?, ?, ?, '', '', ?, ?, '', '[]', ?, ?, ?, ?, ?, 'Other', '', '[]', '[]', '[]', '', '[]', '{}', ?, '', ?, ?)
                """,
                (
                    exercise_id,
                    name,
                    name,
                    type_label,
                    type_label,
                    category_text,
                    equipment_type,
                    bodyweight,
                    weighted,
                    rings,
                    json.dumps(progression, ensure_ascii=False),
                    now,
                    owner_id,
                ),
            )
            created += 1

        conn.execute(
            """
            INSERT INTO ProgressionExerciseTranslation (
                id, englishName, vietnameseName, englishStory, vietnameseStory,
                englishDifficulty, vietnameseDifficulty, englishType, vietnameseType,
                createdAt, updatedAt
            )
            VALUES (?, ?, ?, '', '', '', '', ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                englishName = excluded.englishName,
                vietnameseName = excluded.vietnameseName,
                englishType = excluded.englishType,
                vietnameseType = excluded.vietnameseType,
                updatedAt = excluded.updatedAt
            """,
            (exercise_id, name, name, type_label, type_label, now, now),
        )

        tier_ids = [item[0] for item in conn.execute("SELECT id FROM ProgressionTier WHERE exerciseId = ?", (exercise_id,)).fetchall()]
        if tier_ids:
            conn.executemany("DELETE FROM ProgressionTierTranslation WHERE id = ?", [(tier_id,) for tier_id in tier_ids])
        conn.execute("DELETE FROM ProgressionTier WHERE exerciseId = ?", (exercise_id,))

        variation_ids = [item[0] for item in conn.execute("SELECT id FROM ProgressionVariation WHERE exerciseId = ?", (exercise_id,)).fetchall()]
        if variation_ids:
            conn.executemany("DELETE FROM ProgressionVariationTranslation WHERE id = ?", [(variation_id,) for variation_id in variation_ids])
        conn.execute("DELETE FROM ProgressionVariation WHERE exerciseId = ?", (exercise_id,))

        for index, stage in enumerate(progression, start=1):
            tier_id = f"app_tier_{uuid.uuid4().hex}"
            conn.execute(
                """
                INSERT INTO ProgressionTier (
                    id, exerciseId, level, name, wuxiaName, difficulty,
                    wuxiaDifficulty, wuxiaType, description, targetHold,
                    targetReps, targetRepsText
                )
                VALUES (?, ?, ?, ?, ?, '', '', '', '', NULL, NULL, '')
                """,
                (tier_id, exercise_id, index, stage, stage),
            )
            conn.execute(
                """
                INSERT INTO ProgressionTierTranslation (
                    id, englishName, vietnameseName, englishDescription,
                    vietnameseDescription, englishDifficulty, vietnameseDifficulty,
                    createdAt, updatedAt
                )
                VALUES (?, ?, ?, '', '', '', '', ?, ?)
                """,
                (tier_id, stage, stage, now, now),
            )

        for variation in variations:
            variation_id = f"app_var_{uuid.uuid4().hex}"
            conn.execute(
                """
                INSERT INTO ProgressionVariation (
                    id, exerciseId, name, wuxiaName, difficulty,
                    wuxiaDifficulty, wuxiaType, description
                )
                VALUES (?, ?, ?, ?, '', '', '', '')
                """,
                (variation_id, exercise_id, variation, variation),
            )
            conn.execute(
                """
                INSERT INTO ProgressionVariationTranslation (
                    id, englishName, vietnameseName, englishDescription,
                    vietnameseDescription, englishDifficulty, vietnameseDifficulty,
                    createdAt, updatedAt
                )
                VALUES (?, ?, ?, '', '', '', '', ?, ?)
                """,
                (variation_id, variation, variation, now, now),
            )

    return {
        "created": created,
        "updated": updated,
        "total": len(rows),
        "ownerId": owner_id,
    }


if __name__ == "__main__":
    records = parse_rows()
    conn = sqlite3.connect("dev.db")
    conn.execute("PRAGMA foreign_keys = ON")
    try:
        summary = upsert_library(conn, records)
        conn.commit()
        print(json.dumps(summary, indent=2))
    finally:
        conn.close()
