var express = require('express');
var path = require('path');
var router = express.Router();

/* GET home page - serve landing page */
router.get('/', function(req, res, next) {
  res.sendFile(path.join(__dirname, '../public/frontend/landing.html'));
});

module.exports = router;
