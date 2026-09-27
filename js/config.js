// Centralized game balance/content. Keep game rules out of the UI layer.
export const BALANCE = {
  version: 5,
  targets: {
    study: 60,
    meditation: 20,
    protein: 90,
    calories: 2800,
    anki: 25,
    sleep: 8,
    skincare: 2,
    wakeHour: 7,
    morningMeditationEndHour: 10
  },
  quantity: {
    study: [
      { at: 10, xp: 12, gold: 2 }, { at: 30, xp: 28, gold: 5 },
      { at: 60, xp: 55, gold: 10 }, { at: 120, xp: 105, gold: 18 },
      { at: 180, xp: 150, gold: 25 }, { at: 240, xp: 195, gold: 32 },
      { at: 360, xp: 280, gold: 46 }, { at: 480, xp: 360, gold: 60 },
      { at: 600, xp: 440, gold: 75 }
    ],
    meditation: [
      { at: 5, xp: 8, gold: 2 }, { at: 10, xp: 12, gold: 2 }, { at: 20, xp: 20, gold: 4 },
      { at: 30, xp: 32, gold: 6 }, { at: 45, xp: 48, gold: 9 }, { at: 60, xp: 66, gold: 12 }
    ],
    protein: [{ at: 90, xp: 25, gold: 5 }],
    calories: [{ at: 2800, xp: 25, gold: 5 }],
    anki: [
      { at: 25, xp: 12, gold: 3 }, { at: 50, xp: 20, gold: 5 }, { at: 100, xp: 28, gold: 7 },
      { at: 250, xp: 55, gold: 12 }, { at: 500, xp: 95, gold: 20 }, { at: 1000, xp: 160, gold: 34 }
    ],
    sleep: [{ at: 8, xp: 20, gold: 4 }],
    skincare: [{ at: 1, xp: 10, gold: 2 }, { at: 2, xp: 20, gold: 4 }],
    water: [{ at: 3, xp: 30, gold: 6 }]
  },
  pointAwards: {
    ankiGoodDoctorPer25: 1,
    studyGoodDoctorPerHour: 5,
    studyTenHourSessionBonus: 20,
    studySevenDayBonus: 70,
    noMasturbationDayGreatDiscipline: 10,
    noMasturbationSevenDayBonus: 70,
    meditationGreatDisciplinePer20Min: 10,
    meditationSevenDayBonus: 70,
    morningMeditationBonus: 40
  }
};

export const DAILY_WORK = [
  ["brush-am", "Brush Teeth — Morning", "Personal care", "boolean", 10, 2, { DISCIPLINE: 1 }, {}],
  ["brush-pm", "Brush Teeth — Night", "Personal care", "boolean", 10, 2, { DISCIPLINE: 1 }, {}],
  ["skin-1", "Skin Care — Once", "Personal care", "quantity", 10, 2, { CHA: 1 }, { metric: "skincare", target: 1, unit: "time" }],
  ["skin-2", "Skin Care — Twice", "Personal care", "quantity", 20, 4, { CHA: 1 }, { metric: "skincare", target: 2, unit: "times" }],
  ["exercise", "Exercise", "Fitness", "boolean", 50, 10, { STR: 2, VIT: 1 }, {}],
  ["study", "Study", "Study", "quantity", 0, 0, { INT: 1, FOCUS: 1 }, { metric: "study", target: 60, unit: "min" }],
  ["meditation", "Meditation", "Mindfulness", "quantity", 0, 0, { WIS: 1, DISCIPLINE: 1 }, { metric: "meditation", target: 20, unit: "min" }],
  ["protein", "Protein Target", "Health", "quantity", 0, 0, { VIT: 1 }, { metric: "protein", target: 90, unit: "g" }],
  ["calories", "Calorie Target", "Health", "quantity", 0, 0, { VIT: 1 }, { metric: "calories", target: 2800, unit: "kcal" }],
  ["anki", "Anki — 25 Cards", "Study", "quantity", 0, 0, { INT: 1 }, { metric: "anki", target: 25, unit: "cards" }],
  ["no-porn", "No Toxin Detected", "Digital attention", "boolean", 100, 25, { WILLPOWER: 3, DISCIPLINE: 3 }, { private: true }],
  ["no-masturbation", "A Day Freed", "Discipline", "boolean", 100, 25, { DISCIPLINE: 2, WILLPOWER: 3 }, { private: true, highDifficulty: true }],
  ["wake-early", "Wake Up Early", "Discipline", "boolean", 25, 8, { DISCIPLINE: 1 }, { timeTarget: "07:00" }],
  ["sleep-8", "Sleep — 8 Hours", "Health", "quantity", 0, 0, { VIT: 1 }, { metric: "sleep", target: 8, unit: "hours" }],
  ["water", "Tidecaller's Rite — Drink 3 Liters", "Health", "quantity", 0, 0, { VIT: 2 }, { metric: "water", target: 3, unit: "liters" }],
  ["creatine", "Creatine Routine", "Health", "boolean", 15, 4, { DISCIPLINE: 1 }, {}],
  ["care-schedule", "Medication / Care Routine", "Health", "boolean", 15, 4, { DISCIPLINE: 1 }, { private: true }],
  ["hair", "Hair Care", "Personal care", "boolean", 10, 2, { CHA: 1 }, { optional: true }]
].map(([id, name, category, mode, xp, gold, attributes, meta]) => ({
  id: `daily-${id}`,
  name,
  category,
  recurring: true,
  kind: "daily",
  mode,
  enabled: meta.optional ? false : true,
  reward: { xp, gold, attributes },
  ...(meta || {}),
  createdAt: "seed"
}));

const pools = {
  Study: [
    ["Study for 10 minutes", "metric", "study", 10], ["Study for 30 minutes", "metric", "study", 30],
    ["Study for 60 minutes", "metric", "study", 60], ["Read 5 textbook pages", "boolean"],
    ["Read 10 textbook pages", "boolean"], ["Solve 5 MCQs", "boolean"], ["Solve 10 MCQs", "boolean"],
    ["Review one lecture", "boolean"], ["Explain one topic aloud", "boolean"], ["Revise yesterday's material", "boolean"],
    ["Open the book and begin immediately", "boolean"], ["Finish one small unfinished study item", "boolean"],
    ["Study one topic you have been avoiding", "boolean"], ["Write a 5-line summary from memory", "boolean"]
  ],
  Anki: [
    ["Solve 25 Anki cards", "metric", "anki", 25], ["Solve 50 Anki cards", "metric", "anki", 50],
    ["Make 3 useful Anki cards", "boolean"], ["Review a small Anki backlog", "boolean"],
    ["Do Anki before entertainment", "boolean"], ["Review yesterday's difficult cards", "boolean"],
    ["Tag or organize 10 cards", "boolean"], ["Suspend 5 obviously low-value cards", "boolean"]
  ],
  Knowledge: [
    ["Learn one unfamiliar word", "boolean"], ["Read a psychology article", "boolean"], ["Research one concept", "boolean"],
    ["Summarize one idea in 3 sentences", "boolean"], ["Learn one argument from a debate", "boolean"],
    ["Read one long-form article", "boolean"], ["Learn one historical event", "boolean"],
    ["Steelman a position you disagree with", "boolean"], ["Learn one scientific discovery", "boolean"],
    ["Explain one concept without notes", "boolean"], ["Learn one concept from outside medicine", "boolean"],
    ["Write down one thing you changed your mind about", "boolean"]
  ],
  Literature: [
    ["Read 5 pages of a book", "boolean"], ["Read 10 pages of a book", "boolean"], ["Read one poem", "boolean"],
    ["Write a 3-sentence summary of what you read", "boolean"], ["Read one essay", "boolean"],
    ["Read one page slowly and annotate it", "boolean"], ["Write one favorite sentence from today's reading", "boolean"]
  ],
  Courage: [
    ["Ask one useful question", "boolean"], ["Make one necessary call", "boolean"], ["Speak once during rounds", "boolean"],
    ["Ask for clarification instead of avoiding", "boolean"], ["Do one task before a reminder", "boolean"],
    ["Volunteer for one small responsibility", "boolean"], ["Practice a difficult sentence before saying it", "boolean"],
    ["Approach a senior respectfully despite nervousness", "boolean"], ["Admit when you do not know something", "boolean"],
    ["Ask for help when you genuinely need it", "boolean"], ["Complete one delayed professional task", "boolean"]
  ],
  Kindness: [
    ["Thank someone sincerely", "boolean"], ["Help a classmate", "boolean"], ["Compliment someone sincerely", "boolean"],
    ["Listen without interrupting", "boolean"], ["Check on a friend", "boolean"], ["Thank support staff", "boolean"],
    ["Send an encouraging message", "boolean"], ["Do one anonymous kind action", "boolean"],
    ["Be especially patient with someone today", "boolean"], ["Offer useful help without being asked", "boolean"],
    ["Let someone go first", "boolean"], ["Say something kind you normally keep to yourself", "boolean"],
    ["Forgive a small irritation instead of escalating", "boolean"], ["Make someone's day a little easier", "boolean"]
  ],
  Social: [
    ["Start one small conversation", "boolean"], ["Ask someone how their day truly was", "boolean"],
    ["Talk to someone without looking at your phone", "boolean"], ["Remember someone's name and use it", "boolean"],
    ["Introduce yourself clearly", "boolean"], ["Ask an open-ended question", "boolean"]
  ],
  "Self-care": [
    ["Prepare clothes for tomorrow", "boolean"], ["Prepare your bag", "boolean"], ["Clean your desk for 5 minutes", "boolean"],
    ["Fill your water bottle", "boolean"], ["Put away 10 items", "boolean"], ["Make your bed", "boolean"],
    ["Organize one drawer", "boolean"], ["Take a proper shower", "boolean"], ["Do your skincare", "boolean"],
    ["Do hair care", "boolean"], ["Prepare tomorrow's essentials", "boolean"]
  ],
  Fitness: [
    ["Perform 5 minutes of mobility", "boolean"], ["Stretch after training", "boolean"], ["Prepare gym clothes", "boolean"],
    ["Prepare your gym bag", "boolean"], ["Walk briefly outdoors", "boolean"], ["Log today's workout", "boolean"],
    ["Complete a mobility session", "boolean"], ["Plan your next workout", "boolean"], ["Go to the gym", "boolean"],
    ["Do a careful warm-up", "boolean"], ["Record one personal best or training note", "boolean"]
  ],
  "Digital attention": [
    ["Avoid scrolling for 15 minutes", "boolean"], ["Avoid scrolling for 30 minutes", "boolean"],
    ["Put the phone away during one task", "boolean"], ["Complete one task before social media", "boolean"],
    ["Remove one unnecessary notification", "boolean"], ["No phone during one meal", "boolean"],
    ["Replace one scrolling impulse with a real action", "boolean"], ["Use a distraction blocker", "boolean"],
    ["Keep your phone out of reach during study", "boolean"], ["Do not open short-form video until a planned task is done", "boolean"],
    ["Take one 30-minute notification-free block", "boolean"]
  ],
  Organization: [
    ["Prepare tomorrow tonight", "boolean"], ["Plan tomorrow's first task", "boolean"], ["Set out clothes tonight", "boolean"],
    ["Pack your bag before bed", "boolean"], ["Review tomorrow's commitments", "boolean"],
    ["Finish one administrative task", "boolean"], ["Clear five unnecessary tabs", "boolean"],
    ["Clear one small surface", "boolean"], ["Throw away obvious rubbish", "boolean"]
  ],
  Punctuality: [
    ["Arrive 10 minutes early somewhere", "boolean"], ["Plan enough travel time", "boolean"],
    ["Check tomorrow's schedule before bed", "boolean"], ["Leave for your next commitment on time", "boolean"],
    ["Write tomorrow's top 3 priorities", "boolean"]
  ],
  Creativity: [
    ["Write 100 words", "boolean"], ["Write a paragraph", "boolean"], ["Work on your book for 10 minutes", "boolean"],
    ["Write one world-building idea", "boolean"], ["Sketch something", "boolean"], ["Develop a fictional character", "boolean"],
    ["Write one video idea", "boolean"], ["Outline one educational video", "boolean"], ["Rewrite one paragraph", "boolean"],
    ["Write one interesting observation", "boolean"]
  ],
  Mindfulness: [
    ["Meditate for 5 minutes", "metric", "meditation", 5], ["Meditate for 10 minutes", "metric", "meditation", 10],
    ["Meditate for 20 minutes", "metric", "meditation", 20], ["Sit quietly for 5 minutes", "boolean"],
    ["Notice your surroundings for 2 minutes", "boolean"], ["Take 10 slow breaths", "boolean"],
    ["Do one task without multitasking", "boolean"], ["Pause before reacting to an irritation", "boolean"],
    ["Spend 5 minutes without entertainment", "boolean"]
  ],
  Nutrition: [
    ["Reach 90 g protein", "metric", "protein", 90], ["Reach your calorie target", "metric", "calories", 2800],
    ["Prepare a protein-rich meal", "boolean"], ["Prepare a convenient calorie-dense snack", "boolean"],
    ["Log today's protein early", "boolean"], ["Plan tomorrow's first meal", "boolean"], ["Eat a planned meal instead of skipping it", "boolean"]
  ],
  Recovery: [
    ["Put the phone down and return to one task", "boolean"], ["Complete one 10-minute recovery action", "boolean"],
    ["Clean the immediate area and restart", "boolean"], ["Drink water and return to the next task", "boolean"],
    ["Complete one thing you have been avoiding", "boolean"]
  ],
  Reflection: [
    ["Write one thing you did well today", "boolean"], ["Write one thing you learned today", "boolean"],
    ["Identify tomorrow's first action", "boolean"], ["Notice one trigger that made you avoid a task", "boolean"],
    ["Write one sentence you would tell future Mimi", "boolean"], ["Record one personal win", "boolean"]
  ]
};

function attrFor(category) {
  if (["Study", "Anki", "Knowledge", "Literature"].includes(category)) return { INT: 1, FOCUS: 1 };
  if (category === "Courage") return { RESILIENCE: 1, COURAGE: 1 };
  if (category === "Kindness" || category === "Social") return { CHA: 1 };
  if (category === "Fitness") return { STR: 1, VIT: 1 };
  if (["Self-care", "Punctuality", "Organization"].includes(category)) return { DISCIPLINE: 1 };
  if (category === "Digital attention") return { WILLPOWER: 1, FOCUS: 1 };
  if (category === "Creativity") return { WIS: 1 };
  if (category === "Mindfulness") return { WIS: 1, DISCIPLINE: 1 };
  if (category === "Nutrition") return { VIT: 1 };
  if (category === "Recovery") return { RESILIENCE: 1 };
  if (category === "Reflection") return { WIS: 1, RESILIENCE: 1 };
  return { DISCIPLINE: 1 };
}

export const RANDOM_LIBRARY = Object.entries(pools).flatMap(([category, items]) => items.map(([name, actionType, metric, target], index) => ({
  id: `random-${category}-${index}`.replace(/\s+/g, "-").toLowerCase(),
  name,
  category,
  difficulty: ((index + category.length) % 3) + 1,
  estimatedMinutes: target ? (metric === "calories" || metric === "protein" ? 5 : metric === "anki" ? 10 : target) : [5, 10, 15, 20, 30][index % 5],
  friction: ["low", "medium", "high"][index % 3],
  actionType,
  metric: actionType === "metric" ? metric : null,
  target: actionType === "metric" ? target : null,
  avoidGroup: category,
  attributes: attrFor(category)
})));

export function seededRandom(seed) {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => ((h = Math.imul(h ^ (h >>> 13), 1274126177)) >>> 0) / 4294967296;
}

export function dailyRandomQuests(date, recentTemplateIds = [], count = 5) {
  const r = seededRandom(`mimi:${date}`), items = [...RANDOM_LIBRARY], chosen = [];
  const recent = new Set(recentTemplateIds);
  let guard = 0;
  while (chosen.length < count && items.length && guard++ < 1000) {
    const i = Math.floor(r() * items.length);
    const candidate = items.splice(i, 1)[0];
    if (chosen.some(q => q.category === candidate.category)) continue;
    if (recent.has(candidate.id) && items.length > count) continue;
    chosen.push(candidate);
  }
  return chosen;
}
