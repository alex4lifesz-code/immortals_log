// ─── Exact full-name overrides (checked first, case-insensitive) ──────────────
const EXACT_MAP = new Map<string, string>([
  // Gym — chest / shoulders / arms
  ["chest press", "đẩy ngực máy"],
  ["chest fly", "bay ngực"],
  ["reverse fly", "bay ngược"],
  ["rear delt fly", "bay delta sau"],
  ["bicep curl", "cuốn tay trước"],
  ["forearm curl", "cuốn cổ tay"],
  ["pelican curl", "cuốn bồ nông"],
  ["tricep pushdown", "đẩy tay sau"],
  ["hip abduction", "dạng háng"],
  ["hip thrust", "đẩy hông"],
  ["glute bridge", "cầu mông"],
  ["hamstring curl", "gập đùi sau"],
  ["leg press", "đẩy chân"],
  ["nordic curl", "cuốn bắc âu"],
  ["reverse nordic", "bắc âu ngược"],
  ["step up", "bước lên"],
  ["pistol squat", "squat một chân"],

  // Cardio machines
  ["stairmaster", "máy leo cầu thang"],
  ["treadmill", "máy chạy bộ"],
  ["bike", "xe đạp"],

  // Calisthenics
  ["planche", "planche"],
  ["reverse planche", "planche ngược"],
  ["maltese", "maltese"],
  ["iron cross", "thập tự sắt"],
  ["victorian cross", "thập tự victoria"],
  ["handstand", "trồng chuối"],
  ["press to handstand", "đẩy lên trồng chuối"],
  ["forearm stand", "trồng chuối cẳng tay"],
  ["elbow lever", "đòn bẩy khuỷu tay"],
  ["l-sit", "ngồi chữ L"],
  ["human flag", "cờ người"],
  ["support hold", "giữ xà"],
  ["hang", "treo xà"],
  ["skin the cat", "lộn xà"],
  ["toes to bar", "chạm chân lên xà"],
  ["arch body", "thân cong"],
  ["ab wheel rollout", "lăn bánh bụng"],
  ["windmill", "cối xay gió"],
  ["360 pull", "kéo 360"],
  ["hefesto", "hefesto"],
  ["side plank", "plank nghiêng"],

  // Yoga poses
  ["downward dog", "chó úp mặt"],
  ["warrior i", "chiến binh I"],
  ["warrior ii", "chiến binh II"],
  ["warrior iii", "chiến binh III"],
  ["triangle pose", "tư thế tam giác"],
  ["chair pose", "tư thế ghế"],
  ["tree pose", "tư thế cây"],
  ["eagle pose", "tư thế đại bàng"],
  ["crow pose", "tư thế quạ"],
  ["headstand", "trồng chuối đầu"],
  ["shoulder stand", "trồng vai"],
  ["bridge pose", "tư thế cầu"],
  ["wheel pose", "tư thế bánh xe"],
  ["cobra pose", "tư thế rắn hổ mang"],
  ["locust pose", "tư thế châu chấu"],
  ["bow pose", "tư thế cung"],
  ["pigeon pose", "tư thế bồ câu"],
  ["lotus pose", "tư thế hoa sen"],
  ["seated forward fold", "gập người ngồi"],
  ["standing forward fold", "gập người đứng"],
  ["camel pose", "tư thế lạc đà"],
  ["fish pose", "tư thế cá"],
  ["boat pose", "tư thế thuyền"],
  ["chaturanga", "chaturanga"],
  ["cat cow", "tư thế mèo bò"],
  ["child's pose", "tư thế em bé"],
  ["corpse pose", "tư thế xác"],
  ["half moon pose", "tư thế nửa trăng"],
  ["dancer pose", "tư thế vũ công"],
  ["standing split", "xoạc đứng"],
  ["compass pose", "tư thế la bàn"],
  ["firefly pose", "tư thế đom đóm"],
  ["eight angle pose", "tư thế tám góc"],
  ["peacock pose", "tư thế công"],
  ["splits", "xoạc"],
  ["frog pose", "tư thế ếch"],
  ["lizard pose", "tư thế thằn lằn"],
  ["malasana", "malasana"],
  ["gate pose", "tư thế cổng"],
  ["reclined twist", "xoắn nằm"],
  ["happy baby", "em bé vui"],
  ["thread the needle", "xỏ kim"],
  ["puppy pose", "tư thế chó con"],
  ["sphinx pose", "tư thế nhân sư"],
  ["side angle pose", "tư thế góc nghiêng"],
  ["revolved chair", "ghế xoay"],
  ["garland pose", "tư thế vòng hoa"],
]);

// ─── Partial phrase replacements (applied after exact map miss) ───────────────
const PHRASE_MAP: Array<[string, string]> = [
  ["one arm", "một tay"],
  ["pull up", "hít xà"],
  ["pull-up", "hít xà"],
  ["chin up", "kéo xà"],
  ["chin-up", "kéo xà"],
  ["push up", "hít đất"],
  ["push-up", "hít đất"],
  ["bench press", "đẩy ngực"],
  ["incline press", "đẩy ngực dốc lên"],
  ["decline press", "đẩy ngực dốc xuống"],
  ["shoulder press", "đẩy vai"],
  ["overhead press", "đẩy vai qua đầu"],
  ["lat pulldown", "kéo xô"],
  ["deadlift", "kéo tạ"],
  ["romanian deadlift", "kéo tạ rumani"],
  ["front lever", "đòn bẩy trước"],
  ["back lever", "đòn bẩy sau"],
  ["muscle up", "lên xà"],
  ["muscle-up", "lên xà"],
  ["dip", "xà kép"],
  ["squat", "squat"],
  ["lunge", "chùng chân"],
  ["calf raise", "nâng bắp chân"],
  ["leg extension", "duỗi chân"],
  ["leg curl", "gập chân"],
  ["face pull", "kéo mặt"],
  ["lateral raise", "nâng tay ngang"],
  ["front raise", "nâng tay trước"],
  ["upright row", "kéo tạ đứng"],
  ["row", "chèo"],
  ["barbell", "tạ đòn"],
  ["dumbbell", "tạ đơn"],
  ["cable", "cáp"],
  ["plank", "plank"],
  ["hollow body", "thân rỗng"],
  ["dragon flag", "cờ rồng"],
  ["hanging", "treo"],
  ["knee raise", "nâng gối"],
  ["leg raise", "nâng chân"],
  ["crunch", "gập bụng"],
  ["sit up", "gập bụng ngồi dậy"],
  ["sit-up", "gập bụng ngồi dậy"],
  ["burpee", "burpee"],
  ["jump rope", "nhảy dây"],
  ["mountain climber", "leo núi"],
  ["beginner", "sơ cấp"],
  ["intermediate", "trung cấp"],
  ["advanced", "nâng cao"],
];

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function autoTranslateToVietnamese(text: string | null | undefined): string {
  const input = (text || "").trim();
  if (!input) return "";

  // Check exact map first (case-insensitive)
  const exactMatch = EXACT_MAP.get(input.toLowerCase());
  if (exactMatch) return exactMatch;

  // Fall back to phrase-based replacement
  let out = input;
  for (const [english, vietnamese] of PHRASE_MAP) {
    const regex = new RegExp(`\\b${escapeRegExp(english)}\\b`, "gi");
    out = out.replace(regex, vietnamese);
  }

  return out.replace(/\s+/g, " ").trim();
}

export function resolveVietnameseValue(english: string, preferred?: string | null): string {
  const preferredClean = (preferred || "").trim();
  if (preferredClean && preferredClean.toLowerCase() !== english.trim().toLowerCase()) {
    return preferredClean;
  }
  const translated = autoTranslateToVietnamese(english);
  return translated || english;
}
