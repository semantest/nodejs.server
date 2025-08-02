console.log('Starting debug server...');
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

try {
  require('ts-node/register');
  require('./src/start-server.ts');
} catch (error) {
  console.error('Failed to start server:', error);
  process.exit(1);
}
EOF < /dev/null
