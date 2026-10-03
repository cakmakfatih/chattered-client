const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const envFile = path.join(projectRoot, '.env.dev');

if (!fs.existsSync(envFile)) {
  console.error('Missing .env.dev. Copy .env.example to .env.dev and add your Clerk publishable key.');
  process.exit(1);
}

const expoCli = require.resolve('expo/bin/cli', { paths: [projectRoot] });
const childEnv = { ...process.env, EXPO_NO_DOTENV: '1' };

for (const key of Object.keys(childEnv)) {
  if (key.startsWith('EXPO_PUBLIC_')) delete childEnv[key];
}

const expoProcess = spawn(
  process.execPath,
  ['--env-file', envFile, expoCli, ...process.argv.slice(2)],
  { cwd: projectRoot, env: childEnv, stdio: 'inherit' },
);

expoProcess.on('error', () => {
  console.error('Could not start the Expo CLI. Check that dependencies are installed.');
  process.exitCode = 1;
});

expoProcess.on('exit', (code) => {
  process.exitCode = code ?? 1;
});
