// Run: node test/chatAgent.test.js   (no database needed)
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const chatDataFile = path.join(os.tmpdir(), `chat-test-${Date.now()}.json`);
process.env.CHAT_DATA_FILE = chatDataFile;

const store = require('../services/chatStore');
const { createChatAgent } = require('../services/chatAgent');

const ago = (m) => new Date(Date.now() - m * 60000);
const db = {
  'ORD-10030': {
    orderNumber: 'ORD-10030', status: 'Preparing', createdAt: ago(60), estimatedMinutes: 28, totalAmount: 500,
    paymentMethod: 'Cash on Delivery', paymentStatus: 'COD Pending', items: [],
    user: { name: 'Late Lal', phone: '9111111111', email: 'l@x.com' }
  },
  'ORD-10031': {
    orderNumber: 'ORD-10031', status: 'Delivered', createdAt: ago(90), totalAmount: 300, paymentMethod: 'UPI', paymentStatus: 'Paid',
    paymentId: 'pay_ABC123456', items: [], user: { name: 'Late Lal', phone: '9111111111', email: 'l@x.com' }
  },
  'ORD-10029': {
    orderNumber: 'ORD-10029', status: 'Pending', createdAt: ago(10), subtotal: 800, discountAmount: 0, deliveryCharge: 45, totalAmount: 845,
    paymentMethod: 'UPI', paymentStatus: 'Paid',
    user: { name: 'Aman P', phone: '9876543210', email: 'aman@example.com' },
    items: [{ name: 'Kaju Katli', variantLabel: '500g', quantity: 1, lineTotal: 800 }],
    deliveryAddress: { street: '12 Station Rd', city: 'Rewa', pincode: '486001' }
  },
  'ORD-10027': { orderNumber: 'ORD-10027', status: 'Out for Delivery', user: { name: 'Priya', phone: '9123456780', email: 'p@x.com' }, items: [], totalAmount: 1 }
};
const events = [];
const agent = createChatAgent({
  orders: {
    findByNumber: async (n) => db[n] || db[`ORD-${String(n).replace(/\D/g, '')}`] || null,
    listRecentByEmail: async (email) => Object.values(db).filter((o) => o.user.email === email)
  },
  store,
  notifyAdmin: (e, p) => events.push([e, p])
});
const say = (sid, message, user) => agent.handle({ sessionId: sid, message, user });

(async () => {
  // details: wrong digits then right digits
  let r = await say('s1', 'show my order details');
  assert.match(r.reply, /order number/i);
  r = await say('s1', 'order 10029');
  assert.match(r.reply, /last 4 digits/);
  r = await say('s1', '1111');
  assert.match(r.reply, /doesn't match/);
  r = await say('s1', '3210');
  assert.match(r.reply, /Kaju Katli/);
  assert.match(r.reply, /Aman P/);

  // cancel with admin confirmation
  r = await say('s2', 'I want to cancel #ORD-10029');
  assert.match(r.reply, /last 4/);
  await say('s2', '3210');
  r = await say('s2', 'ordered by mistake');
  assert.match(r.reply, /admin has to confirm/);
  r = await say('s2', 'yes');
  assert.match(r.reply, /CR-/);
  assert.strictEqual(events[0][0], 'chat:cancel-request');
  assert.strictEqual(store.listCancellations('pending').length, 1);
  r = await say('s3', 'cancel ORD-10029', { email: 'aman@example.com' }); // logged in owner skips phone
  assert.match(r.reply, /already waiting for admin/);

  // not cancellable
  r = await say('s4', 'cancel ORD-10027', { email: 'p@x.com' });
  assert.match(r.reply, /Out for Delivery/);

  // enquiry
  await say('s5', 'I have an enquiry');
  await say('s5', 'Ravi');
  r = await say('s5', '123');
  assert.match(r.reply, /10-digit/);
  await say('s5', '9000000000');
  r = await say('s5', 'Do you take bulk orders?');
  assert.match(r.reply, /EQ-/);
  assert.strictEqual(store.listEnquiries('open').length, 1);

  // lockout after 3 bad attempts
  await say('s6', 'order details ORD-10029');
  await say('s6', '0000'); await say('s6', '0001'); await say('s6', '0002');
  r = await say('s6', '3210');
  assert.match(r.reply, /Too many/);

  // unknown order never leaks details
  r = await say('s7', 'status of order 99999');
  assert.match(r.reply, /couldn't find/);

  // ---- Swiggy-style flows ----
  const lal = { email: 'l@x.com', name: 'Lal' };
  r = await agent.start({ sessionId: 'w1', user: lal });
  assert.match(r.reply, /ORD-10030/);
  assert.ok(r.quickReplies.includes('ORD-10031'));

  // pick order from chips (no phone check for owner) -> tracking with progress + late notice
  r = await say('w1', 'Track my order', lal);
  assert.match(r.reply, /Which order/);
  r = await say('w1', 'ORD-10030', lal);
  assert.match(r.reply, /🔄 Preparing/);
  assert.match(r.reply, /past the estimate/);
  assert.strictEqual(r.quickReplies[0], 'Late delivery');

  // late delivery auto-escalates once, dedupes the second time
  r = await say('w1', 'Late delivery', lal);
  assert.match(r.reply, /ticket EQ-/);
  assert.strictEqual(store.listEnquiries('open').find((e) => e.category === 'late').priority, 'high');
  r = await say('w1', 'Late delivery', lal);
  assert.match(r.reply, /already have an open ticket/);

  // context is remembered; COD order has no refund
  r = await say('w1', 'Payment / refund', lal);
  assert.match(r.reply, /Cash on Delivery/);

  // switch order by typing a number; missing item on delivered order -> ticket
  r = await say('w1', 'ORD-10031', lal);
  assert.match(r.reply, /Delivered/);
  r = await say('w1', 'Missing / wrong item', lal);
  assert.match(r.reply, /Which item/);
  r = await say('w1', 'Gulab jamun box was missing', lal);
  assert.match(r.reply, /ticket EQ-/);
  r = await say('w1', 'Payment / refund', lal);
  assert.match(r.reply, /via UPI/);

  // quality complaint on the delivered order asks for details, then raises a ticket
  r = await say('w1', 'Food quality', lal);
  assert.match(r.reply, /what was wrong/);
  r = await say('w1', 'The samosa was cold', lal);
  assert.match(r.reply, /ticket EQ-/);

  // item issue before delivery is declined
  r = await say('w2', 'wrong item ORD-10030', lal);
  assert.match(r.reply, /still "Preparing"/);

  // support attaches the order and prefills contact
  r = await say('w2', 'Talk to support', lal);
  assert.match(r.reply, /ORD-10030/);
  r = await say('w2', 'Please call me about this', lal);
  assert.match(r.reply, /EQ-/);
  assert.strictEqual(store.listEnquiries('open').find((e) => e.category === 'support').orderNumber, 'ORD-10030');

  // A verified chat session is reset when another account uses the same browser session.
  r = await say('shared-session-id', 'order details ORD-10029', { email: 'aman@example.com' });
  assert.match(r.reply, /Aman P/);
  r = await say('shared-session-id', 'show order details', { email: 'someone-else@example.com' });
  assert.match(r.reply, /order number/i);
  assert.doesNotMatch(r.reply, /Aman P|Station Rd/);

  console.log('all chat agent tests passed');
})()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => {
    try {
      fs.unlinkSync(chatDataFile);
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;
    }
  });
