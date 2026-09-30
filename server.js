const { createApp } = require('./src/app');
const { PORT } = require('./src/config');

const app = createApp();
app.listen(PORT, () => {
  console.log(`\n  SMA - Smart Moisture Advisor is running`);
  console.log(`  -> http://localhost:${PORT}\n`);
});
