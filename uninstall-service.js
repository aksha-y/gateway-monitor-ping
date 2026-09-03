const Service = require('node-windows').Service;
const path = require('path');

const svc = new Service({
  name:'UniFi Gateway Monitor',
  script: path.join(__dirname, 'service-entry.js')
});

svc.on('uninstall', function() {
  console.log('Service uninstalled complete.');
});

svc.uninstall();
