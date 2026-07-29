const https = require('https');

const urls = [
  'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?q=80&w=600&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?q=80&w=600&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1436491865332-7a61a109cc05?q=80&w=600&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?q=80&w=600&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?q=80&w=600&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1554224155-6726b3ff858f?q=80&w=600&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1568992687947-868a62a9f521?q=80&w=600&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=600&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1500382017468-9049fed747ef?q=80&w=600&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1589829085413-56de8ae18c73?q=80&w=600&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1517524206127-48bbd363f3d7?q=80&w=600&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1469571486292-0ba58a3f068b?q=80&w=600&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1497215728101-856f4ea42174?q=80&w=600&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1501785888041-af3ef285b470?q=80&w=600&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1555899434-94d1368aa7af?q=80&w=600&auto=format&fit=crop'
];

async function checkUrl(url) {
  return new Promise((resolve) => {
    https.get(url, (res) => {
      if (res.statusCode !== 200) {
        console.log(`BROKEN: ${res.statusCode} - ${url}`);
      }
      resolve();
    }).on('error', (e) => {
      console.log(`ERROR: ${e.message} - ${url}`);
      resolve();
    });
  });
}

async function main() {
  await Promise.all(urls.map(checkUrl));
  console.log("Done checking.");
}
main();
