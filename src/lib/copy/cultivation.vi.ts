// src/lib/copy/cultivation.vi.ts — Vietnamese cultivation-themed copy

export const CULTIVATION_VI = {
  onboarding: {
    welcome: {
      title: "Chào mừng, Tu Luyện Giả",
      subtitle: "Hành trình từ Phàm Nhân đến Tiên Nhân bắt đầu từ sự kiên trì",
      description:
        "Nhật Ký Bất Tử là nhật ký tu luyện của bạn. Ghi nhận tình trạng hàng ngày qua điểm danh, rèn luyện cơ thể qua tập luyện, và thăng cấp khi bạn thành thạo mỗi cấp bậc.",
      features: [
        { icon: "📖", title: "Điểm Danh", description: "Theo dõi năng lượng, tâm trạng và thể trạng hàng ngày" },
        { icon: "⚔️", title: "Tập Luyện", description: "Ghi nhận bài tập qua các cấp độ khó tăng dần" },
        { icon: "🏔️", title: "Thăng Hạng", description: "Tiến bộ khi thành thạo bài tập ở cấp hiện tại" },
      ],
      cta: "Bắt Đầu Hành Trình",
    },
    assessment: {
      title: "Đánh Giá Ban Đầu",
      subtitle: "Hãy để chúng tôi hiểu bạn đang ở đâu trên con đường tu luyện",
      trainingExperience: "Bạn đã tập luyện bao lâu?",
      trainingOptions: [
        { value: "new", label: "Mới bắt đầu", description: "Chưa có kinh nghiệm tập luyện" },
        { value: "beginner", label: "Dưới 1 năm", description: "Có một ít kinh nghiệm" },
        { value: "intermediate", label: "1–3 năm", description: "Tập luyện đều đặn" },
        { value: "advanced", label: "3+ năm", description: "Người luyện tập có kinh nghiệm" },
      ],
      primaryGoal: "Mục tiêu chính của bạn là gì?",
      goalOptions: [
        { value: "strength", label: "Tăng Sức Mạnh", description: "Mạnh hơn và có sức bền hơn" },
        { value: "skills", label: "Học Kỹ Năng", description: "Thành thạo các động tác calisthenics" },
        { value: "consistency", label: "Duy Trì Đều Đặn", description: "Xây dựng thói quen tập luyện" },
        { value: "compete", label: "Thi Đấu", description: "Vượt qua giới hạn và thi đấu" },
      ],
      trainingDays: "Bạn có thể tập bao nhiêu ngày mỗi tuần?",
      daysOptions: [
        { value: 2, label: "2–3 ngày" },
        { value: 4, label: "4–5 ngày" },
        { value: 6, label: "6+ ngày" },
      ],
      benchmarkTitle: "Mức Độ Quen Thuộc Với Bài Tập",
      benchmarkSubtitle: "Đánh giá khả năng của bạn với các bài tập cơ bản",
      benchmarkLevels: [
        { value: "no", label: "Không thể" },
        { value: "learning", label: "Đang học" },
        { value: "yes", label: "Dễ dàng" },
      ],
      benchmarkExercises: [
        { id: "pushup", name: "Hít Đất", description: "Toàn bộ biên độ, ngực chạm sàn" },
        { id: "pullup", name: "Kéo Xà", description: "Treo người đến cằm qua xà" },
        { id: "squat", name: "Squat", description: "Ngồi sâu, gót chân chạm đất" },
        { id: "plank", name: "Plank", description: "Giữ 60 giây với tư thế đúng" },
        { id: "dip", name: "Dip", description: "Xà song song, toàn bộ biên độ" },
        { id: "row", name: "Kéo Ngang", description: "Kéo ngang, vòng hoặc xà" },
      ],
    },
    tierAssignment: {
      title: "Cấp Bậc Khởi Đầu",
      subtitle: "Dựa trên đánh giá, chúng tôi đề xuất:",
      adjustPrompt: "Bạn có thể điều chỉnh nếu cảm thấy chưa phù hợp",
      confirmCta: "Chấp Nhận & Tiếp Tục",
      tiers: {
        mortal: {
          name: "Phàm Nhân",
          description: "Khởi đầu con đường. Xây dựng sức mạnh nền tảng và học các động tác cơ bản.",
        },
        initiate: {
          name: "Sơ Cấp",
          description: "Nền tảng đã vững. Đến lúc tinh chỉnh kỹ thuật và xây dựng sức bền.",
        },
        disciple: {
          name: "Đệ Tử",
          description: "Người luyện tập tận tâm. Các động tác trung cấp và tăng tải trọng.",
        },
        master: {
          name: "Sư Phụ",
          description: "Làm chủ cơ thể và tinh thần. Động tác nâng cao và độ khó cao.",
        },
        grandmaster: {
          name: "Đại Sư",
          description: "Cấp độ tinh anh. Thành thạo các động tác phức tạp và hiệu suất đỉnh cao.",
        },
        immortal: {
          name: "Tiên Nhân",
          description: "Siêu phàm. Đỉnh cao thành tựu thể chất con người.",
        },
      },
    },
    firstCheckin: {
      title: "Lần Điểm Danh Đầu Tiên",
      subtitle: "Hãy thiết lập mức cơ sở bằng cách ghi nhận tình trạng hiện tại",
      explanation: "Điểm danh theo dõi cảm giác hàng ngày. Qua thời gian, các mô hình sẽ xuất hiện giúp tối ưu hóa tập luyện.",
      fields: {
        weight: "Cân Nặng Hiện Tại (tùy chọn)",
        comment: "Hôm nay bạn cảm thấy thế nào?",
        commentPlaceholder: "Ghi chú về năng lượng, tâm trạng, hoặc thể trạng...",
      },
      successTitle: "Nhật Ký Tu Luyện Đã Bắt Đầu",
      successMessage: "Bản ghi đầu tiên đã được lưu. Kiên trì là nền tảng của mọi tiến bộ.",
      cta: "Ghi Điểm Danh",
    },
    tour: {
      title: "Trung Tâm Tu Luyện",
      subtitle: "Tổng quan nhanh những gì có sẵn cho bạn",
      tabs: [
        { name: "Điểm Danh", description: "Ghi nhận tình trạng hàng ngày — cân nặng, tâm trạng và ghi chú", icon: "📖" },
        { name: "Tập Luyện", description: "Chọn bài tập và ghi nhận buổi tập", icon: "⚔️" },
        { name: "Thư Viện Bài Tập", description: "Duyệt tất cả bài tập theo cấp và nhóm cơ", icon: "📜" },
        { name: "Cộng Đồng", description: "Xem bạn bè đang tập gì và giữ động lực", icon: "🏔️" },
        { name: "Thăng Hạng", description: "Theo dõi tiến độ và thăng cấp tu luyện", icon: "⭐" },
      ],
      cta: "Vào Sân Tập Luyện",
    },
    skipConfirm: {
      title: "Bỏ Qua Hướng Dẫn?",
      message: "Bạn luôn có thể truy cập cài đặt và bài tập sau. Bạn có chắc muốn bỏ qua không?",
      confirm: "Có, Bỏ Qua",
      cancel: "Tiếp Tục Cài Đặt",
    },
    progress: {
      step: "Bước",
      of: "trên",
    },
  },

  emptyStates: {
    checkins: {
      title: "Nhật Ký Tu Luyện Đang Chờ",
      description: "Điểm danh hàng ngày theo dõi năng lượng, tâm trạng và sự tập trung. Ghi nhận đều đặn giúp phát hiện các mô hình trong sự sẵn sàng tập luyện.",
      primaryCta: "Ghi Điểm Danh Đầu Tiên",
    },
    trainingLog: {
      title: "Sân Tập Luyện Đã Sẵn Sàng",
      description: "Chọn bài tập từ cấp hiện tại và ghi nhận buổi tập đầu tiên. Mỗi rep là một bước trên con đường.",
      primaryCta: "Bắt Đầu Tập",
      secondaryCta: "Duyệt Bài Tập",
    },
    feed: {
      title: "Con Đường Không Cần Đi Một Mình",
      description: "Kết nối với các tu luyện giả khác để chia sẻ tiến độ và giữ động lực. Thêm bạn bè bằng mã tu luyện duy nhất.",
      primaryCta: "Thêm Bạn Đầu Tiên",
      secondaryCta: "Chia Sẻ Mã Của Bạn",
    },
    friends: {
      title: "Chưa Có Bạn Tu Luyện",
      description: "Chia sẻ mã bạn bè hoặc nhập mã của người khác để kết nối. Bạn bè có thể thấy tiến độ và cổ vũ nhau.",
      primaryCta: "Chia Sẻ Mã Của Tôi",
      secondaryCta: "Thêm Mã Bạn Bè",
    },
    progress: {
      title: "Hành Trình Vừa Bắt Đầu",
      description: "Hoàn thành thêm buổi tập để mở khóa thăng hạng. Thành thạo đòi hỏi nỗ lực kiên trì ở cấp hiện tại.",
      primaryCta: "Đi Tập Luyện",
      progressLabel: "buổi tập đã ghi",
    },
    exerciseSearch: {
      title: "Không Có Bài Tập Phù Hợp",
      description: "Thử điều chỉnh bộ lọc hoặc từ tìm kiếm",
      primaryCta: "Xóa Bộ Lọc",
    },
  },

  gettingStarted: {
    title: "Bắt Đầu",
    subtitle: "Hoàn thành các bước này để bắt đầu hành trình tu luyện",
    tasks: {
      firstCheckin: { title: "Hoàn thành lần điểm danh đầu", description: "Ghi nhận tình trạng hàng ngày" },
      firstTraining: { title: "Ghi nhận buổi tập đầu tiên", description: "Bắt đầu xây dựng hồ sơ" },
      exploreLibrary: { title: "Khám phá thư viện bài tập", description: "Tìm bài tập cho cấp của bạn" },
      addFriend: { title: "Thêm bạn đầu tiên", description: "Kết nối với tu luyện giả khác" },
      customizeSettings: { title: "Tùy chỉnh cài đặt", description: "Cá nhân hóa ứng dụng" },
    },
    allComplete: "Tuyệt vời! Bạn đã hoàn thành các bước khởi đầu.",
    dismiss: "Đóng",
  },

  celebrations: {
    firstCheckin: {
      title: "Đã Ghi Lần Đầu!",
      description: "Nhật ký tu luyện đã bắt đầu. Kiên trì xây nền tảng.",
    },
    firstTraining: {
      title: "Buổi Tập Đầu Tiên!",
      description: "Hành trình ngàn dặm bắt đầu từ một bước chân.",
    },
    firstFriend: {
      title: "Đã Tìm Được Bạn Đồng Hành!",
      description: "Con đường dễ dàng hơn với đồng minh. Chia sẻ tiến độ cùng nhau.",
    },
    streak7: {
      title: "Chuỗi 7 Ngày!",
      description: "Sự kiên trì củng cố nền tảng. Tiếp tục tu luyện.",
    },
    rankUp: {
      title: "Đột Phá!",
      description: "Bạn đã đột phá đến cảnh giới mới!",
    },
    gettingStartedComplete: {
      title: "Nền Tảng Hoàn Thành!",
      description: "Bạn đã thành thạo cơ bản. Hành trình thực sự bắt đầu.",
    },
  },

  tiers: {
    mortal: { name: "Phàm Nhân", description: "Khởi đầu. Xây dựng sức mạnh nền tảng." },
    initiate: { name: "Sơ Cấp", description: "Nền tảng đã vững. Tinh chỉnh kỹ thuật." },
    disciple: { name: "Đệ Tử", description: "Người luyện tập tận tâm. Trung cấp." },
    master: { name: "Sư Phụ", description: "Làm chủ cơ thể và tinh thần." },
    grandmaster: { name: "Đại Sư", description: "Cấp tinh anh. Hiệu suất đỉnh cao." },
    immortal: { name: "Tiên Nhân", description: "Siêu phàm. Đỉnh cao thành tựu." },
  },

  actions: {
    checkIn: "Ghi nhận tình trạng tu luyện hàng ngày",
    train: "Rèn luyện cơ thể qua tập luyện",
    rankUp: "Thăng tiến đến cảnh giới mới",
  },

  hints: {
    checkinForm: { title: "Điểm Danh Hàng Ngày", description: "Ghi nhận cân nặng và ghi chú để theo dõi mô hình qua thời gian." },
    trainTab: { title: "Sân Tập Luyện", description: "Chọn bài tập để bắt đầu ghi nhận set và rep." },
    exerciseDb: { title: "Thư Viện Bài Tập", description: "Lọc theo cấp hoặc nhóm cơ để tìm bài tập phù hợp." },
    progression: { title: "Lộ Trình Tiến Bộ", description: "Mỗi bài tập có biến thể và modifier để tăng độ khó." },
    rankUp: { title: "Thăng Hạng", description: "Ghi nhận đủ buổi tập ở cấp hiện tại để mở khóa thăng hạng." },
    friendRequest: { title: "Lời Mời Kết Bạn", description: "Chấp nhận để xem hoạt động tập luyện của nhau." },
  },
} as const;
