"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { X } from "lucide-react";

interface AnnouncementBannerProps {
  message: string;
  link?: string;
  linkText?: string;
  external?: boolean; // Optional: to control if the link is external
}

const AnnouncementBanner = ({
  message,
  link,
  linkText = "Dowiedz się więcej",
  external = false,
}: AnnouncementBannerProps) => {
  const [visible, setVisible] = useState(true);
  const [dismissed, setDismissed] = useState(false);
  const [scrollPosition, setScrollPosition] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const currentPosition = window.scrollY;
      setVisible(currentPosition <= scrollPosition || currentPosition < 50);
      setScrollPosition(currentPosition);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [scrollPosition]);

  if (dismissed) return null;

  return (
    <div
      className={`bg-primary text-primary-foreground transition-all duration-300 ease-in-out ${
        visible ? "py-2 opacity-100" : "h-0 overflow-hidden py-0 opacity-0"
      }`}
    >
      <div className="container flex items-center justify-between px-4">
        <div className="flex-1 text-center text-sm font-medium">
          {message}
          {link &&
            (external ? (
              <a
                href={link}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-2 underline underline-offset-2"
              >
                {linkText}
              </a>
            ) : (
              <Link href={link} className="ml-2 underline underline-offset-2">
                {linkText}
              </Link>
            ))}
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="text-primary-foreground/80 transition-colors hover:text-primary-foreground"
          aria-label="Zamknij ogłoszenie"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};

export default AnnouncementBanner;
