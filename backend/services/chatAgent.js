// Swiggy-style help chat: pick an order -> track / issue menu -> ticket or admin-approved cancellation.
// Rule-based (no external AI). Dependencies are injected so it is easy to test.

const CANCELLABLE = ['Pending', 'Accepted'];
const SESSION_TTL_MS = 30 * 60 * 1000;
const STAGES = ['Placed', 'Accepted', 'Preparing', 'Out for Delivery', 'Delivered'];

const MAIN = ['Track my order', 'Cancel an order', 'Issue with my order', 'Payment / refund', 'Talk to support'];
const ORDER_MENU = [
  'Track my order', 'Order details', 'Cancel order', 'Missing / wrong item',
  'Food quality', 'Late delivery', 'Payment / refund', 'Talk to support'
];

const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const digitsOf = (s) => String(s || '').replace(/\D/g, '');

function extractOrderNumber(text) {
  const m = String(text).match(/#?\s*(?:ord(?:er)?[-\s#]*)?(\d{4,10})\b|\b([A-Za-z]{2,6}-\d{3,10})\b/i);
  return m ? (m[2] || m[1]).toUpperCase() : null;
}

function ownsOrder(order, user, phoneInput) {
  if (user?.email && order.user?.email && user.email.toLowerCase() === order.user.email.toLowerCase()) return true;
  const given = digitsOf(phoneInput).slice(-4);
  const actual = digitsOf(order.user?.phone).slice(-4);
  return given.length === 4 && actual.length === 4 && given === actual;
}

function detectIntent(text) {
  const t = text.toLowerCase();
  if (/(another|different|other|change) order/.test(t)) return 'switch';
  if (/cancel/.test(t)) return 'cancel';
  if (/(refund|payment|paid|charged|money back|deducted)/.test(t)) return 'refund';
  if (/(missing|wrong|incorrect|different item|not received|short)/.test(t)) return 'item';
  if (/(cold|stale|taste|quality|spoil|spoilt|bad food|raw|burnt|hair|smell)/.test(t)) return 'quality';
  if (/(\blate\b|delay|taking (so )?long|how long)/.test(t)) return 'late';
  if (/(track|where|status|\beta\b)/.test(t)) return 'track';
  if (/(detail|summary|person|customer|address|my order|info)/.test(t)) return 'details';
  if (/(support|human|agent|executive|representative|complain|talk to|speak to|call me)/.test(t)) return 'support';
  if (/(enquir|inquir|bulk|catering|feedback|contact|question)/.test(t)) return 'enquiry';
  if (/(issue|problem|help)/.test(t)) return 'help';
  if (/^(hi|hello|hey|namaste|namaskar|hii+)\b/.test(t)) return 'greeting';
  return null;
}

// positive = minutes remaining to the estimate, negative = running late
function minutesToEta(order) {
  const placed = new Date(order.createdAt || Date.now()).getTime();
  return Math.round((placed + (order.estimatedMinutes || 28) * 60000 - Date.now()) / 60000);
}

function stageLine(status) {
  const idx = Math.max(0, STAGES.indexOf(status === 'Pending' ? 'Placed' : status));
  return STAGES.map((s, i) => `${i < idx ? '✅' : i === idx ? (status === 'Delivered' ? '✅' : '🔄') : '⬜'} ${s}`).join('\n');
}

function createChatAgent({ orders, store, notifyAdmin = () => {} }) {
  const sessions = new Map();

  function session(id, user) {
    const now = Date.now();
    const ownerEmail = user?.email ? String(user.email).toLowerCase() : '';
    for (const [k, v] of sessions) if (now - v.touched > SESSION_TTL_MS) sessions.delete(k);
    if (!sessions.has(id) || sessions.get(id).ownerEmail !== ownerEmail) {
      sessions.set(id, {
        step: 'idle',
        attempts: 0,
        locked: false,
        touched: now,
        ownerEmail
      });
    }
    const s = sessions.get(id);
    s.touched = now;
    return s;
  }

  // clearFlow keeps the selected order (like Swiggy remembering context); resetAll forgets it.
  const clearFlow = (s) => Object.assign(s, { step: 'idle', intent: null, reason: '', enquiry: null, category: null, tries: 0 });
  const resetAll = (s) => { clearFlow(s); Object.assign(s, { order: null, verified: false }); };

  const out = (reply, quickReplies = []) => ({ reply, quickReplies });
  const menu = (prefix = '') => out(`${prefix}How can I help you today?`, MAIN);
  const orderHeader = (o) => `Order ${o.orderNumber} • ${o.status} • ${inr(o.totalAmount)}`;
  const whenDone = (s, text) => { clearFlow(s); return out(text, ORDER_MENU); };

  function details(order) {
    const lines = order.items.map((i) => `• ${i.name} (${i.variantLabel}) × ${i.quantity} — ${inr(i.lineTotal)}`);
    const a = order.deliveryAddress || {};
    const cancel = store.latestCancellation(order.orderNumber);
    const parts = [
      orderHeader(order), '', ...lines, '',
      `Subtotal ${inr(order.subtotal)}` +
        (order.discountAmount ? ` | Discount −${inr(order.discountAmount)}` : '') +
        ` | Delivery ${inr(order.deliveryCharge)} | Total ${inr(order.totalAmount)}`,
      `Payment: ${order.paymentMethod} (${order.paymentStatus})`, '',
      'Order contact details',
      `Name: ${order.user?.name || '-'}`,
      `Phone: ${order.user?.phone || '-'}`,
      `Address: ${[a.street, a.landmark, a.city, a.pincode].filter(Boolean).join(', ') || '-'}`
    ];
    if (cancel) parts.push('', `Cancellation request ${cancel.id}: ${cancel.status}${cancel.adminNote ? ` — ${cancel.adminNote}` : ''}`);
    return parts.join('\n');
  }

  // Raise a ticket once per order+category while one is still open.
  function raiseTicket(order, category, message, priority = 'normal') {
    const dup = store.listEnquiries('open').find((e) => e.orderNumber === order.orderNumber && e.category === category);
    if (dup) return { ticket: dup, existing: true };
    const ticket = store.addEnquiry({
      category, priority, orderNumber: order.orderNumber,
      name: order.user?.name || '', phone: order.user?.phone || '', userEmail: order.user?.email || '', message
    });
    notifyAdmin('chat:enquiry', { id: ticket.id, category, orderNumber: order.orderNumber });
    return { ticket, existing: false };
  }

  const ticketReply = (s, { ticket, existing }, lead) =>
    whenDone(s, existing
      ? `You already have an open ticket for this (${ticket.id}). The team will contact you on ${ticket.phone || 'your registered number'}.`
      : `${lead} I've raised ticket ${ticket.id} and the team will review it and contact you on ${ticket.phone || 'your registered number'}.`);

  async function runIntent(s) {
    const o = s.order;
    const delivered = o.status === 'Delivered';
    const cancelled = o.status === 'Cancelled';

    switch (s.intent) {
      case 'details':
        return whenDone(s, details(o));

      case 'track': {
        if (cancelled) return whenDone(s, `${orderHeader(o)}\nThis order has been cancelled.`);
        if (delivered) return whenDone(s, `${orderHeader(o)}\n${stageLine(o.status)}\nYour order has been delivered. Enjoy your meal!`);
        const m = minutesToEta(o);
        const eta = m > 0
          ? `Estimated arrival in about ${m} min.`
          : `It is running about ${-m} min past the estimate and I'm sorry for the wait. I can raise this with the team.`;
        const cancel = store.latestCancellation(o.orderNumber);
        const extra = cancel?.status === 'pending' ? `\nCancellation request ${cancel.id} is waiting for admin confirmation.` : '';
        return out(`${orderHeader(o)}\n${stageLine(o.status)}\n${eta}${extra}`, m > 0 ? ORDER_MENU : ['Late delivery', ...ORDER_MENU.filter((c) => c !== 'Late delivery')]);
      }

      case 'cancel': {
        const existing = store.latestCancellation(o.orderNumber);
        if (cancelled) return whenDone(s, `Order ${o.orderNumber} is already cancelled.`);
        if (existing && existing.status === 'pending') {
          return whenDone(s, `A cancellation request (${existing.id}) for ${o.orderNumber} is already waiting for admin confirmation.`);
        }
        if (!CANCELLABLE.includes(o.status)) {
          clearFlow(s);
          return out(`Order ${o.orderNumber} is already "${o.status}", so I can't send a cancellation request for it. I can connect you with the team instead.`, ['Talk to support', 'Track my order']);
        }
        s.step = 'cancel_reason';
        return out(`Why would you like to cancel order ${o.orderNumber}? (a short reason is fine)`);
      }

      case 'item':
      case 'quality': {
        if (cancelled) return whenDone(s, 'This order was cancelled, so there is nothing to report on it.');
        if (!['Out for Delivery', 'Delivered'].includes(o.status)) {
          return whenDone(s, `Your order is still "${o.status}". Once it arrives, tell me if anything is wrong — or check the live status with "Track my order".`);
        }
        s.category = s.intent;
        s.step = 'issue_detail';
        return out(s.intent === 'item'
          ? 'Sorry about that. Which item is missing or wrong? Please describe it.'
          : 'Sorry the food was not up to the mark. Please tell me what was wrong (which item, and what the problem was).');
      }

      case 'late': {
        if (cancelled) return whenDone(s, 'This order was cancelled.');
        if (delivered) {
          s.category = 'late';
          s.step = 'issue_detail';
          return out('Sorry it arrived late. Tell me how late it was and the team will look into it.');
        }
        const m = minutesToEta(o);
        if (m > 0) return whenDone(s, `Your order is ${o.status.toLowerCase()} and should arrive in about ${m} min. If it runs late, ask me again and I'll raise it with the team.`);
        const r = raiseTicket(o, 'late', `Order running ${-m} min past ETA (status: ${o.status})`, 'high');
        return ticketReply(s, r, `I'm sorry — your order is ${-m} min past the estimate.`);
      }

      case 'refund': {
        if (o.paymentMethod === 'Cash on Delivery') {
          return whenDone(s, `Order ${o.orderNumber} is Cash on Delivery, so no online payment was taken.`);
        }
        const pay = `Payment: ${inr(o.totalAmount)} via ${o.paymentMethod} (${o.paymentStatus})${o.paymentId ? `, ref …${String(o.paymentId).slice(-6)}` : ''}.`;
        if (cancelled) {
          const r = raiseTicket(o, 'refund', 'Customer asked about refund for a cancelled paid order', 'high');
          return ticketReply(s, r, `${pay}\nThis order is cancelled.`);
        }
        return out(`${pay}\nIf you want your money back for this order, you can cancel it (while it is still being accepted) or talk to our team.`, ['Cancel order', 'Talk to support', 'Track my order']);
      }

      case 'support': {
        s.enquiry = { name: o.user?.name || '', phone: digitsOf(o.user?.phone).slice(-10), category: 'support', orderNumber: o.orderNumber };
        s.step = 'enq_message';
        return out(`I'll connect you with our team about order ${o.orderNumber}. Please describe what you need help with.`);
      }

      default: // 'help' / 'switch'
        clearFlow(s);
        return out(`${orderHeader(o)}\nWhat's the issue with this order? You can also type another order number any time.`, ORDER_MENU);
    }
  }

  async function askForOrder(s, user) {
    if (user?.email && typeof orders.listRecentByEmail === 'function') {
      const recent = await orders.listRecentByEmail(user.email, 3);
      if (recent.length) {
        s.step = 'order_number';
        return out(
          `Which order do you need help with?\n${recent.map((o) => `• ${o.orderNumber} — ${o.status} — ${inr(o.totalAmount)}`).join('\n')}`,
          recent.map((o) => o.orderNumber)
        );
      }
    }
    s.step = 'order_number';
    return out('Sure. What is your order number? (for example ORD-10029)');
  }

  async function lookupOrder(s, num, user) {
    const order = await orders.findByNumber(num);
    if (!order) {
      s.step = 'order_number';
      return out(`I couldn't find order ${num}. Please check the number and try again, or type "menu".`);
    }
    s.order = order;
    s.verified = false;
    if (ownsOrder(order, user, '')) {
      s.verified = true;
      return runIntent(s);
    }
    s.step = 'verify_phone';
    return out('To protect your privacy, please enter the last 4 digits of the phone number used on this order.');
  }

  function startEnquiry(s, user, category = 'enquiry') {
    clearFlow(s);
    s.intent = 'enquiry';
    const prefillName = s.verified ? s.order?.user?.name : user?.name;
    s.enquiry = { category, ...(s.verified && s.order ? { orderNumber: s.order.orderNumber } : {}) };
    if (prefillName) {
      s.enquiry.name = prefillName;
      s.step = 'enq_phone';
      return out(`Happy to help, ${prefillName}. What phone number can the team reach you on?`);
    }
    s.step = 'enq_name';
    return out('Happy to help. May I have your name?');
  }

  async function route(s, intent, text, user) {
    if (intent === 'enquiry') return startEnquiry(s, user);
    if (intent === 'greeting') return menu('Hello! ');
    if (intent === 'support' && !s.order) return startEnquiry(s, user, 'support');
    if (intent === 'switch') { s.order = null; s.verified = false; }
    clearFlow(s);
    s.intent = intent;
    const num = extractOrderNumber(text);
    if (num) return lookupOrder(s, num, user);
    if (s.order && s.verified) return runIntent(s);
    return askForOrder(s, user);
  }

  async function start({ sessionId, user }) {
    const s = session(sessionId, user);
    const hi = user?.name ? `Hi ${user.name}! ` : 'Hello! ';
    if (user?.email && typeof orders.listRecentByEmail === 'function') {
      const recent = await orders.listRecentByEmail(user.email, 3);
      if (recent.length) {
        s.step = 'order_number';
        return out(
          `${hi}Which order do you need help with?\n${recent.map((o) => `• ${o.orderNumber} — ${o.status} — ${inr(o.totalAmount)}`).join('\n')}`,
          [...recent.map((o) => o.orderNumber), 'Talk to support']
        );
      }
    }
    return menu(hi);
  }

  async function handle({ sessionId, message, user }) {
    const s = session(sessionId, user);
    const text = String(message || '').trim().slice(0, 1000);

    if (s.locked) return out('Too many wrong verification attempts. Please try again later or send an enquiry from the contact page.');
    if (!text) return menu('Hello! ');
    if (/^(start over|restart)$/i.test(text)) { resetAll(s); return menu(); }
    if (/^(menu|exit|stop|main menu)$/i.test(text)) { clearFlow(s); return menu(); }

    switch (s.step) {
      case 'order_number': {
        const num = extractOrderNumber(text);
        if (!num) {
          const other = detectIntent(text);
          if (other && other !== 'greeting') return route(s, other, text, user);
          s.tries = (s.tries || 0) + 1;
          if (s.tries >= 3) { clearFlow(s); return menu("I couldn't find an order number in your messages. "); }
          return out('Please type your order number, for example ORD-10029.');
        }
        return lookupOrder(s, num, user);
      }

      case 'verify_phone': {
        s.attempts += 1;
        if (ownsOrder(s.order, user, text)) {
          s.verified = true;
          s.attempts = 0;
          return runIntent(s);
        }
        if (s.attempts >= 3) {
          s.locked = true;
          s.order = null;
          return out('That does not match our records and the limit of 3 attempts is reached.');
        }
        return out(`That doesn't match. Please enter the last 4 digits of the phone number used on the order (${3 - s.attempts} attempt(s) left).`);
      }

      case 'cancel_reason':
        s.reason = text;
        s.step = 'cancel_confirm';
        return out(
          `Send a cancellation request for ${s.order.orderNumber} (${inr(s.order.totalAmount)}, ${s.order.status})?\nReason: ${s.reason}\n\nThe admin has to confirm before it is cancelled.`,
          ['Yes, send request', 'No']
        );

      case 'cancel_confirm': {
        if (/^(y|yes|confirm|ok|sure|haan|ha)\b/i.test(text)) {
          const o = s.order;
          const req = store.addCancellation({
            orderNumber: o.orderNumber, customerName: o.user?.name || '', customerPhone: o.user?.phone || '',
            customerEmail: o.user?.email || '', reason: s.reason, orderStatusAtRequest: o.status,
            totalAmount: o.totalAmount, paymentMethod: o.paymentMethod, paymentStatus: o.paymentStatus
          });
          notifyAdmin('chat:cancel-request', { id: req.id, orderNumber: o.orderNumber });
          const refund = o.paymentStatus === 'Paid' ? ' Since this order was paid online, any refund will be handled by the admin after approval.' : '';
          return whenDone(s, `Your cancellation request ${req.id} has been sent to the admin. The order stays active until they confirm.${refund}`);
        }
        clearFlow(s);
        return out('Okay, I have not cancelled anything.', ORDER_MENU);
      }

      case 'issue_detail': {
        const r = raiseTicket(s.order, s.category, text);
        return ticketReply(s, r, 'Thank you for letting us know.');
      }

      case 'enq_name':
        s.enquiry.name = text.slice(0, 80);
        s.step = 'enq_phone';
        return out('Thanks. What phone number can the team reach you on?');

      case 'enq_phone': {
        const d = digitsOf(text).slice(-10);
        if (d.length !== 10) return out('Please enter a valid 10-digit mobile number.');
        s.enquiry.phone = d;
        s.step = 'enq_message';
        return out('Great. Now type your enquiry or message.');
      }

      case 'enq_message': {
        const eq = store.addEnquiry({ priority: 'normal', ...s.enquiry, message: text, userEmail: user?.email || '' });
        notifyAdmin('chat:enquiry', { id: eq.id, category: eq.category });
        clearFlow(s);
        return out(`Your message ${eq.id} has been sent to the team. They will contact you on ${eq.phone}.`, s.order ? ORDER_MENU : MAIN);
      }

      default: {
        const num = extractOrderNumber(text);
        const intent = detectIntent(text) || (num ? 'help' : null);
        if (!intent) return menu("Sorry, I didn't get that. ");
        return route(s, intent, text, user);
      }
    }
  }

  return { handle, start, extractOrderNumber, CANCELLABLE };
}

module.exports = { createChatAgent, extractOrderNumber, ownsOrder, CANCELLABLE };
