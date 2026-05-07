"use client";

import FadeIn from "./FadeIn";
import DataLayerIcon from "./DataLayerIcon";
import { useI18n } from "@/lib/i18n";

type IconKey = "supabase" | "shared-memory" | "fleet-events" | "fleet-registry" | "entity-facts" | "rag-knowledge";

type DataLayer = {
  key: IconKey;
  name: string;
  tableName: string;
  descKey: string;
  consumersKey: string;
  hex: string;
};

const LAYERS: DataLayer[] = [
  { key: "supabase", name: "Supabase Postgres", tableName: "projects · 50+ tables", descKey: "team.datainfra.layer.supabase.desc", consumersKey: "team.datainfra.layer.supabase.consumers", hex: "#00f2ff" },
  { key: "shared-memory", name: "shared_memory", tableName: "table · cross-agent pool", descKey: "team.datainfra.layer.shared.desc", consumersKey: "team.datainfra.layer.shared.consumers", hex: "#ff9069" },
  { key: "fleet-events", name: "fleet_events bus", tableName: "table · realtime stream", descKey: "team.datainfra.layer.events.desc", consumersKey: "team.datainfra.layer.events.consumers", hex: "#00ff88" },
  { key: "fleet-registry", name: "fleet_registry", tableName: "table · agent endpoints", descKey: "team.datainfra.layer.registry.desc", consumersKey: "team.datainfra.layer.registry.consumers", hex: "#ffea00" },
  { key: "entity-facts", name: "entity_facts_canonical", tableName: "table · cluster + reconcile", descKey: "team.datainfra.layer.facts.desc", consumersKey: "team.datainfra.layer.facts.consumers", hex: "#ff00ff" },
  { key: "rag-knowledge", name: "Knowledge RAG", tableName: "187 chunks · pgvector", descKey: "team.datainfra.layer.rag.desc", consumersKey: "team.datainfra.layer.rag.consumers", hex: "#ff2d88" },
];

const CAPABILITY_ICONS = ["📥", "🔔", "🔍", "🧬", "🚀", "🔐"];
const CAPABILITY_KEYS = [1, 2, 3, 4, 5, 6].map((i) => `team.datainfra.cap${i}`);

export default function DataInfraSection() {
  const { t } = useI18n();
  return (
    <section className="px-6 md:px-12 py-24 max-w-7xl mx-auto">
      <FadeIn delay={0} y={30} className="text-center mb-4">
        <p
          className="font-medium uppercase tracking-widest mb-3"
          style={{ color: "#ff9069", fontSize: 11, letterSpacing: "0.3em", fontFamily: "Inter, sans-serif" }}
        >
          // {t("team.datainfra.eyebrow")} //
        </p>
      </FadeIn>
      <FadeIn delay={0.1} y={30} className="mb-16">
        <h2
          className="hero-heading font-black uppercase text-center tracking-tight"
          style={{ fontSize: "clamp(2rem, 7vw, 96px)" as string }}
        >
          {t("team.datainfra.heading")}
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
              <div className="flex items-center gap-4 mb-4">
                <DataLayerIcon icon={layer.key} color={layer.hex} size={56} />
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
                {t(layer.descKey)}
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
                  → {t("team.datainfra.consumers")}
                </div>
                <div
                  className="text-xs font-medium"
                  style={{ color: "#f0edf1", lineHeight: 1.5 }}
                >
                  {t(layer.consumersKey)}
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
              // {t("team.datainfra.capabilities_eyebrow")} //
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
            {t("team.datainfra.capabilities_heading")}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {CAPABILITY_KEYS.map((capKey, i) => (
              <FadeIn key={capKey} delay={i * 0.05} y={16}>
                <div className="flex items-start gap-3">
                  <div className="text-xl flex-none mt-0.5">{CAPABILITY_ICONS[i]}</div>
                  <div
                    className="text-sm leading-relaxed"
                    style={{ color: "#acaaae" }}
                  >
                    {t(capKey)}
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
