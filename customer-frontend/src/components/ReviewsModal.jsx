import React, { useState, useEffect } from 'react';
import { X, Star } from 'lucide-react';
import { apiRequest } from '../api';

export default function ReviewsModal({ product, user, onClose, onReviewSubmitted }) {
  const [reviews, setReviews] = useState([]);
  const [rating, setRating] = useState(5);
  const [userName, setUserName] = useState(user?.name || '');
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    apiRequest(`/api/reviews?productId=${product._id}`)
      .then((res) => setReviews(res.reviews || []))
      .catch(() => {});
  }, [product]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!comment.trim()) return;
    setSubmitting(true);
    try {
      await apiRequest('/api/reviews', {
        method: 'POST',
        body: JSON.stringify({
          productId: product._id,
          productName: product.name,
          userName: userName || user?.name || 'Happy Customer',
          userEmail: user?.email || 'customer@shreemithai.in',
          rating,
          comment
        })
      });
      setComment('');
      const updated = await apiRequest(`/api/reviews?productId=${product._id}`);
      setReviews(updated.reviews || []);
      onReviewSubmitted?.();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="auth-modal wide" onClick={(e) => e.stopPropagation()}>
        <div className="auth-modal-top">
          <h3>Reviews for {product.name}</h3>
          <button className="close-btn" onClick={onClose}><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} className="review-write-box">
          <h4>Share your taste experience</h4>
          <div className="star-picker">
            {[1, 2, 3, 4, 5].map((n) => (
              <button type="button" key={n} onClick={() => setRating(n)}>
                <Star size={22} fill={n <= rating ? '#D4882A' : 'none'} stroke="#D4882A" />
              </button>
            ))}
            <span>{rating} / 5 Stars</span>
          </div>
          {!user && (
            <input
              type="text"
              placeholder="Your Name *"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              required
            />
          )}
          <textarea
            rows={2}
            placeholder="How was the freshness, sweetness, and packaging?"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            required
          />
          <button type="submit" className="primary-btn" disabled={submitting}>
            {submitting ? 'Posting...' : 'Post Customer Review'}
          </button>
        </form>

        <div className="modal-reviews-list">
          {reviews.length === 0 ? (
            <p style={{ color: '#7d655d', fontSize: 13 }}>Be the first to review this item!</p>
          ) : (
            reviews.map((r) => (
              <div className="cust-rev-item" key={r._id}>
                <div className="cust-rev-head">
                  <strong>{r.userName}</strong>
                  <span>{'★'.repeat(r.rating)}</span>
                </div>
                <p>{r.comment}</p>
                {r.adminReply && (
                  <div className="store-reply">
                    <strong>Radha Swami Reply:</strong> {r.adminReply}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
