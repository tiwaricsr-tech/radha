// Small JSON-file store for cancellation requests and enquiries.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const FILE = () => process.env.CHAT_DATA_FILE || path.join(__dirname, '..', 'data', 'chat.json');

function load() {
  let contents;
  try {
    contents = fs.readFileSync(FILE(), 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') return { cancellations: [], enquiries: [] };
    throw err;
  }

  let data;
  try {
    data = JSON.parse(contents);
  } catch (err) {
    throw new Error(`Could not parse chat data file: ${err.message}`);
  }
  if (!data || !Array.isArray(data.cancellations) || !Array.isArray(data.enquiries)) {
    throw new Error('Chat data file must contain cancellation and enquiry arrays.');
  }
  return data;
}

function save(data) {
  fs.mkdirSync(path.dirname(FILE()), { recursive: true });
  fs.writeFileSync(FILE(), JSON.stringify(data, null, 2));
}

const newId = (prefix) => `${prefix}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

function addCancellation(fields) {
  const data = load();
  const item = { id: newId('CR'), status: 'pending', createdAt: new Date().toISOString(), ...fields };
  data.cancellations.unshift(item);
  save(data);
  return item;
}

function latestCancellation(orderNumber) {
  return load().cancellations.find((c) => c.orderNumber === orderNumber) || null;
}

function listCancellations(status) {
  const all = load().cancellations;
  return status ? all.filter((c) => c.status === status) : all;
}

function getCancellation(id) {
  return load().cancellations.find((c) => c.id === id) || null;
}

function updateCancellation(id, patch) {
  const data = load();
  const item = data.cancellations.find((c) => c.id === id);
  if (!item) return null;
  Object.assign(item, patch, { updatedAt: new Date().toISOString() });
  save(data);
  return item;
}

function addEnquiry(fields) {
  const data = load();
  const item = { id: newId('EQ'), status: 'open', createdAt: new Date().toISOString(), ...fields };
  data.enquiries.unshift(item);
  save(data);
  return item;
}

function listEnquiries(status) {
  const all = load().enquiries;
  return status ? all.filter((e) => e.status === status) : all;
}

function updateEnquiry(id, patch) {
  const data = load();
  const item = data.enquiries.find((e) => e.id === id);
  if (!item) return null;
  Object.assign(item, patch, { updatedAt: new Date().toISOString() });
  save(data);
  return item;
}

module.exports = {
  addCancellation,
  latestCancellation,
  listCancellations,
  getCancellation,
  updateCancellation,
  addEnquiry,
  listEnquiries,
  updateEnquiry
};
