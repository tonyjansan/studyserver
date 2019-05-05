const crypto = require('crypto');
const express = require('express');
const fs = require('fs');
const path = require('path');
const process = require('child_process');
const multer  = require('multer');

const router = express.Router();
const upload = multer({ dest: 'data/'});

const soffice = 'libreoffice --invisible --convert-to pdf --outdir data ';

const readFileMd5 = url => {
  return new Promise(callback => {
    const md5sum = crypto.createHash('md5');
    const stream = fs.createReadStream(url);
    stream.on('data', chunk => {
      md5sum.update(chunk);
    });
    stream.on('end', () => {
      let fileMd5 = md5sum.digest('hex');
      callback(fileMd5);
    });
  });
}

/* GET upload page. */
router.get('/', function(req, res, next) {
  res.render('upload', { title: '文件上传' });
});

router.post('/single.play', upload.single('ppt'), function(req, res, next) {
  const file = req.file;
  readFileMd5(file.path).then(md5String => {
    const pptName = md5String + '.ppt';
    const pdfName = md5String + '.pdf';
    const pptPath = path.join(file.destination, pptName);
    const pdfPath = path.join(file.destination, pdfName);
    if (fs.existsSync(pdfPath)) {
      res.render('play', { title: pdfName });
      fs.unlink(file.path, e => {
        console.log(e);
      });
      return;
    }
    if (fs.existsSync(pptPath)) {
      fs.unlink(file.path, e => {
        console.log(e);
      });
    } else {
      fs.renameSync(file.path, pptPath);
    }
    process.exec(soffice + path.join('.', pptPath), (error, stdout, stderr) => {
      res.render('play', { title: pdfName });
    });
  }).catch(e => {
    console.log(e);
  });
});

module.exports = router;
