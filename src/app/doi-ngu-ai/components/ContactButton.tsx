"use client";

type Props = {
  label?: string;
  href?: string;
};

export default function ContactButton({ label = "Liên Hệ", href = "/lien-he" }: Props) {
  return (
    <a
      href={href}
      className="contact-btn px-8 py-3 sm:px-10 sm:py-3.5 md:px-12 md:py-4 text-xs sm:text-sm md:text-base inline-block"
    >
      {label}
    </a>
  );
}
