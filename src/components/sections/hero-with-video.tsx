'use client';

import { useState } from 'react';
import Link from 'next/link';
import { HeroVideoIntro } from './hero-video-intro';
import type { SiteSettings } from '@/lib/site-data';

type HeroWithVideoProps = {
  settings: SiteSettings;
  stats: { label: string; value: string }[];
};

export function HeroWithVideo({ settings, stats }: HeroWithVideoProps) {
  const [showVideo, setShowVideo] = useState(
    settings.heroVideoEnabled && !!settings.heroVideoUrl
  );

  const handleVideoComplete = () => {
    setShowVideo(false);
  };

  return (
    <section className="px-4 py-16 sm:py-20">
      <div className="mx-auto max-w-6xl">
        <div className="glass-panel relative overflow-hidden border-white/20 bg-gradient-to-br from-white/10 to-white/5 p-10 rounded-2xl">
          {/* Video Overlay - plays within the hero bounds */}
          {showVideo && settings.heroVideoUrl && (
            <HeroVideoIntro
              videoUrl={settings.heroVideoUrl}
              autoplay={settings.heroVideoAutoplay}
              muted={settings.heroVideoMuted}
              duration={settings.heroVideoDuration}
              onComplete={handleVideoComplete}
            />
          )}

          {/* Background gradient */}
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(107,114,255,0.45),transparent_55%)]" />

          {/* Hero Content - visible when video is done */}
          <div
            className={`relative flex flex-col gap-8 lg:flex-row lg:items-center transition-opacity duration-500 ${
              showVideo ? 'opacity-0' : 'opacity-100'
            }`}
          >
            <div className="flex-1 space-y-6">
              <p className="inline-flex text-xs uppercase tracking-[0.3em] text-white/70">
                Cloud print operating system
              </p>
              <h1 className="text-4xl font-semibold leading-tight text-white sm:text-5xl lg:text-6xl">
                {settings.heroHeading}
              </h1>
              <p className="text-lg text-white/80 sm:text-xl">
                {settings.heroCopy}
              </p>
              <div className="flex flex-wrap gap-3">
                <Link
                  href={settings.ctaLink}
                  className="rounded-full bg-white px-6 py-3 text-base font-semibold text-gray-900 shadow-[0_15px_35px_rgba(107,114,255,0.35)]"
                >
                  {settings.ctaLabel}
                </Link>
                <Link
                  href="/design-studio"
                  className="rounded-full border border-white/30 px-6 py-3 text-base font-semibold text-white/90 hover:border-white/60"
                >
                  Launch design studio
                </Link>
              </div>
            </div>
            <div className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-black/20 p-6 text-sm text-white/80 lg:w-80">
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-widest text-white/60">
                  Live Production
                </p>
                <div className="flex items-center justify-between rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-3">
                  <div>
                    <p className="text-xs text-emerald-300/80">Queue</p>
                    <p className="text-base font-semibold text-white">16 jobs</p>
                  </div>
                  <span className="rounded-full bg-emerald-400/80 px-3 py-1 text-xs font-semibold text-emerald-950">
                    Smooth
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {stats.map((stat) => (
                  <div
                    key={stat.label}
                    className="rounded-xl border border-white/10 bg-white/5 px-3 py-4"
                  >
                    <p className="text-xs text-white/60">{stat.label}</p>
                    <p className="text-lg font-semibold text-white">
                      {stat.value}
                    </p>
                  </div>
                ))}
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-xs leading-relaxed text-white/70">
                <p className="font-semibold text-white">What teams ship:</p>
                <p>Season drops · Launch kits · NIL merch · Experiential builds</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
