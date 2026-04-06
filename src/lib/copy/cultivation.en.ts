// src/lib/copy/cultivation.en.ts — English cultivation-themed copy

export const CULTIVATION_EN = {
  onboarding: {
    welcome: {
      title: "Welcome, Cultivator",
      subtitle: "Your journey from Mortal to Immortal begins with consistent practice",
      description:
        "Immortal's Log is your cultivation journal. Track your daily state with check-ins, forge your body through training, and advance through the ranks as you master each tier.",
      features: [
        { icon: "📖", title: "Check-Ins", description: "Track your daily energy, mood, and physical state" },
        { icon: "⚔️", title: "Training", description: "Log exercises across progressive tiers of difficulty" },
        { icon: "🏔️", title: "Rank Up", description: "Advance when you master exercises at your current tier" },
      ],
      cta: "Begin Your Path",
    },
    assessment: {
      title: "Initial Assessment",
      subtitle: "Let us understand where you stand on the cultivation path",
      trainingExperience: "How long have you been training?",
      trainingOptions: [
        { value: "new", label: "Just starting out", description: "No formal training experience" },
        { value: "beginner", label: "Less than 1 year", description: "Some training experience" },
        { value: "intermediate", label: "1–3 years", description: "Regular training habit" },
        { value: "advanced", label: "3+ years", description: "Experienced practitioner" },
      ],
      primaryGoal: "What is your primary goal?",
      goalOptions: [
        { value: "strength", label: "Build Strength", description: "Get stronger and more powerful" },
        { value: "skills", label: "Learn Skills", description: "Master calisthenics movements" },
        { value: "consistency", label: "Stay Consistent", description: "Build a regular training habit" },
        { value: "compete", label: "Compete", description: "Push limits and compete" },
      ],
      trainingDays: "How many days per week can you train?",
      daysOptions: [
        { value: 2, label: "2–3 days" },
        { value: 4, label: "4–5 days" },
        { value: 6, label: "6+ days" },
      ],
      benchmarkTitle: "Exercise Familiarity",
      benchmarkSubtitle: "Rate your ability with these benchmark exercises",
      benchmarkLevels: [
        { value: "no", label: "Can't do it" },
        { value: "learning", label: "Learning" },
        { value: "yes", label: "Yes, easily" },
      ],
      benchmarkExercises: [
        { id: "pushup", name: "Push-Up", description: "Full range of motion, chest to floor" },
        { id: "pullup", name: "Pull-Up", description: "Dead hang to chin over bar" },
        { id: "squat", name: "Bodyweight Squat", description: "Full depth, heels on ground" },
        { id: "plank", name: "Plank", description: "Hold 60 seconds with good form" },
        { id: "dip", name: "Dip", description: "Parallel bars, full range" },
        { id: "row", name: "Bodyweight Row", description: "Horizontal pull, rings or bar" },
      ],
    },
    tierAssignment: {
      title: "Your Starting Tier",
      subtitle: "Based on your assessment, we recommend:",
      adjustPrompt: "You can adjust this if you feel it doesn't match your level",
      confirmCta: "Accept & Continue",
      tiers: {
        mortal: {
          name: "Mortal",
          description: "The beginning of the path. Building foundational strength and learning basic movements.",
        },
        initiate: {
          name: "Initiate",
          description: "The foundations are set. Time to refine technique and build endurance.",
        },
        disciple: {
          name: "Disciple",
          description: "A dedicated practitioner. Intermediate movements and progressive overload.",
        },
        master: {
          name: "Master",
          description: "Command over body and mind. Advanced movements and high skill ceiling.",
        },
        grandmaster: {
          name: "Grandmaster",
          description: "Elite level. Mastery of complex movements and peak performance.",
        },
        immortal: {
          name: "Immortal",
          description: "Transcendent. The pinnacle of human physical achievement.",
        },
      },
    },
    firstCheckin: {
      title: "Your First Check-In",
      subtitle: "Let's establish your baseline by logging your current state",
      explanation: "Check-ins track how you feel day to day. Over time, patterns emerge that help optimize your training.",
      fields: {
        weight: "Current Weight (optional)",
        comment: "How are you feeling today?",
        commentPlaceholder: "Any notes about your energy, mood, or physical state...",
      },
      successTitle: "Your Cultivation Journal Has Begun",
      successMessage: "Your first entry is recorded. Consistency is the foundation of all progress.",
      cta: "Log Check-In",
    },
    tour: {
      title: "Your Cultivation Hub",
      subtitle: "A quick look at what's available to you",
      tabs: [
        { name: "Check-In", description: "Log your daily state — weight, mood, and notes", icon: "📖" },
        { name: "Train", description: "Select exercises and log your training sessions", icon: "⚔️" },
        { name: "Exercise Library", description: "Browse all exercises organized by tier and muscle group", icon: "📜" },
        { name: "Community", description: "See what your friends are training and stay motivated", icon: "🏔️" },
        { name: "Rank Up", description: "Track progress and advance to the next cultivation tier", icon: "⭐" },
      ],
      cta: "Enter the Training Grounds",
    },
    skipConfirm: {
      title: "Skip Onboarding?",
      message: "You can always access settings and exercises later. Are you sure you want to skip?",
      confirm: "Yes, Skip",
      cancel: "Continue Setup",
    },
    progress: {
      step: "Step",
      of: "of",
    },
  },

  emptyStates: {
    checkins: {
      title: "Your Cultivation Journal Awaits",
      description: "Daily check-ins track your energy, mood, and focus. Consistent logging reveals patterns in your training readiness.",
      primaryCta: "Log First Check-In",
    },
    trainingLog: {
      title: "The Training Grounds Are Ready",
      description: "Select an exercise from your current tier and log your first session. Every rep is a step on the path.",
      primaryCta: "Start Training",
      secondaryCta: "Browse Exercises",
    },
    feed: {
      title: "The Path Need Not Be Walked Alone",
      description: "Connect with fellow cultivators to share progress and stay motivated. Add friends using their unique cultivation code.",
      primaryCta: "Add First Friend",
      secondaryCta: "Share Your Code",
    },
    friends: {
      title: "No Cultivation Partners Yet",
      description: "Share your friend code or enter someone else's to connect. Friends can see each other's progress and cheer each other on.",
      primaryCta: "Share My Code",
      secondaryCta: "Add Friend Code",
    },
    progress: {
      title: "Your Journey Has Just Begun",
      description: "Complete more training sessions to unlock rank advancement. Mastery requires consistent effort at your current tier.",
      primaryCta: "Go to Training",
      progressLabel: "sessions logged",
    },
    exerciseSearch: {
      title: "No Exercises Match Your Search",
      description: "Try adjusting your filters or search terms",
      primaryCta: "Clear Filters",
    },
  },

  gettingStarted: {
    title: "Getting Started",
    subtitle: "Complete these steps to begin your cultivation journey",
    tasks: {
      firstCheckin: { title: "Complete your first check-in", description: "Log your daily state" },
      firstTraining: { title: "Log your first training session", description: "Start building your record" },
      exploreLibrary: { title: "Explore the exercise library", description: "Discover exercises for your tier" },
      addFriend: { title: "Add your first friend", description: "Connect with a fellow cultivator" },
      customizeSettings: { title: "Customize your settings", description: "Make the app your own" },
    },
    allComplete: "Excellent! You've completed the getting started tasks.",
    dismiss: "Dismiss",
  },

  celebrations: {
    firstCheckin: {
      title: "First Entry Recorded!",
      description: "Your cultivation journal has begun. Consistency builds the foundation.",
    },
    firstTraining: {
      title: "First Session Logged!",
      description: "The path of a thousand miles begins with a single step.",
    },
    firstFriend: {
      title: "Companion Found!",
      description: "The path is easier with allies. Share your progress together.",
    },
    streak7: {
      title: "7-Day Streak!",
      description: "Your dedication strengthens your foundation. Keep cultivating.",
    },
    rankUp: {
      title: "Breakthrough!",
      description: "You have broken through to a new realm!",
    },
    gettingStartedComplete: {
      title: "Foundation Complete!",
      description: "You've mastered the basics. The real journey begins now.",
    },
  },

  tiers: {
    mortal: { name: "Mortal", description: "The beginning of the path. Building foundational strength." },
    initiate: { name: "Initiate", description: "The foundations are set. Refining technique." },
    disciple: { name: "Disciple", description: "A dedicated practitioner. Intermediate mastery." },
    master: { name: "Master", description: "Command over body and mind." },
    grandmaster: { name: "Grandmaster", description: "Elite level. Peak performance." },
    immortal: { name: "Immortal", description: "Transcendent. The pinnacle of achievement." },
  },

  actions: {
    checkIn: "Record your daily cultivation state",
    train: "Forge your body through practice",
    rankUp: "Advance to the next realm",
  },

  hints: {
    checkinForm: { title: "Daily Check-In", description: "Record your weight and notes to track patterns over time." },
    trainTab: { title: "Training Grounds", description: "Select an exercise to start logging your sets and reps." },
    exerciseDb: { title: "Exercise Library", description: "Filter by tier or muscle group to find exercises at your level." },
    progression: { title: "Progression Path", description: "Each exercise has variations and modifiers to increase difficulty." },
    rankUp: { title: "Rank Advancement", description: "Log enough sessions at your tier to unlock advancement." },
    friendRequest: { title: "Friend Request", description: "Accept to see each other's training activity." },
  },
} as const;
