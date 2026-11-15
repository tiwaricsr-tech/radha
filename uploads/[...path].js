const proxy = require('../lib/proxy');

module.exports = (req, res) => proxy(req, res, '/uploads');

module.exports.config = {
  api: { bodyParser: false }
};
