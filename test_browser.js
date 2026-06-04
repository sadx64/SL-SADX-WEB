import puppeteer from 'puppeteer';

(async () => {
    const browser = await puppeteer.launch({
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', err => console.error('PAGE ERROR:', err.toString()));
    
    await page.goto('https://sl-flix-web.vercel.app/');
    
    await new Promise(r => setTimeout(r, 5000));
    await browser.close();
})();
