import React, { useEffect, useState } from 'react';
import { X, ShieldCheck, Lock, Loader2 } from 'lucide-react';
import { apiRequest } from '../api';

let razorpayScriptPromise;

function loadRazorpayScript() {
  if (window.Razorpay) return Promise.resolve();
  if (!razorpayScriptPromise) {
    razorpayScriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.async = true;
      script.onload = resolve;
      script.onerror = () => {
        razorpayScriptPromise = null;
        reject(new Error('Could not load Razorpay Checkout. Check your internet connection and try again.'));
      };
      document.body.appendChild(script);
    });
  }
  return razorpayScriptPromise;
}

export default function PaymentGatewayModal({
  amount,
  customer,
  checkout,
  onClose,
  onPaymentSuccess
}) {
  const [sdkReady, setSdkReady] = useState(Boolean(window.Razorpay));
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    loadRazorpayScript()
      .then(() => {
        if (active) setSdkReady(true);
      })
      .catch((err) => {
        if (active) setError(err.message);
      });
    return () => {
      active = false;
    };
  }, []);

  const handlePay = async () => {
    setProcessing(true);
    setError('');
    try {
      await loadRazorpayScript();
      const session = await apiRequest('/api/payments/create-order', {
        method: 'POST',
        body: JSON.stringify(checkout)
      });

      const razorpay = new window.Razorpay({
        key: session.keyId,
        amount: session.amount,
        currency: session.currency,
        name: 'Radha Swami',
        description: 'Fresh Sweets & Snacks Order',
        order_id: session.gatewayOrderId,
        prefill: {
          name: customer?.name || '',
          email: customer?.email || '',
          contact: customer?.phone || ''
        },
        theme: { color: '#FF5200' },
        handler: async (response) => {
          try {
            const verified = await apiRequest('/api/payments/verify', {
              method: 'POST',
              body: JSON.stringify(response)
            });
            const result = await apiRequest('/api/orders', {
              method: 'POST',
              body: JSON.stringify({
                paymentMethod: verified.method,
                paymentId: verified.paymentId,
                gatewayOrderId: verified.gatewayOrderId
              })
            });
            onPaymentSuccess({
              ...result.order,
              whatsappNotification: result.whatsappNotification
            });
          } catch (err) {
            setError(err.message);
            setProcessing(false);
          }
        },
        modal: {
          ondismiss: () => setProcessing(false)
        }
      });

      razorpay.on('payment.failed', (response) => {
        setError(response.error?.description || 'Payment failed. Please try again.');
        setProcessing(false);
      });
      razorpay.open();
    } catch (err) {
      setError(err.message);
      setProcessing(false);
    }
  };

  return (
    <div className="sw-modal-backdrop" onClick={processing ? undefined : onClose}>
      <div className="pg-modal" onClick={(event) => event.stopPropagation()}>
        <div className="pg-header">
          <div className="pg-merchant">
            <div className="pg-logo">
              <img src="/radha-swami-logo.jpg" alt="" />
            </div>
            <div>
              <h4>Radha Swami</h4>
              <span><Lock size={11} /> Secure checkout by Razorpay</span>
            </div>
          </div>
          <div className="pg-amount-box">
            <small>TO PAY</small>
            <strong>₹{amount}</strong>
          </div>
          <button className="pg-close" onClick={onClose} disabled={processing} aria-label="Close payment">
            <X size={18} />
          </button>
        </div>

        <div className="pg-content">
          {error && <div className="sw-error-alert">{error}</div>}
          <p>Pay securely using UPI, cards, netbanking, or other methods available through Razorpay.</p>
          <button
            type="button"
            className="pg-pay-submit"
            onClick={handlePay}
            disabled={!sdkReady || processing}
          >
            {processing ? (
              <><Loader2 size={17} className="spin-anim" /> Opening secure checkout...</>
            ) : (
              <>Continue to Razorpay</>
            )}
          </button>
          <div className="pg-trust-foot">
            <ShieldCheck size={14} /> Payment details are entered on Razorpay Checkout
          </div>
        </div>
      </div>
    </div>
  );
}
