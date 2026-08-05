const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  let mountCount = 0;
  let navCount = 0;

  page.on('console', msg => {
    if (msg.text() === 'workspace mounted') mountCount++;
    console.log('PAGE LOG:', msg.text());
  });

  page.on('framenavigated', frame => {
    if (frame === page.mainFrame()) navCount++;
    console.log('NAVIGATED:', frame.url());
  });

  await page.goto('http://localhost:3000');
  await page.waitForSelector('input[type="file"]');
  
  console.log('Selecting file...');
  const inputUploadHandle = await page.$('input[type="file"]');
  
  // create a dummy file
  const fs = require('fs');
  fs.writeFileSync('dummy.pdf', 'dummy content');
  
  await inputUploadHandle.uploadFile('dummy.pdf');
  
  await new Promise(r => setTimeout(r, 3000));
  
  console.log('mountCount:', mountCount);
  console.log('navCount:', navCount);
  
  await browser.close();
})();
