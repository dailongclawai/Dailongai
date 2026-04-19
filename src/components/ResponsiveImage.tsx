import type { ImgHTMLAttributes } from "react";

type Props = Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "srcSet"> & {
  src: string;
  alt: string;
  widths?: number[];
  sizes?: string;
  priority?: boolean;
};

const DEFAULT_WIDTHS = [320, 640, 1024, 1920];

function buildVariants(src: string, widths: number[]) {
  const lastSlash = src.lastIndexOf("/");
  const dir = lastSlash >= 0 ? src.slice(0, lastSlash) : "";
  const file = lastSlash >= 0 ? src.slice(lastSlash + 1) : src;
  const dot = file.lastIndexOf(".");
  const stem = dot >= 0 ? file.slice(0, dot) : file;
  const responsiveBase = `${dir.replace("/images", "/images/_responsive")}/${stem}`;
  return {
    avif: widths.map((w) => `${responsiveBase}-${w}.avif ${w}w`).join(", "),
    webp: widths.map((w) => `${responsiveBase}-${w}.webp ${w}w`).join(", "),
  };
}

export default function ResponsiveImage({
  src,
  alt,
  widths = DEFAULT_WIDTHS,
  sizes = "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw",
  priority = false,
  ...rest
}: Props) {
  const variants = buildVariants(src, widths);
  return (
    <picture>
      <source type="image/avif" srcSet={variants.avif} sizes={sizes} />
      <source type="image/webp" srcSet={variants.webp} sizes={sizes} />
      <img
        src={src}
        alt={alt}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        fetchPriority={priority ? "high" : "auto"}
        {...rest}
      />
    </picture>
  );
}
