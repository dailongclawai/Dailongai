export type Sen = {
  id: string;
  name: string;
  role: string;
  mission: string;
  avatar: string;
};

export type DeptColor = "cyan" | "yellow" | "green" | "magenta";

export type Department = {
  key: string;
  label: string;
  emoji: string;
  color: DeptColor;
  hex: string;
  members: Sen[];
};

export const departments: Department[] = [
  {
    key: "dieu-phoi",
    label: "Điều Phối",
    emoji: "⚡",
    color: "cyan",
    hex: "#00f2ff",
    members: [
      { id: "001", name: "Sen Prime", role: "Điều Phối Tổng", mission: "Quản lý chat, route task chéo agent, giám sát fleet 24/7.", avatar: "sen-prime.jpg" },
      { id: "002", name: "Sen CEO", role: "CEO Đại Long", mission: "Tracking P&L, outreach Zhi Dun, lead-to-revenue pipeline.", avatar: "sen-ceo.jpeg" },
      { id: "003", name: "Sen Dispatch", role: "Orchestrator", mission: "Điều phối task chéo agent, thu thập transcript Cowork.", avatar: "sen-dispatch.png" },
      { id: "004", name: "Sen Manus", role: "Deep Research", mission: "Browser task, market study, competitor analysis chuyên sâu.", avatar: "sen-manus.png" },
    ],
  },
  {
    key: "marketing",
    label: "Marketing & Sales",
    emoji: "📣",
    color: "yellow",
    hex: "#ffea00",
    members: [
      { id: "005", name: "Sen Meta", role: "Facebook Manager", mission: "Đăng bài Page Đại Long, ad approval workflow.", avatar: "sen-meta.jpeg" },
      { id: "006", name: "Sen TikTok", role: "TikTok Producer", mission: "Sports repost, video upload, auto-caption tự động.", avatar: "sen-tiktok.jpeg" },
      { id: "007", name: "Sen Designer", role: "Designer", mission: "Tạo poster, thumbnail, banner qua Playwright render.", avatar: "sen-designer.jpeg" },
      { id: "008", name: "Sen Outreach", role: "Partner Outreach", mission: "Tìm kiếm và tiếp cận đối tác B2B chiến lược.", avatar: "sen-outreach.png" },
    ],
  },
  {
    key: "khach-hang",
    label: "Khách Hàng",
    emoji: "💬",
    color: "green",
    hex: "#00ff88",
    members: [
      { id: "009", name: "Sen Voice", role: "Tư Vấn Giọng Nói", mission: "Trò chuyện tiếng Việt 24/7 qua điện thoại tự nhiên.", avatar: "sen-voice.png" },
      { id: "010", name: "Sen Meo Meo", role: "Chatbot Web", mission: "Tư vấn và thu lead trên dailongai.com.", avatar: "sen-meo-meo.png" },
      { id: "011", name: "Sen Marketing Ops", role: "Marketing Ops", mission: "Lead enrichment + analytics digest hằng ngày.", avatar: "sen-marketing-ops.jpeg" },
    ],
  },
  {
    key: "ky-thuat",
    label: "Kỹ Thuật & Vận Hành",
    emoji: "🔧",
    color: "magenta",
    hex: "#ff00ff",
    members: [
      { id: "012", name: "Sen Coder", role: "Kỹ Sư Phần Mềm AI", mission: "Lập trình, debug, devops cho toàn bộ AI fleet.", avatar: "sen-coder.jpeg" },
      { id: "013", name: "Sen VPS", role: "VPS Operator", mission: "Deploy, health, log, restart cho VPS sản xuất.", avatar: "sen-vps.jpg" },
      { id: "014", name: "Sen Auditor", role: "Auditor", mission: "Quét secrets, SSL, cost scanner định kỳ.", avatar: "sen-auditor.jpeg" },
      { id: "015", name: "Sen Watchdog", role: "Watchdog", mission: "Giám sát Telegram/Zalo/Gateway, auto-recovery.", avatar: "sen-watchdog.jpeg" },
      { id: "016", name: "Sen Daily Report", role: "Daily Report", mission: "Tổng hợp digest fleet hằng ngày qua Telegram.", avatar: "sen-daily-report.jpg" },
      { id: "017", name: "Sen Osin Data", role: "OSINT Data", mission: "Thu thập transcript Cowork, làm sạch, phân loại.", avatar: "sen-osin-data.jpeg" },
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
