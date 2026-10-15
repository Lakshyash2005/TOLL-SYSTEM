import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { spawn } from 'child_process'
import net from 'net'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function djangoAutoStartPlugin() {
  let djangoProcess = null;
  return {
    name: 'django-auto-start',
    configureServer(server) {
      const socket = new net.Socket();
      socket.setTimeout(1000);

      const startDjango = () => {
        const venvPython = path.resolve(__dirname, '../.venv/Scripts/python.exe');
        const managePy = path.resolve(__dirname, '../TollSystem/manage.py');
        console.log('\n[django] Port 8000 not active. Auto-starting Django backend...');
        djangoProcess = spawn(venvPython, [managePy, 'runserver', '8000'], {
          stdio: 'inherit',
          shell: true,
        });
        djangoProcess.on('error', (err) => {
          console.error('[django] Failed to start Django:', err.message);
        });
      };

      socket.on('connect', () => {
        socket.destroy();
        console.log('\n[django] Backend already active on port 8000.');
      });

      socket.on('error', () => {
        socket.destroy();
        startDjango();
      });

      socket.on('timeout', () => {
        socket.destroy();
        startDjango();
      });

      socket.connect(8000, '127.0.0.1');

      const cleanup = () => {
        if (djangoProcess) {
          djangoProcess.kill();
        }
      };
      process.on('exit', cleanup);
      process.on('SIGINT', cleanup);
      process.on('SIGTERM', cleanup);
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), djangoAutoStartPlugin()],
})

