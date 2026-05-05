"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";

type Props = {
  text: string;
  className?: string;
};

export default function AnimatedText({ text, className }: Props) {
  const ref = useRef<HTMLParagraphElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start 0.8", "end 0.2"],
  });

  const chars = Array.from(text);

  return (
    <p ref={ref} className={className}>
      {chars.map((c, i) => {
        const start = i / chars.length;
        const end = (i + 1) / chars.length;
        return <Char key={i} char={c} progress={scrollYProgress} start={start} end={end} />;
      })}
    </p>
  );
}

function Char({
  char,
  progress,
  start,
  end,
}: {
  char: string;
  progress: ReturnType<typeof useScroll>["scrollYProgress"];
  start: number;
  end: number;
}) {
  const opacity = useTransform(progress, [start, end], [0.2, 1]);
  return (
    <span style={{ position: "relative", display: "inline-block", whiteSpace: "pre" }}>
      <span style={{ visibility: "hidden" }}>{char}</span>
      <motion.span
        style={{
          opacity,
          position: "absolute",
          left: 0,
          top: 0,
          whiteSpace: "pre",
        }}
      >
        {char}
      </motion.span>
    </span>
  );
}
