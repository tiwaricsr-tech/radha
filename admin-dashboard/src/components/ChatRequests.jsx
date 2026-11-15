import { useCallback, useEffect, useState } from 'react';
import { apiRequest } from '../api';

export default function ChatRequests({ showCancellations = true, showEnquiries = true }) {
  const [cancellations, setCancellations] = useState([]);
  const [enquiries, setEnquiries] = useState([]);
  const [orderDetails, setOrderDetails] = useState(null);
  const [error, setError] = useState('');
  const [workingId, setWorkingId] = useState('');

  const load = useCallback(async () => {
    try {
      const [cancellationResults, enquiryResults] = await Promise.all([
        showCancellations ? apiRequest('/api/chat/admin/cancellations') : Promise.resolve([]),
        showEnquiries ? apiRequest('/api/chat/admin/enquiries') : Promise.resolve([])
      ]);
      setCancellations(Array.isArray(cancellationResults) ? cancellationResults : []);
      setEnquiries(Array.isArray(enquiryResults) ? enquiryResults : []);
      setError('');
    } catch (err) {
      setError(err.message);
    }
  }, [showCancellations, showEnquiries]);

  useEffect(() => {
    load();
    const timer = setInterval(load, 15000);
    return () => clearInterval(timer);
  }, [load]);

  async function decide(id, action) {
    const note =
      action === 'reject'
        ? window.prompt('Reason for rejecting (shown to customer):') || ''
        : '';
    if (action === 'approve' && !window.confirm('Cancel this order now?')) return;

    setWorkingId(id);
    try {
      await apiRequest(`/api/chat/admin/cancellations/${id}/${action}`, {
        method: 'POST',
        body: JSON.stringify({ note })
      });
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setWorkingId('');
    }
  }

  async function resolve(id) {
    setWorkingId(id);
    try {
      await apiRequest(`/api/chat/admin/enquiries/${id}/resolve`, { method: 'PATCH' });
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setWorkingId('');
    }
  }

  async function showOrder(orderNumber) {
    try {
      setOrderDetails(await apiRequest(`/api/chat/admin/order/${encodeURIComponent(orderNumber)}`));
    } catch (err) {
      setOrderDetails({ error: err.message });
    }
  }

  const card = {
    background: '#fff',
    border: '1px solid #e2e8f0',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10
  };
  const button = (background) => ({
    background,
    color: '#fff',
    border: 0,
    borderRadius: 8,
    padding: '7px 12px',
    margin: '6px 6px 0 0',
    cursor: 'pointer',
    fontWeight: 700
  });

  return (
    <div>
      {error && <p role="alert" style={{ color: '#b00020' }}>{error}</p>}

      {showCancellations && (
        <section aria-labelledby="admin-cancellation-requests">
          <h2 id="admin-cancellation-requests" style={{ color: '#9a3412' }}>
            Cancellation requests
          </h2>
          {cancellations.length === 0 && <p>No cancellation requests yet.</p>}
          {cancellations.map((request) => (
            <div key={request.id} style={card}>
              <strong>{request.id}</strong> • Order {request.orderNumber} • <em>{request.status}</em>
              <div>
                {request.customerName} • {request.customerPhone} • ₹{request.totalAmount} •{' '}
                {request.paymentMethod} ({request.paymentStatus})
              </div>
              <div>Reason: {request.reason}</div>
              {request.adminNote && <div>Admin note: {request.adminNote}</div>}
              <button
                type="button"
                style={button('#475569')}
                onClick={() => showOrder(request.orderNumber)}
              >
                View order
              </button>
              {request.status === 'pending' && (
                <>
                  <button
                    type="button"
                    style={button('#15803d')}
                    disabled={workingId === request.id}
                    onClick={() => decide(request.id, 'approve')}
                  >
                    Approve &amp; cancel
                  </button>
                  <button
                    type="button"
                    style={button('#b91c1c')}
                    disabled={workingId === request.id}
                    onClick={() => decide(request.id, 'reject')}
                  >
                    Reject
                  </button>
                </>
              )}
            </div>
          ))}
        </section>
      )}

      {showEnquiries && (
        <section aria-labelledby="admin-help-requests">
          <h2 id="admin-help-requests" style={{ color: '#9a3412', marginTop: 24 }}>
            Tickets &amp; enquiries
          </h2>
          {enquiries.length === 0 && <p>No support requests yet.</p>}
          {enquiries.map((enquiry) => (
            <div key={enquiry.id} style={card}>
              <strong>{enquiry.id}</strong> • <em>{enquiry.status}</em>
              {enquiry.category && (
                <> • {enquiry.category}{enquiry.priority === 'high' ? ' • high priority' : ''}</>
              )}
              {enquiry.orderNumber && (
                <>
                  {' • '}
                  <button
                    type="button"
                    className="link-btn"
                    onClick={() => showOrder(enquiry.orderNumber)}
                  >
                    Order {enquiry.orderNumber}
                  </button>
                </>
              )}
              <div>
                {enquiry.name} • {enquiry.phone}
                {enquiry.userEmail ? ` • ${enquiry.userEmail}` : ''}
              </div>
              <p style={{ margin: '6px 0' }}>{enquiry.message}</p>
              {enquiry.status === 'open' && (
                <button
                  type="button"
                  style={button('#15803d')}
                  disabled={workingId === enquiry.id}
                  onClick={() => resolve(enquiry.id)}
                >
                  Mark resolved
                </button>
              )}
            </div>
          ))}
        </section>
      )}

      {orderDetails && (
        <div style={{ ...card, border: '2px solid #ff5200' }}>
          {orderDetails.error ? (
            orderDetails.error
          ) : (
            <>
              <strong>Order {orderDetails.orderNumber}</strong> — {orderDetails.status}
              <div>
                Customer: {orderDetails.user?.name} • {orderDetails.user?.phone} •{' '}
                {orderDetails.user?.email}
              </div>
              <div>
                Address: {[
                  orderDetails.deliveryAddress?.street,
                  orderDetails.deliveryAddress?.landmark,
                  orderDetails.deliveryAddress?.city,
                  orderDetails.deliveryAddress?.pincode
                ].filter(Boolean).join(', ')}
              </div>
              <ul>
                {orderDetails.items?.map((item, index) => (
                  <li key={`${item.productId}-${index}`}>
                    {item.name} ({item.variantLabel}) × {item.quantity} — ₹{item.lineTotal}
                  </li>
                ))}
              </ul>
              <div>
                Total ₹{orderDetails.totalAmount} • {orderDetails.paymentMethod} (
                {orderDetails.paymentStatus})
              </div>
            </>
          )}
          <button type="button" style={button('#475569')} onClick={() => setOrderDetails(null)}>
            Close
          </button>
        </div>
      )}
    </div>
  );
}
