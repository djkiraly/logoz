'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Phone } from 'lucide-react';
import { HeroVideoIntro } from './hero-video-intro';
import type { SiteSettings } from '@/lib/site-data';

type HeroWithVideoProps = {
  settings: SiteSettings;
};

export function HeroWithVideo({ settings }: HeroWithVideoProps) {
  const [showVideo, setShowVideo] = useState(
    settings.heroVideoEnabled && !!settings.heroVideoUrl
  );

  const handleVideoComplete = () => {
    setShowVideo(false);
  };

  const hasHeroImage = !!settings.heroImageUrl;

  return (
    <section className="px-4 py-16 sm:py-20">
      <div className="mx-auto max-w-6xl">
        <div className="relative">
          {/* Video Overlay - positioned over the entire hero panel */}
          {showVideo && settings.heroVideoUrl && (
            <div className="absolute inset-0 z-20 rounded-2xl overflow-hidden">
              <HeroVideoIntro
                videoUrl={settings.heroVideoUrl}
                autoplay={settings.heroVideoAutoplay}
                muted={settings.heroVideoMuted}
                duration={settings.heroVideoDuration}
                onComplete={handleVideoComplete}
              />
            </div>
          )}

          <div className="glass-panel relative overflow-hidden border-white/20 bg-gradient-to-br from-white/10 to-white/5 p-10 rounded-2xl">
            {/* Background gradient */}
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(107,114,255,0.45),transparent_55%)]" />

          {/* Hero Content - visible when video is done */}
          <div
            className={`relative flex flex-col gap-8 lg:flex-row lg:items-center transition-opacity duration-500 ${
              showVideo ? 'opacity-0' : 'opacity-100'
            }`}
          >
            {/* Left side - Text content */}
            <div className={`space-y-6 ${hasHeroImage ? 'lg:w-2/3' : 'flex-1'}`}>
              {settings.heroTagline && (
                <p className="inline-flex text-xs uppercase tracking-[0.3em] text-white/70">
                  {settings.heroTagline}
                </p>
              )}
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
              {/* Phone Number */}
              {settings.contactPhone && (
                <div className="flex items-center gap-2 text-white/70">
                  <Phone className="w-4 h-4" />
                  <a
                    href={`tel:${settings.contactPhone.replace(/\D/g, '')}`}
                    className="text-sm hover:text-white transition-colors"
                  >
                    {settings.contactPhone}
                  </a>
                </div>
              )}
            </div>

            {/* Right side - Optional Hero Image */}
            {hasHeroImage && (
              <div className="lg:w-1/3 flex-shrink-0">
                <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl">
                  <Image
                    src={settings.heroImageUrl!}
                    alt="Hero"
                    fill
                    className="object-cover"
                    sizes="(max-width: 1024px) 100vw, 33vw"
                    priority
                  />
                </div>
              </div>
            )}
          </div>
          </div>
        </div>
      </div>
    </section>
  );
}
