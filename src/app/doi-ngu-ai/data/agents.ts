export type Lang = "vi" | "en" | "zh";
export type LocalizedText = Record<Lang, string>;

export type ProofChannel = {
  label: LocalizedText;
  url: string;
  platform: "tiktok" | "facebook" | "web" | "telegram";
};

export type Sen = {
  id: string;
  name: string;
  role: LocalizedText;
  mission: LocalizedText;
  avatar: string;
  proofs?: ProofChannel[];
};

export type DeptColor = "cyan" | "yellow" | "green" | "magenta";

export type Department = {
  key: string;
  label: LocalizedText;
  emoji: string;
  color: DeptColor;
  hex: string;
  members: Sen[];
};

export const departments: Department[] = [
  {
    key: "dieu-phoi",
    label: { vi: "Điều Phối", en: "Coordination", zh: "协调指挥" },
    emoji: "⚡",
    color: "cyan",
    hex: "#00f2ff",
    members: [
      {
        id: "001",
        name: "Sen Prime",
        avatar: "sen-prime.jpg",
        role: { vi: "Điều Phối Tổng", en: "Chief Coordinator", zh: "总协调" },
        mission: {
          vi: "Quản lý chat, route task chéo agent, giám sát fleet 24/7.",
          en: "Manages chat, routes cross-agent tasks, monitors the fleet 24/7.",
          zh: "管理聊天、跨代理任务路由,全天候监督整个舰队。",
        },
      },
      {
        id: "002",
        name: "Sen CEO",
        avatar: "sen-ceo.jpeg",
        role: { vi: "CEO Đại Long", en: "Đại Long CEO", zh: "大龙首席执行官" },
        mission: {
          vi: "Tracking P&L, outreach Zhi Dun CEO, lead-to-revenue pipeline.",
          en: "Tracks P&L, runs Zhi Dun CEO outreach, manages lead-to-revenue pipeline.",
          zh: "追踪损益、智盾合作、潜客到营收管道。",
        },
      },
      {
        id: "003",
        name: "Sen Dispatch",
        avatar: "sen-dispatch.png",
        role: { vi: "Điều Phối Tác Vụ", en: "Orchestrator", zh: "调度师" },
        mission: {
          vi: "Điều phối task chéo agent, thu thập transcript Cowork.",
          en: "Coordinates cross-agent tasks, collects Cowork transcripts.",
          zh: "协调跨代理任务,收集 Cowork 对话记录。",
        },
      },
      {
        id: "004",
        name: "Sen Manus",
        avatar: "sen-manus.png",
        role: { vi: "Nghiên Cứu Chuyên Sâu", en: "Deep Research", zh: "深度研究" },
        mission: {
          vi: "Browser task, market study, competitor analysis chuyên sâu.",
          en: "Browser tasks, market studies, deep competitor analysis.",
          zh: "浏览器任务、市场研究、深度竞争对手分析。",
        },
      },
    ],
  },
  {
    key: "marketing",
    label: { vi: "Tiếp Thị & Kinh Doanh", en: "Marketing & Sales", zh: "营销与销售" },
    emoji: "📣",
    color: "yellow",
    hex: "#ffea00",
    members: [
      {
        id: "005",
        name: "Sen Meta",
        avatar: "sen-meta.jpeg",
        role: { vi: "Quản Lý Facebook", en: "Facebook Manager", zh: "脸书经理" },
        mission: {
          vi: "Đăng bài Page Đại Long, ad approval workflow.",
          en: "Posts to Đại Long Pages, runs the ad approval workflow.",
          zh: "在大龙脸书页发布内容,广告审核工作流。",
        },
        proofs: [
          {
            label: { vi: "FB Page A", en: "FB Page A", zh: "脸书 A 页" },
            url: "https://www.facebook.com/profile.php?id=61560732146657",
            platform: "facebook",
          },
          {
            label: { vi: "FB Page B", en: "FB Page B", zh: "脸书 B 页" },
            url: "https://www.facebook.com/profile.php?id=61589370053042",
            platform: "facebook",
          },
        ],
      },
      {
        id: "006",
        name: "Sen TikTok",
        avatar: "sen-tiktok.jpeg",
        role: { vi: "Nhà Sản Xuất TikTok", en: "TikTok Producer", zh: "TikTok 制作人" },
        mission: {
          vi: "Video giáo dục ngắn, case explainer, demo sản phẩm laser, auto-caption.",
          en: "Short-form education videos, case explainers, laser product demos, auto-caption.",
          zh: "短视频科普、案例讲解、激光产品演示、自动字幕。",
        },
        proofs: [
          {
            label: { vi: "Kênh TikTok", en: "TikTok Channel", zh: "TikTok 频道" },
            url: "https://tiktok.com/@dailongai",
            platform: "tiktok",
          },
        ],
      },
      {
        id: "007",
        name: "Sen Designer",
        avatar: "sen-designer.jpeg",
        role: { vi: "Thiết Kế", en: "Designer", zh: "设计师" },
        mission: {
          vi: "Tạo poster, thumbnail, banner qua Playwright render.",
          en: "Creates posters, thumbnails, banners via Playwright render.",
          zh: "通过 Playwright 渲染创建海报、缩略图和横幅。",
        },
      },
      {
        id: "008",
        name: "Sen Outreach",
        avatar: "sen-outreach.png",
        role: { vi: "Phát Triển Đối Tác", en: "Partner Outreach", zh: "合作伙伴拓展" },
        mission: {
          vi: "Tìm kiếm và tiếp cận đối tác B2B chiến lược.",
          en: "Identifies and engages strategic B2B partners.",
          zh: "寻找和接触战略性 B2B 合作伙伴。",
        },
      },
    ],
  },
  {
    key: "khach-hang",
    label: { vi: "Khách Hàng", en: "Customer", zh: "客户服务" },
    emoji: "💬",
    color: "green",
    hex: "#00ff88",
    members: [
      {
        id: "009",
        name: "Sen Voice",
        avatar: "sen-voice.png",
        role: { vi: "Tư Vấn Giọng Nói", en: "Voice Advisor", zh: "语音顾问" },
        mission: {
          vi: "Trò chuyện tiếng Việt 24/7 qua điện thoại tự nhiên.",
          en: "Natural Vietnamese phone conversations, 24/7.",
          zh: "全天候自然的越南语电话对话。",
        },
      },
      {
        id: "010",
        name: "Sen Meo Meo",
        avatar: "sen-meo-meo.png",
        role: { vi: "Trợ Lý Web", en: "Web Chatbot", zh: "网页聊天机器人" },
        mission: {
          vi: "Tư vấn và thu lead trên dailongai.com.",
          en: "Advises and captures leads on dailongai.com.",
          zh: "在 dailongai.com 上提供咨询并收集潜在客户。",
        },
      },
      {
        id: "011",
        name: "Sen Marketing Ops",
        avatar: "sen-marketing-ops.jpeg",
        role: { vi: "Vận Hành Marketing", en: "Marketing Ops", zh: "营销运营" },
        mission: {
          vi: "Lead enrichment + analytics digest hằng ngày.",
          en: "Daily lead enrichment + analytics digest.",
          zh: "每日潜客信息丰富与分析摘要。",
        },
      },
    ],
  },
  {
    key: "ky-thuat",
    label: { vi: "Kỹ Thuật & Vận Hành", en: "Engineering & Ops", zh: "技术与运营" },
    emoji: "🔧",
    color: "magenta",
    hex: "#ff00ff",
    members: [
      {
        id: "012",
        name: "Sen Coder",
        avatar: "sen-coder.jpeg",
        role: { vi: "Kỹ Sư Phần Mềm AI", en: "AI Software Engineer", zh: "AI 软件工程师" },
        mission: {
          vi: "Lập trình, debug, devops cho toàn bộ hạm đội AI.",
          en: "Programming, debugging, DevOps for the entire AI Fleet.",
          zh: "为整个 AI 舰队提供编程、调试、运维。",
        },
      },
      {
        id: "013",
        name: "Sen VPS",
        avatar: "sen-vps.jpg",
        role: { vi: "Vận Hành VPS", en: "VPS Operator", zh: "VPS 运维" },
        mission: {
          vi: "Deploy, health, log, restart cho VPS sản xuất.",
          en: "Deployment, health, logging, restart for production VPS.",
          zh: "生产 VPS 的部署、健康、日志和重启管理。",
        },
      },
      {
        id: "014",
        name: "Sen Auditor",
        avatar: "sen-auditor.jpeg",
        role: { vi: "Kiểm Toán Hệ Thống", en: "Auditor", zh: "审计员" },
        mission: {
          vi: "Quét secrets, SSL, cost scanner định kỳ.",
          en: "Scheduled secrets, SSL, and cost scanning.",
          zh: "定期扫描密钥、SSL 证书和成本。",
        },
      },
      {
        id: "015",
        name: "Sen Watchdog",
        avatar: "sen-watchdog.jpeg",
        role: { vi: "Giám Sát Hệ Thống", en: "Watchdog", zh: "守望者" },
        mission: {
          vi: "Giám sát Telegram/Zalo/Gateway, auto-recovery.",
          en: "Monitors Telegram/Zalo/Gateway with auto-recovery.",
          zh: "监控 Telegram/Zalo/Gateway,自动恢复。",
        },
      },
      {
        id: "016",
        name: "Sen Daily Report",
        avatar: "sen-daily-report.jpg",
        role: { vi: "Báo Cáo Hằng Ngày", en: "Daily Reporter", zh: "每日报告" },
        mission: {
          vi: "Tổng hợp digest fleet hằng ngày qua Telegram.",
          en: "Aggregates daily fleet digest via Telegram.",
          zh: "通过 Telegram 汇总每日舰队摘要。",
        },
      },
      {
        id: "017",
        name: "Sen Osin Data",
        avatar: "sen-osin-data.jpeg",
        role: { vi: "Dữ Liệu OSIN", en: "OSIN Data", zh: "Osin数据" },
        mission: {
          vi: "Thu thập transcript Cowork, làm sạch, phân loại.",
          en: "Collects, cleans, and classifies Cowork transcripts.",
          zh: "收集、清理和分类 Cowork 对话记录。",
        },
      },
    ],
  },
];

export const allMembers: Sen[] = departments.flatMap((d) => d.members);

export type StackLayer = {
  label: string;
  emoji: string;
  color: "orange" | "cyan" | "yellow" | "green" | "magenta" | "pink";
  hex: string;
  tools: string[];
};

export const stackLayers: StackLayer[] = [
  { label: "AI Layer", emoji: "🤖", color: "orange", hex: "#ff9069",
    tools: ["Claude Opus 4.7", "Claude Sonnet 4.6", "Claude Haiku 4.5", "OpenRouter", "Gemini Imagen"] },
  { label: "Memory", emoji: "🧠", color: "cyan", hex: "#00f2ff",
    tools: ["Supabase Postgres", "shared_memory", "fleet_registry", "fleet_events bus", "Hybrid Vector + Graph"] },
  { label: "Compute", emoji: "⚡", color: "yellow", hex: "#ffea00",
    tools: ["Mac Local", "VPS Linux", "launchd", "cron", "Cloudflare Workers AI"] },
  { label: "Comms", emoji: "📡", color: "green", hex: "#00ff88",
    tools: ["Telegram Bot API", "Zalo OA", "Webhook", "MCP Server", "LiveKit"] },
  { label: "Frontend", emoji: "🌐", color: "magenta", hex: "#ff00ff",
    tools: ["Next.js 15", "React 19", "TypeScript", "Tailwind", "Cloudflare Pages"] },
  { label: "DevOps", emoji: "🛠️", color: "pink", hex: "#ff2d88",
    tools: ["Wrangler", "Playwright", "Mission Control", "Apify", "Google Sheets API"] },
];

/** Pick localized text for the active locale, falling back to English then Vietnamese. */
export function pickLang(text: LocalizedText, locale: string): string {
  if (locale === "vi") return text.vi;
  if (locale === "zh") return text.zh;
  return text.en;
}
