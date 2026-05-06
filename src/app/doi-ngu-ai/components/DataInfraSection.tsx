"use client";

import FadeIn from "./FadeIn";

type DataLayer = {
  key: string;
  emoji: string;
  name: string;
  tableName: string;
  description: string;
  consumers: string;
  hex: string;
};

const LAYERS: DataLayer[] = [
  {
    key: "supabase",
    emoji: "🗄️",
    name: "Supabase Postgres",
    tableName: "projects · 50+ tables",
    description: "Single source of truth: agent registry, memory pool, fleet events, entity facts, viral signals, Đại Long CRM.",
    consumers: "All 17 Sen + Mission Control",
    hex: "#00f2ff",
  },
  {
    key: "shared-memory",
    emoji: "🧠",
    name: "shared_memory",
    tableName: "table · trace_id indexed",
    description: "Memory pool fleet — Boss notes, agent decisions, project state. Hybrid vector + keyword search, sleep-time consolidation.",
    consumers: "Sen Prime · Sen Coder · Sen CEO · Sen Manus",
    hex: "#ff9069",
  },
  {
    key: "fleet-events",
    emoji: "📡",
    name: "fleet_events bus",
    tableName: "table · realtime stream",
    description: "Real-time event bus — agent X notifies agent Y, dispatch task, completion signals. SSOT cho cross-agent comms.",
    consumers: "All 17 Sen subscribe",
    hex: "#00ff88",
  },
  {
    key: "fleet-registry",
    emoji: "🛰️",
    name: "fleet_registry",
    tableName: "table · agent endpoints",
    description: "Agent registry với role + endpoint + secret. Resolves bridge dispatch routing, enables sen-fleet CLI.",
    consumers: "Sen Dispatch · Sen Prime · Bridge Worker",
    hex: "#ffea00",
  },
  {
    key: "entity-facts",
    emoji: "🔗",
    name: "entity_facts_canonical",
    tableName: "table · cluster + reconcile",
    description: "Temporal facts với expiry + canonical reconcile (Gemini Flash, cosine 0.85). Daily cron 04:50, 600 canonical/627 raw.",
    consumers: "Sen Prime · Sen Memory consolidator",
    hex: "#ff00ff",
  },
  {
    key: "rag-knowledge",
    emoji: "📚",
    name: "Knowledge RAG",
    tableName: "187 chunks · pgvector",
    description: "Embeddings 187 chunk blog dailongai + product info + warranty + medical context. Vector recall sub-100ms.",
    consumers: "Sen Voice · Sen Meo Meo · Sen CEO outreach",
    hex: "#ff2d88",
  },
];

const CAPABILITIES = [
  { icon: "📥", text: "Đọc/ghi memory chéo agent qua shared_memory pool" },
  { icon: "🔔", text: "Subscribe sự kiện real-time qua fleet_events bus" },
  { icon: "🔍", text: "Hybrid semantic + graph search với 1-hop expansion" },
  { icon: "🧬", text: "Truy cập RAG knowledge base 187 chunk blog Đại Long" },
  { icon: "🚀", text: "Dispatch task chéo agent qua sen-fleet CLI / MCP" },
  { icon: "🔐", text: "Approve mutations qua Telegram gate (Sen Manus)" },
];

export default function DataInfraSection() {
  return (
    <section className="px-6 md:px-12 py-24 max-w-7xl mx-auto">
      <FadeIn delay={0} y={30} className="text-center mb-4">
        <p
          className="font-medium uppercase tracking-widest mb-3"
          style={{ color: "#ff9069", fontSize: 11, letterSpacing: "0.3em", fontFamily: "Inter, sans-serif" }}
        >
          // Phase 04 · Operational Stack //
        </p>
      </FadeIn>
      <FadeIn delay={0.1} y={30} className="mb-16">
        <h2
          className="hero-heading font-black uppercase text-center leading-none tracking-tight"
          style={{ fontSize: "clamp(2rem, 7vw, 96px)" as string }}
        >
          Hạ Tầng Dữ Liệu
        </h2>
      </FadeIn>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-16">
        {LAYERS.map((layer, i) => (
          <FadeIn key={layer.key} delay={i * 0.08} y={24}>
            <div
              className="group p-6 rounded-2xl h-full flex flex-col transition-all duration-300"
              style={{
                background: "#19191d",
                border: `1px solid ${layer.hex}33`,
                boxShadow: `0 0 24px ${layer.hex}0c`,
              }}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="text-3xl">{layer.emoji}</div>
                <div className="flex-1">
                  <div
                    className="font-bold uppercase"
                    style={{ color: layer.hex, fontSize: 14, letterSpacing: "0.05em" }}
                  >
                    {layer.name}
                  </div>
                  <div
                    className="text-[11px] mt-1"
                    style={{
                      color: "#7a8092",
                      fontFamily: "Inter, monospace",
                      letterSpacing: "0.1em",
                    }}
                  >
                    {layer.tableName}
                  </div>
                </div>
              </div>
              <p
                className="text-sm leading-relaxed mb-5 flex-grow"
                style={{ color: "#acaaae" }}
              >
                {layer.description}
              </p>
              <div
                className="pt-4 border-t"
                style={{ borderColor: `${layer.hex}22` }}
              >
                <div
                  className="text-[10px] uppercase mb-1.5"
                  style={{
                    color: "#7a8092",
                    letterSpacing: "0.2em",
                    fontFamily: "Inter, sans-serif",
                  }}
                >
                  → Consumers
                </div>
                <div
                  className="text-xs font-medium"
                  style={{ color: "#f0edf1", lineHeight: 1.5 }}
                >
                  {layer.consumers}
                </div>
              </div>
            </div>
          </FadeIn>
        ))}
      </div>

      <FadeIn delay={0} y={30}>
        <div
          className="rounded-2xl p-8 md:p-10"
          style={{
            background: "linear-gradient(135deg, rgba(255, 144, 105, 0.08), rgba(0, 242, 255, 0.04))",
            border: "1px solid rgba(255, 144, 105, 0.2)",
          }}
        >
          <div className="flex items-center gap-3 mb-6">
            <div
              className="font-medium uppercase tracking-widest text-xs"
              style={{ color: "#ff9069", letterSpacing: "0.3em", fontFamily: "Inter, sans-serif" }}
            >
              // Agent Capabilities //
            </div>
            <div
              className="h-[1px] flex-grow"
              style={{
                background: "linear-gradient(to right, rgba(255, 144, 105, 0.4), transparent)",
              }}
            />
          </div>
          <p
            className="font-bold mb-6"
            style={{
              color: "#f0edf1",
              fontSize: "clamp(1.2rem, 2.4vw, 1.8rem)" as string,
              lineHeight: 1.3,
            }}
          >
            Mỗi Sen Agent có khả năng:
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {CAPABILITIES.map((cap, i) => (
              <FadeIn key={i} delay={i * 0.05} y={16}>
                <div className="flex items-start gap-3">
                  <div className="text-xl flex-none mt-0.5">{cap.icon}</div>
                  <div
                    className="text-sm leading-relaxed"
                    style={{ color: "#acaaae" }}
                  >
                    {cap.text}
                  </div>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </FadeIn>
    </section>
  );
}
