'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

type HeroVideoIntroProps = {
  videoUrl: string;
  autoplay?: boolean;
  muted?: boolean;
  duration?: number | null;
  onComplete: () => void;
};

/**
 * Extracts YouTube video ID from various URL formats
 */
function getYouTubeVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/embed\/)([^?&/]+)/,
    /(?:youtube\.com\/watch\?v=)([^&]+)/,
    /(?:youtu\.be\/)([^?&/]+)/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

/**
 * Checks if the URL is a direct video file
 */
function isDirectVideoUrl(url: string): boolean {
  return /\.(mp4|webm|ogg|mov)(\?|$)/i.test(url);
}

export function HeroVideoIntro({
  videoUrl,
  autoplay = true,
  muted = true,
  duration,
  onComplete,
}: HeroVideoIntroProps) {
  const [isFading, setIsFading] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const hasCompletedRef = useRef(false);

  const handleComplete = useCallback(() => {
    if (hasCompletedRef.current) return;
    hasCompletedRef.current = true;

    // Start fade animation
    setIsFading(true);

    // After fade completes, notify parent
    setTimeout(() => {
      onComplete();
    }, 1000); // 1s fade duration
  }, [onComplete]);

  // Handle duration-based completion for YouTube videos
  useEffect(() => {
    if (!duration) return;

    const timer = setTimeout(() => {
      handleComplete();
    }, duration * 1000);

    return () => clearTimeout(timer);
  }, [duration, handleComplete]);

  // Handle direct video end event
  const handleVideoEnded = useCallback(() => {
    handleComplete();
  }, [handleComplete]);

  // For YouTube, we need to use the API or rely on duration
  const youtubeId = getYouTubeVideoId(videoUrl);
  const isDirectVideo = isDirectVideoUrl(videoUrl);

  // Build YouTube embed URL with appropriate parameters
  const getYouTubeEmbedUrl = () => {
    if (!youtubeId) return '';

    const params = new URLSearchParams({
      autoplay: autoplay ? '1' : '0',
      mute: muted ? '1' : '0',
      controls: '0',
      showinfo: '0',
      rel: '0',
      modestbranding: '1',
      playsinline: '1',
      loop: '0',
      enablejsapi: '1',
    });

    return `https://www.youtube.com/embed/${youtubeId}?${params.toString()}`;
  };

  return (
    <div
      className={`w-full h-full bg-[#05060a] transition-opacity duration-1000 ${
        isFading ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      {isDirectVideo ? (
        <video
          ref={videoRef}
          src={videoUrl}
          autoPlay={autoplay}
          muted={muted}
          playsInline
          onEnded={handleVideoEnded}
          className="w-full h-full object-cover"
          style={{ pointerEvents: 'none' }}
        />
      ) : youtubeId ? (
        <div className="relative w-full h-full overflow-hidden">
          <iframe
            ref={iframeRef}
            src={getYouTubeEmbedUrl()}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="absolute border-0"
            style={{
              pointerEvents: 'none',
              width: '220%',
              height: '220%',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
            }}
          />
        </div>
      ) : (
        // Fallback: try as direct video anyway
        <video
          ref={videoRef}
          src={videoUrl}
          autoPlay={autoplay}
          muted={muted}
          playsInline
          onEnded={handleVideoEnded}
          className="w-full h-full object-cover"
          style={{ pointerEvents: 'none' }}
        />
      )}

      {/* Skip button - subtle, bottom right within the video area */}
      <button
        onClick={handleComplete}
        className="absolute bottom-6 right-6 z-20 px-3 py-1.5 text-xs text-white/60 hover:text-white/90 transition-colors bg-black/30 hover:bg-black/50 rounded-full backdrop-blur-sm"
      >
        Skip
      </button>
    </div>
  );
}
