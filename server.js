const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const { existsSync } = require('fs');
const { createServer } = require('http');
const { server: wisp, logging } = require('@mercuryworkshop/wisp-js/server');

const app = express();
const server = createServer(app);

// Wisp configuration
logging.set_level(logging.NONE);
Object.assign(wisp.options, {
  allow_udp_streams: false,
  dns_servers: ["1.1.1.1", "8.8.8.8"],
  allow_insecure: true,
});

// Required for SharedWorker (libcurl/baremux)
app.use((req, res, next) => {
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
  next();
});

server.on('upgrade', (req, socket, head) => {
    if (req.url.startsWith('/wisp/')) {
        wisp.routeRequest(req, socket, head);
    } else {
        socket.end();
    }
});

async function loadFolderData(folder) {
    const file = path.join(__dirname, folder, `${folder}.json`);
    try {
        const txt = await fs.readFile(file, 'utf8');
        return JSON.parse(txt);
    } catch (e) {
        console.error(`error loading ${folder}/${folder}.json`, e);
        return [];
    }
}

// Special files (must be before static middleware)
app.get('/scramjet.sw.js', (req, res) => {
    res.setHeader('Service-Worker-Allowed', '/');
    res.sendFile(path.join(__dirname, 'public', 'scramjet-sw.js'));
});

app.get('/scramjet-index.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'scramjet-index.html'));
});

// Proxy static files
app.use("/scram/", express.static(path.join(__dirname, "node_modules/@mercuryworkshop/scramjet/dist")));
app.use('/baremux/', express.static(path.join(__dirname, 'node_modules/@mercuryworkshop/bare-mux/dist')));
app.use('/epoxy/', express.static(path.join(__dirname, 'node_modules/@mercuryworkshop/epoxy-transport/dist')));
app.use('/libcurl/', express.static(path.join(__dirname, 'node_modules/@mercuryworkshop/libcurl-transport/dist')));

// App static folders
app.use('/games/assets', express.static(path.join(__dirname, 'games', 'assets')));
app.use('/games', express.static(path.join(__dirname, 'games')));
app.use('/apps/assets', express.static(path.join(__dirname, 'apps', 'assets')));
app.use('/apps', express.static(path.join(__dirname, 'apps')));
app.use('/tools/assets', express.static(path.join(__dirname, 'tools', 'assets')));
app.use('/tools', express.static(path.join(__dirname, 'tools')));

// Public folder
app.use(express.static(path.join(__dirname, 'public')));

// API routes
app.get('/api/games', async (req, res) => res.json(await loadFolderData('games')));
app.get('/api/apps', async (req, res) => res.json(await loadFolderData('apps')));
app.get('/api/tools', async (req, res) => res.json(await loadFolderData('tools')));
app.get('/api/*', (req, res) => res.status(404).json({ error: 'Not found' }));

// SPA catch-all
app.get('/*', (req, res) => {
    const urlPath = req.path;
    const segments = urlPath.split('/').filter(Boolean);

    if (path.extname(urlPath)) {
        return res.status(404).send('Not found');
    }

    if (['games', 'apps', 'tools'].includes(segments[0]) && segments.length > 1) {
        const filePath = path.join(__dirname, ...segments, 'index.html');
        if (existsSync(filePath)) {
            return res.sendFile(filePath);
        }
    }

    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const port = process.env.PORT || 3000;
server.listen(port, () => {
    console.log(`GamesHub server listening on http://localhost:${port}`);
});