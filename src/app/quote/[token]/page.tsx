'use client';

import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import {
  CheckCircle,
  XCircle,
  Loader2,
  FileText,
  Calendar,
  Clock,
  AlertCircle,
} from 'lucide-react';

type LineItem = {
  name: string;
  description: string | null;
  quantity: number;
  unitPrice: string | number;
  total: string | number;
};

type Quote = {
  id: string;
  quoteNumber: string;
  title: string | null;
  customerName: string | null;
  customerCompany: string | null;
  notes: string | null;
  validUntil: string | null;
  requestedDelivery: string | null;
  subtotal: string | number;
  discount: string | number;
  tax: string | number;
  shipping: string | number;
  total: string | number;
  status: string;
  sentAt: string | null;
  approvedAt: string | null;
  declinedAt: string | null;
  lineItems: LineItem[];
};

export default function PublicQuotePage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const token = params.token as string;
  const actionParam = searchParams.get('action');

  const [quote, setQuote] = useState<Quote | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionResult, setActionResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState<'approve' | 'decline' | null>(null);

  useEffect(() => {
    fetchQuote();
  }, [token]);

  // Handle action from URL param
  useEffect(() => {
    if (quote && actionParam && quote.status === 'SENT') {
      if (actionParam === 'approve') {
        setShowConfirmDialog('approve');
      } else if (actionParam === 'decline') {
        setShowConfirmDialog('decline');
      }
    }
  }, [quote, actionParam]);

  const fetchQuote = async () => {
    try {
      const response = await fetch(`/api/quote/${token}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Quote not found');
      }

      setQuote(data.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load quote');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAction = async (action: 'approve' | 'decline') => {
    setIsSubmitting(true);
    setShowConfirmDialog(null);

    try {
      const response = await fetch(`/api/quote/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to process request');
      }

      setActionResult({
        success: true,
        message: data.data.message,
      });

      // Refresh quote data
      fetchQuote();
    } catch (err) {
      setActionResult({
        success: false,
        message: err instanceof Error ? err.message : 'An error occurred',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatCurrency = (value: string | number) => {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(num);
  };

  const formatDate = (date: string | null) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const isExpired = quote?.validUntil && new Date(quote.validUntil) < new Date();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-cyan-400 animate-spin mx-auto mb-4" />
          <p className="text-slate-400">Loading quote...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-8 max-w-md text-center">
          <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h1 className="text-xl font-semibold text-white mb-2">Quote Not Found</h1>
          <p className="text-slate-400">{error}</p>
        </div>
      </div>
    );
  }

  if (!quote) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 py-8 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden mb-6">
          <div className="bg-gradient-to-r from-cyan-600 to-cyan-700 px-8 py-6">
            <div className="flex items-center gap-3 mb-2">
              <FileText className="w-6 h-6 text-white/80" />
              <span className="text-white/80 text-sm font-medium">Quote {quote.quoteNumber}</span>
            </div>
            <h1 className="text-2xl font-bold text-white">
              {quote.title || `Quote for ${quote.customerCompany || quote.customerName}`}
            </h1>
          </div>

          {/* Status Banner */}
          {quote.status !== 'SENT' && (
            <div
              className={`px-8 py-4 flex items-center gap-3 ${
                quote.status === 'APPROVED'
                  ? 'bg-green-500/10 border-b border-green-500/20'
                  : quote.status === 'DECLINED'
                  ? 'bg-red-500/10 border-b border-red-500/20'
                  : 'bg-slate-500/10 border-b border-slate-500/20'
              }`}
            >
              {quote.status === 'APPROVED' ? (
                <>
                  <CheckCircle className="w-5 h-5 text-green-400" />
                  <span className="text-green-400 font-medium">
                    Approved on {formatDate(quote.approvedAt)}
                  </span>
                </>
              ) : quote.status === 'DECLINED' ? (
                <>
                  <XCircle className="w-5 h-5 text-red-400" />
                  <span className="text-red-400 font-medium">
                    Declined on {formatDate(quote.declinedAt)}
                  </span>
                </>
              ) : (
                <>
                  <Clock className="w-5 h-5 text-slate-400" />
                  <span className="text-slate-400 font-medium">Status: {quote.status}</span>
                </>
              )}
            </div>
          )}

          {/* Quote Info */}
          <div className="px-8 py-6 grid grid-cols-2 gap-6 border-b border-white/10">
            <div>
              <p className="text-slate-500 text-sm mb-1">Prepared For</p>
              <p className="text-white font-medium">{quote.customerName}</p>
              {quote.customerCompany && (
                <p className="text-slate-400 text-sm">{quote.customerCompany}</p>
              )}
            </div>
            <div className="text-right">
              <p className="text-slate-500 text-sm mb-1">Valid Until</p>
              <p className={`font-medium ${isExpired ? 'text-red-400' : 'text-white'}`}>
                {formatDate(quote.validUntil)}
                {isExpired && <span className="text-red-400 text-sm ml-2">(Expired)</span>}
              </p>
              {quote.requestedDelivery && (
                <div className="mt-2">
                  <p className="text-slate-500 text-sm mb-1">Requested Delivery</p>
                  <p className="text-white">{formatDate(quote.requestedDelivery)}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Line Items */}
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden mb-6">
          <div className="px-8 py-4 border-b border-white/10">
            <h2 className="text-lg font-semibold text-white">Quote Details</h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10 bg-white/5">
                  <th className="px-8 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Item
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Qty
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Unit Price
                  </th>
                  <th className="px-8 py-3 text-right text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {quote.lineItems.map((item, index) => (
                  <tr key={index} className="border-b border-white/5">
                    <td className="px-8 py-4">
                      <p className="text-white font-medium">{item.name}</p>
                      {item.description && (
                        <p className="text-slate-400 text-sm mt-1">{item.description}</p>
                      )}
                    </td>
                    <td className="px-4 py-4 text-center text-slate-300">{item.quantity}</td>
                    <td className="px-4 py-4 text-right text-slate-300">
                      {formatCurrency(item.unitPrice)}
                    </td>
                    <td className="px-8 py-4 text-right text-white font-medium">
                      {formatCurrency(item.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="px-8 py-6 bg-white/5">
            <div className="flex justify-end">
              <div className="w-64 space-y-2">
                <div className="flex justify-between text-slate-400">
                  <span>Subtotal</span>
                  <span className="text-white">{formatCurrency(quote.subtotal)}</span>
                </div>
                {parseFloat(String(quote.discount)) > 0 && (
                  <div className="flex justify-between text-green-400">
                    <span>Discount</span>
                    <span>-{formatCurrency(quote.discount)}</span>
                  </div>
                )}
                {parseFloat(String(quote.tax)) > 0 && (
                  <div className="flex justify-between text-slate-400">
                    <span>Tax</span>
                    <span className="text-white">{formatCurrency(quote.tax)}</span>
                  </div>
                )}
                {parseFloat(String(quote.shipping)) > 0 && (
                  <div className="flex justify-between text-slate-400">
                    <span>Shipping</span>
                    <span className="text-white">{formatCurrency(quote.shipping)}</span>
                  </div>
                )}
                <div className="pt-3 border-t border-white/10 flex justify-between">
                  <span className="text-white font-semibold text-lg">Total</span>
                  <span className="text-cyan-400 font-bold text-xl">
                    {formatCurrency(quote.total)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Notes */}
        {quote.notes && (
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 mb-6">
            <h3 className="text-white font-semibold mb-2">Notes</h3>
            <p className="text-slate-300 whitespace-pre-wrap">{quote.notes}</p>
          </div>
        )}

        {/* Action Result */}
        {actionResult && (
          <div
            className={`rounded-2xl p-6 mb-6 ${
              actionResult.success
                ? 'bg-green-500/10 border border-green-500/20'
                : 'bg-red-500/10 border border-red-500/20'
            }`}
          >
            <div className="flex items-start gap-3">
              {actionResult.success ? (
                <CheckCircle className="w-6 h-6 text-green-400 shrink-0" />
              ) : (
                <AlertCircle className="w-6 h-6 text-red-400 shrink-0" />
              )}
              <p className={actionResult.success ? 'text-green-300' : 'text-red-300'}>
                {actionResult.message}
              </p>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        {quote.status === 'SENT' && !isExpired && !actionResult && (
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
            <p className="text-slate-300 text-center mb-6">
              Ready to proceed? Please let us know your decision.
            </p>
            <div className="flex justify-center gap-4">
              <button
                onClick={() => setShowConfirmDialog('approve')}
                disabled={isSubmitting}
                className="px-8 py-3 bg-gradient-to-r from-green-500 to-green-600 text-white font-semibold rounded-xl hover:from-green-600 hover:to-green-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-green-500/25"
              >
                Approve Quote
              </button>
              <button
                onClick={() => setShowConfirmDialog('decline')}
                disabled={isSubmitting}
                className="px-8 py-3 bg-white/10 text-slate-300 font-semibold rounded-xl hover:bg-white/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed border border-white/10"
              >
                Decline Quote
              </button>
            </div>
          </div>
        )}

        {/* Expired Message */}
        {isExpired && quote.status === 'SENT' && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-6 text-center">
            <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-3" />
            <p className="text-red-300">
              This quote has expired. Please contact us for an updated quote.
            </p>
          </div>
        )}
      </div>

      {/* Confirmation Dialog */}
      {showConfirmDialog && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-800 border border-white/10 rounded-2xl p-6 max-w-md w-full">
            <h3 className="text-xl font-semibold text-white mb-4">
              {showConfirmDialog === 'approve' ? 'Approve Quote?' : 'Decline Quote?'}
            </h3>
            <p className="text-slate-300 mb-6">
              {showConfirmDialog === 'approve'
                ? 'By approving this quote, you agree to the terms and pricing outlined above. We will contact you to proceed with your order.'
                : 'Are you sure you want to decline this quote? You can contact us if you would like to discuss alternatives.'}
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowConfirmDialog(null)}
                disabled={isSubmitting}
                className="px-4 py-2 text-slate-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleAction(showConfirmDialog)}
                disabled={isSubmitting}
                className={`px-6 py-2 font-semibold rounded-lg flex items-center gap-2 ${
                  showConfirmDialog === 'approve'
                    ? 'bg-green-500 hover:bg-green-600 text-white'
                    : 'bg-red-500 hover:bg-red-600 text-white'
                }`}
              >
                {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                {showConfirmDialog === 'approve' ? 'Yes, Approve' : 'Yes, Decline'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
