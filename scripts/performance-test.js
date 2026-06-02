#!/usr/bin/env node



const puppeteer = require('puppeteer');
const { performance } = require('perf_hooks');

async function testPerformance() {
  console.log('🧪 Starting Netflix Performance Tests...\n');

  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  
  const requests = [];
  page.on('request', request => {
    requests.push({
      url: request.url(),
      type: request.resourceType(),
      timestamp: performance.now()
    });
  });

  page.on('response', response => {
    const lastRequest = requests[requests.length - 1];
    if (lastRequest && lastRequest.url === response.url()) {
      lastRequest.status = response.status();
      lastRequest.size = response.headers()['content-length'] || 'unknown';
    }
  });

  try {
    
    console.log('🏠 Testing home page loading...');
    const startTime = performance.now();
    
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle2' });
    
    const loadTime = performance.now() - startTime;
    console.log(`   ⏱️  Page load time: ${loadTime.toFixed(2)}ms`);

    
    await page.waitForSelector('[data-testid="hero"]', { timeout: 5000 });
    const contentLoadTime = performance.now() - startTime;
    console.log(`   ⏱️  Content load time: ${contentLoadTime.toFixed(2)}ms`);

    
    const jsRequests = requests.filter(r => r.type === 'script');
    const imageRequests = requests.filter(r => r.type === 'image');
    const apiRequests = requests.filter(r => r.url.includes('/api-'));

    console.log('\n📊 Request Analysis:');
    console.log(`   📄 JavaScript files: ${jsRequests.length}`);
    console.log(`   🖼️  Images: ${imageRequests.length}`);
    console.log(`   🔌 API calls: ${apiRequests.length}`);

    
    console.log('\n🔒 File Exposure Check:');
    const exposedFiles = jsRequests.filter(r => 
      r.url.includes('.tsx') || r.url.includes('.ts') || r.url.includes('src/')
    );

    if (exposedFiles.length === 0) {
      console.log('   ✅ No source files exposed');
    } else {
      console.log(`   ⚠️  ${exposedFiles.length} source files may be exposed:`);
      exposedFiles.forEach(f => console.log(`      - ${f.url}`));
    }

    
    console.log('\n🎬 Testing movie detail page...');
    const movieStartTime = performance.now();
    
    
    const firstMovie = await page.$('[data-testid="movie-card"]');
    if (firstMovie) {
      await firstMovie.click();
      await page.waitForSelector('[data-testid="movie-details"]', { timeout: 5000 });
      
      const movieLoadTime = performance.now() - movieStartTime;
      console.log(`   ⏱️  Movie detail load time: ${movieLoadTime.toFixed(2)}ms`);
    }

    
    const metrics = await page.metrics();
    console.log('\n📈 Performance Metrics:');
    console.log(`   🕐 Timestamp: ${metrics.Timestamp}`);
    console.log(`   📦 Documents: ${metrics.Documents}`);
    console.log(`   🖼️  Frames: ${metrics.Frames}`);
    console.log(`   ⚡ JSEventListeners: ${metrics.JSEventListeners}`);

    console.log('\n✅ Performance tests completed!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    await browser.close();
  }
}


async function checkServer() {
  try {
    const response = await fetch('http://localhost:3000');
    return response.ok;
  } catch {
    return false;
  }
}

async function main() {
  const serverRunning = await checkServer();
  if (!serverRunning) {
    console.log('❌ Server not running on http://localhost:3000');
    console.log('   Please start the server with: npm run start');
    process.exit(1);
  }

  await testPerformance();
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { testPerformance };
