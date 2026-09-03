const { spawn } = require('child_process');

const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';

console.log('Starting UniFi Gateway Monitor...');

const child = spawn(npmCmd, ['run', 'prod:all'], {
    stdio: 'inherit',
    cwd: __dirname,
    shell: true
});

child.on('error', (err) => {
    console.error('Failed to start subprocess.', err);
});

// Handle graceful shutdown
process.on('SIGINT', () => {
    child.kill('SIGINT');
    process.exit();
});
process.on('SIGTERM', () => {
    child.kill('SIGTERM');
    process.exit();
});
