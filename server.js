const { createServer } = require('https');
const { parse } = require('url');
const next = require('next');
const fs = require('fs');
const path = require('path');

const dev = process.argv.includes('--dev');
if (!dev) {
  process.env.NODE_ENV = 'production';
} else {
  process.env.NODE_ENV = 'development';
}
const hostname = '0.0.0.0';
const port = parseInt(process.env.PORT || '50010', 10);
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

const httpsOptions = {
  key: fs.readFileSync('C:\\Users\\Akshay\\.gemini\\antigravity-ide\\scratch\\portal\\ssl\\server.key'),
  cert: fs.readFileSync('C:\\Users\\Akshay\\.gemini\\antigravity-ide\\scratch\\portal\\ssl\\server.crt')
};

app.prepare().then(() => {
  createServer(httpsOptions, (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('internal server error');
    }
  }).listen(port, hostname, (err) => {
    if (err) throw err;
    console.log(`> Ready on https://${hostname}:${port}`);
  });
});
