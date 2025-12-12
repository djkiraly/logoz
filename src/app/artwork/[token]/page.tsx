'use client';

import { useState, useEffect, use } from 'react';
import Image from 'next/image';
import { CheckCircle, XCircle, Clock, FileImage, Package, Loader2, X, ZoomIn } from 'lucide-react';

type ArtworkData = {
  quoteNumber: string;
  title: string | null;
  customerName: string;
  companyName: string | null;
  artworkUrl: string;
  artworkFileName: string;
  artworkVersion: number;
  artworkSentAt: string;
  responseState: 'pending' | 'approved' | 'declined';
  respondedAt: string | null;
  notes: string | null;
  quoteStatus: string;
  quoteState: 'pending' | 'approved' | 'declined';
  quoteApprovedAt: string | null;
  quoteDeclinedAt: string | null;
  lineItems: Array<{
    name: string;
    description: string | null;
    quantity: number;
  }>;
};

type PageProps = {
  params: Promise<{ token: string }>;
};

export default function ArtworkApprovalPage({ params }: PageProps) {
  const { token } = use(params);
  const [artwork, setArtwork] = useState<ArtworkData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [notes, setNotes] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submitResult, setSubmitResult] = useState<{
    action: 'approve' | 'decline';
    type: 'artwork' | 'quote';
    message: string;
  } | null>(null);
  const [quoteSubmitted, setQuoteSubmitted] = useState(false);
  const [quoteSubmitResult, setQuoteSubmitResult] = useState<{
    action: 'approve' | 'decline';
    message: string;
  } | null>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  useEffect(() => {
    fetchArtwork();
  }, [token]);

  // Handle escape key to close lightbox
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && lightboxOpen) {
        setLightboxOpen(false);
      }
    };

    if (lightboxOpen) {
      document.addEventListener('keydown', handleKeyDown);
      // Prevent body scroll when lightbox is open
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [lightboxOpen]);

  async function fetchArtwork() {
    try {
      const res = await fetch(`/api/artwork/${token}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to load artwork');
      }

      setArtwork(data.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load artwork');
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(action: 'approve' | 'decline', type: 'artwork' | 'quote' = 'artwork') {
    if (submitting) return;

    setSubmitting(true);
    try {
      const res = await fetch(`/api/artwork/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, type, notes: type === 'artwork' ? (notes.trim() || undefined) : undefined }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit response');
      }

      if (type === 'quote') {
        setQuoteSubmitResult({ action, message: data.message });
        setQuoteSubmitted(true);
      } else {
        setSubmitResult({ action, type, message: data.message });
        setSubmitted(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit response');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
        <div className="text-center">
          <Loader2 className="mx-auto h-10 w-10 animate-spin text-cyan-400" />
          <p className="mt-4 text-white/70">Loading artwork...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-4">
        <div className="max-w-md rounded-xl border border-red-500/20 bg-red-500/10 p-8 text-center">
          <XCircle className="mx-auto h-12 w-12 text-red-400" />
          <h1 className="mt-4 text-xl font-semibold text-white">Unable to Load Artwork</h1>
          <p className="mt-2 text-white/70">{error}</p>
        </div>
      </div>
    );
  }

  if (!artwork) {
    return null;
  }

  // Check if artwork already responded
  if (artwork.responseState !== 'pending' || submitted) {
    const isArtworkApproved = artwork.responseState === 'approved' || submitResult?.action === 'approve';
    const isQuoteApproved = artwork.quoteState === 'approved' || quoteSubmitResult?.action === 'approve';
    const isQuoteDeclined = artwork.quoteState === 'declined' || quoteSubmitResult?.action === 'decline';
    const canApproveQuote = isArtworkApproved && artwork.quoteState === 'pending' && !quoteSubmitted;

    // If quote has been responded to, show final state
    if (isQuoteApproved || isQuoteDeclined || quoteSubmitted) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-4">
          <div className="max-w-lg rounded-2xl border border-white/10 bg-white/5 p-8 text-center backdrop-blur-lg">
            {isQuoteApproved || quoteSubmitResult?.action === 'approve' ? (
              <>
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-500/20">
                  <CheckCircle className="h-8 w-8 text-green-400" />
                </div>
                <h1 className="mt-6 text-2xl font-semibold text-white">Quote Approved!</h1>
                <p className="mt-2 text-white/70">
                  {quoteSubmitResult?.message ||
                    'Thank you for approving the quote. We will begin processing your order.'}
                </p>
              </>
            ) : (
              <>
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-500/20">
                  <XCircle className="h-8 w-8 text-amber-400" />
                </div>
                <h1 className="mt-6 text-2xl font-semibold text-white">Quote Declined</h1>
                <p className="mt-2 text-white/70">
                  {quoteSubmitResult?.message ||
                    'Thank you for your feedback. Please contact us to discuss your requirements.'}
                </p>
              </>
            )}
            <p className="mt-6 text-xs text-white/50">Quote #{artwork.quoteNumber}</p>
          </div>
        </div>
      );
    }

    // Show artwork approval status with quote approval option
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-4">
        <div className="max-w-lg rounded-2xl border border-white/10 bg-white/5 p-8 text-center backdrop-blur-lg">
          {isArtworkApproved ? (
            <>
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-500/20">
                <CheckCircle className="h-8 w-8 text-green-400" />
              </div>
              <h1 className="mt-6 text-2xl font-semibold text-white">Artwork Approved!</h1>
              <p className="mt-2 text-white/70">
                {submitResult?.message ||
                  'Thank you for approving the artwork.'}
              </p>

              {/* Quote Approval Section */}
              {canApproveQuote && (
                <div className="mt-8 pt-6 border-t border-white/10">
                  <h2 className="text-lg font-semibold text-white">Approve Your Quote</h2>
                  <p className="mt-2 text-sm text-white/70">
                    Your artwork is approved. Would you like to proceed with this quote?
                  </p>
                  <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                    <button
                      onClick={() => handleSubmit('approve', 'quote')}
                      disabled={submitting}
                      className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-green-500 px-6 py-3 font-semibold text-white transition hover:bg-green-600 disabled:opacity-50"
                    >
                      {submitting ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <CheckCircle className="h-5 w-5" />
                      )}
                      Approve Quote
                    </button>
                    <button
                      onClick={() => handleSubmit('decline', 'quote')}
                      disabled={submitting}
                      className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-amber-500/50 bg-amber-500/10 px-6 py-3 font-semibold text-amber-400 transition hover:bg-amber-500/20 disabled:opacity-50"
                    >
                      {submitting ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <XCircle className="h-5 w-5" />
                      )}
                      Decline Quote
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-500/20">
                <XCircle className="h-8 w-8 text-amber-400" />
              </div>
              <h1 className="mt-6 text-2xl font-semibold text-white">Feedback Received</h1>
              <p className="mt-2 text-white/70">
                {submitResult?.message ||
                  'Thank you for your feedback. We will revise the artwork and send you a new version.'}
              </p>
            </>
          )}
          {(artwork.notes || notes) && !isArtworkApproved && (
            <div className="mt-6 rounded-lg border border-white/10 bg-white/5 p-4 text-left">
              <p className="text-sm font-medium text-white/50">Your notes:</p>
              <p className="mt-1 text-sm text-white/80">{artwork.notes || notes}</p>
            </div>
          )}
          <p className="mt-6 text-xs text-white/50">Quote #{artwork.quoteNumber}</p>
        </div>
      </div>
    );
  }

  const isImageFile =
    artwork.artworkFileName &&
    /\.(jpg|jpeg|png|gif|webp|svg|bmp)$/i.test(artwork.artworkFileName);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 py-12">
      <div className="mx-auto max-w-4xl px-4">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-white">Artwork Approval</h1>
          <p className="mt-2 text-white/70">
            Hello {artwork.customerName}
            {artwork.companyName ? ` from ${artwork.companyName}` : ''}, please review the artwork
            below.
          </p>
        </div>

        {/* Quote Info Card */}
        <div className="mb-8 rounded-xl border border-white/10 bg-white/5 p-6 backdrop-blur-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-white/50">Quote</p>
              <p className="text-lg font-semibold text-white">#{artwork.quoteNumber}</p>
              {artwork.title && <p className="text-sm text-white/70">{artwork.title}</p>}
            </div>
            <div className="text-right">
              <p className="text-sm text-white/50">Version</p>
              <p className="text-lg font-semibold text-cyan-400">{artwork.artworkVersion}</p>
            </div>
          </div>

          {/* Line Items Summary */}
          {artwork.lineItems.length > 0 && (
            <div className="mt-6 border-t border-white/10 pt-4">
              <div className="flex items-center gap-2 text-sm text-white/50">
                <Package className="h-4 w-4" />
                <span>Items in this quote:</span>
              </div>
              <ul className="mt-2 space-y-1">
                {artwork.lineItems.slice(0, 5).map((item, index) => (
                  <li key={index} className="text-sm text-white/80">
                    {item.quantity}x {item.name}
                    {item.description && (
                      <span className="text-white/50"> - {item.description}</span>
                    )}
                  </li>
                ))}
                {artwork.lineItems.length > 5 && (
                  <li className="text-sm text-white/50">
                    +{artwork.lineItems.length - 5} more items
                  </li>
                )}
              </ul>
            </div>
          )}
        </div>

        {/* Artwork Preview */}
        <div className="mb-8 overflow-hidden rounded-xl border border-white/10 bg-white/5 backdrop-blur-lg">
          <div className="border-b border-white/10 bg-white/5 px-6 py-4">
            <div className="flex items-center gap-3">
              <FileImage className="h-5 w-5 text-cyan-400" />
              <div>
                <p className="font-medium text-white">{artwork.artworkFileName}</p>
                <p className="text-xs text-white/50">
                  Sent on {new Date(artwork.artworkSentAt).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>
            </div>
          </div>

          <div className="p-4">
            {isImageFile ? (
              <div
                className="relative flex items-center justify-center rounded-lg bg-white/5 p-4 cursor-pointer group"
                onClick={() => setLightboxOpen(true)}
              >
                <Image
                  src={artwork.artworkUrl}
                  alt="Artwork preview"
                  width={800}
                  height={600}
                  className="max-h-[600px] w-auto rounded-lg object-contain transition group-hover:opacity-90"
                  unoptimized
                />
                {/* Zoom overlay hint */}
                <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/20 transition-colors rounded-lg">
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 rounded-full p-3">
                    <ZoomIn className="h-6 w-6 text-white" />
                  </div>
                </div>
                <p className="absolute bottom-6 left-1/2 -translate-x-1/2 text-xs text-white/50 opacity-0 group-hover:opacity-100 transition-opacity bg-black/40 px-3 py-1 rounded-full">
                  Click to enlarge
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center rounded-lg bg-white/5 p-12">
                <FileImage className="h-16 w-16 text-white/30" />
                <p className="mt-4 text-white/70">Preview not available for this file type</p>
                <a
                  href={artwork.artworkUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 rounded-lg bg-cyan-500 px-6 py-2 font-medium text-white transition hover:bg-cyan-600"
                >
                  Download to View
                </a>
              </div>
            )}
          </div>
        </div>

        {/* Lightbox Modal */}
        {lightboxOpen && isImageFile && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm"
            onClick={() => setLightboxOpen(false)}
          >
            {/* Close button */}
            <button
              onClick={() => setLightboxOpen(false)}
              className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors z-10"
            >
              <X className="h-6 w-6 text-white" />
            </button>

            {/* Image container */}
            <div
              className="relative max-w-[95vw] max-h-[95vh] p-4"
              onClick={(e) => e.stopPropagation()}
            >
              <Image
                src={artwork.artworkUrl}
                alt="Artwork preview - enlarged"
                width={1920}
                height={1440}
                className="max-w-full max-h-[90vh] w-auto h-auto object-contain rounded-lg"
                unoptimized
              />

              {/* Image info */}
              <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/60 to-transparent rounded-b-lg">
                <p className="text-white font-medium">{artwork.artworkFileName}</p>
                <p className="text-white/60 text-sm">Version {artwork.artworkVersion} • Quote #{artwork.quoteNumber}</p>
              </div>
            </div>

            {/* Click outside hint */}
            <p className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/40 text-sm">
              Click anywhere or press Escape to close
            </p>
          </div>
        )}

        {/* Response Form */}
        <div className="rounded-xl border border-white/10 bg-white/5 p-6 backdrop-blur-lg">
          <h2 className="text-lg font-semibold text-white">Your Response</h2>
          <p className="mt-1 text-sm text-white/70">
            Please review the artwork carefully and let us know if you approve or need changes.
          </p>

          <div className="mt-6">
            <label className="block text-sm font-medium text-white/70">
              Notes / Feedback (optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any notes or specific feedback about the artwork..."
              rows={4}
              maxLength={2000}
              className="mt-2 w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-white placeholder-white/30 outline-none transition focus:border-cyan-500/50 focus:ring-2 focus:ring-cyan-500/20"
            />
            <p className="mt-1 text-right text-xs text-white/40">{notes.length}/2000</p>
          </div>

          <div className="mt-6 flex flex-col gap-4 sm:flex-row">
            <button
              onClick={() => handleSubmit('approve')}
              disabled={submitting}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-green-500 px-6 py-3 font-semibold text-white transition hover:bg-green-600 disabled:opacity-50"
            >
              {submitting ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <CheckCircle className="h-5 w-5" />
              )}
              Approve Artwork
            </button>
            <button
              onClick={() => handleSubmit('decline')}
              disabled={submitting}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-amber-500/50 bg-amber-500/10 px-6 py-3 font-semibold text-amber-400 transition hover:bg-amber-500/20 disabled:opacity-50"
            >
              {submitting ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <XCircle className="h-5 w-5" />
              )}
              Request Changes
            </button>
          </div>

          <p className="mt-4 text-center text-xs text-white/40">
            <Clock className="mr-1 inline h-3 w-3" />
            Artwork sent{' '}
            {new Date(artwork.artworkSentAt).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}
          </p>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-sm text-white/40">
          <p>Questions? Contact us directly and reference quote #{artwork.quoteNumber}</p>
        </div>
      </div>
    </div>
  );
}
