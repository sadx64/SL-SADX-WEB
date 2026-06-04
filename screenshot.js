import puppeteer from 'puppeteer';

(async () => {
    const browser = await puppeteer.launch({
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    await page.goto('https://sl-flix-web.vercel.app/', { waitUntil: 'networkidle0' });
    
    // get body inner HTML
    const html = await page.evaluate(() => document.body.innerHTML);
    console.log(html.substring(0, 500));
    await browser.close();
})();
