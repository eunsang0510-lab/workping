const sharp = require('sharp');
const path = require('path');

sharp(path.join(__dirname, 'icon-192.svg'))
  .resize(192, 192)
  .png()
  .toFile(path.join(__dirname, 'icon-192.png'), (err, info) => {
    if (err) console.error('192 오류:', err);
    else console.log('icon-192.png 생성 완료');
  });

sharp(path.join(__dirname, 'icon-512.svg'))
  .resize(512, 512)
  .png()
  .toFile(path.join(__dirname, 'icon-512.png'), (err, info) => {
    if (err) console.error('512 오류:', err);
    else console.log('icon-512.png 생성 완료');
  });