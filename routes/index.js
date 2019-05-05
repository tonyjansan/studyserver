const express = require('express');
const path = require('path');
const router = express.Router();

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', { title: 'Express' });
});

router.get('/data/:id', function (req, res, next) {
  const file = path.resolve(__dirname, '../data', req.params.id);
  console.log(file);
  res.sendFile(file);
});

module.exports = router;
