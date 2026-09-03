const Service = require('node-windows').Service;
const path = require('path');

// Create a new service object
const svc = new Service({
  name:'UniFi Gateway Monitor',
  description: 'Runs the UniFi Gateway Monitoring web dashboard and ping worker on boot.',
  script: path.join(__dirname, 'service-entry.js'),
  env: [{
    name: "NODE_ENV",
    value: "production"
  }]
});

// Listen for the "install" event
svc.on('install', function() {
  console.log('=========================================');
  console.log('Service installed successfully!');
  svc.start();
  console.log('Service is now starting...');
  console.log('It will automatically run when the server boots.');
  console.log('=========================================');
});

// Listen for the "alreadyinstalled" event
svc.on('alreadyinstalled', function() {
  console.log('The service is already installed.');
  console.log('Starting the service just in case it is stopped...');
  svc.start();
});

console.log('Installing Windows Service...');
svc.install();
