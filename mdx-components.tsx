import type { MDXComponents } from "mdx/types";
import { Callout, KeyStat, BmiCalculator } from "@/components/MdxBlocks";

const components: MDXComponents = {
  Callout,
  KeyStat,
  BmiCalculator,
};

export function useMDXComponents(existing: MDXComponents): MDXComponents {
  return { ...existing, ...components };
}
