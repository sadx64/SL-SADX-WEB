# SL-FLIX Dynamic Streaming Platform

A premium high-performance, full-stack video streaming and content delivery platform. Engine-built on a modular architecture featuring **React 18**, **Vite**, **Tailwind CSS**, and a high-efficiency **Node.js/Express** proxy backend.

---

## 🚀 Key Architectural Features

### 📡 Advanced Video Streaming Engine
* **Hybrid Core**: Integrated support for direct MP4 playback and low-latency **HLS (HTTP Live Streaming)** via **Hls.js**.
* **Smart Buffering**: Adaptive cache-backed buffered progression loaded on custom worker streams.
* **On-the-fly Subtitle Parsing**: Native support for **SRT to WebVTT** format parsing and conversion on the fly for complete client-side cross-device compatibility.
* **Intelligent Auto-Resume**: Automatic user session progress bookmarking synced locally on a decentralized event-driven cycle (`slflix_progress`).
* **Source Quality Negotiator**: Seamless in-player source quality selection down to the exact bit-rate and file sizes.

### ⚡ Performance & Cache Subsystems
* **Dual-Tier Cache Service**: Memory-locked cache TTL negotiator matching sub-second pre-fetching criteria to minimize external API loads and redundant fetches.
* **SEO Optimized Metadata Engine**: Dynamic server-side and client-side title, tag, and visual description hydration for responsive indexing and share overlays.

### 🛡️ Production Security & Safety Guards
* **Cross-Origin Security**: Customized CORS filters, secure CSP layers, and asset isolation parameters.
* **Fail-Safe Robustness**: Integrated `productionGuard` to intercept runtime console side-effects, network reconnection banners, and offline fallback screens.

---

## 🛠️ Codebase Structure

```bash
├── api/             # Backend API endpoint micro-services and server architecture
├── components/      # Modular shared UI components (VideoPlayer, Modal pipelines, views)
├── services/        # Client-side core services (API cache broker, SEO managers)
├── hooks/           # Scalable custom React Hooks (Intersection observer, window resize adapters)
├── types.ts         # High-fidelity shared static TypeScript interfaces
├── App.tsx          # Main layout router and viewport loader
└── server.js        # Standalone, high-throughput Express proxy gateway
```

---

## ⚙️ Development & Deployment

### Local Development
To launch the developer playground with real-time assets module rendering:
```bash
npm install
npm run dev
```

### Production Build & Launch
Build the front-end production bundles and kick off the highly optimized static file compression server:
```bash
npm run build
npm start
```
