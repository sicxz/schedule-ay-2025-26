const { spawn } = require('child_process');
const http = require('http');
const net = require('net');
const path = require('path');

function reservePort() {
    return new Promise((resolve, reject) => {
        const server = net.createServer();
        server.once('error', reject);
        server.listen(0, '127.0.0.1', () => {
            const { port } = server.address();
            server.close((error) => error ? reject(error) : resolve(port));
        });
    });
}

function request(port, pathname, method = 'GET') {
    return new Promise((resolve, reject) => {
        const req = http.request({ hostname: '127.0.0.1', port, path: pathname, method }, (res) => {
            let body = '';
            res.setEncoding('utf8');
            res.on('data', (chunk) => { body += chunk; });
            res.on('end', () => resolve({ status: res.statusCode, body }));
        });
        req.once('error', reject);
        req.end();
    });
}

describe('API and static-file authorization', () => {
    let child;
    let port;

    beforeAll(async () => {
        port = await reservePort();
        child = spawn(process.execPath, ['api-server.js'], {
            cwd: path.resolve(__dirname, '..'),
            env: {
                ...process.env,
                HOST: '127.0.0.1',
                PORT: String(port),
                SUPABASE_URL: '',
                SUPABASE_SECRET_KEY: '',
                SUPABASE_SERVICE_ROLE_KEY: ''
            },
            stdio: ['ignore', 'pipe', 'pipe']
        });

        await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('API server did not start in time.')), 5000);
            child.once('error', reject);
            child.stdout.on('data', (chunk) => {
                if (chunk.toString().includes('Server running')) {
                    clearTimeout(timeout);
                    resolve();
                }
            });
            child.stderr.on('data', (chunk) => {
                const message = chunk.toString();
                if (message) process.stderr.write(message);
            });
        });
    });

    afterAll(async () => {
        if (!child || child.exitCode !== null) return;
        child.kill('SIGTERM');
        await new Promise((resolve) => child.once('exit', resolve));
    });

    test('rejects unauthenticated API requests before route handlers run', async () => {
        const response = await request(port, '/api/export-to-sheets', 'POST');
        expect(response.status).toBe(401);
        expect(JSON.parse(response.body)).toMatchObject({ success: false });
    });

    test('does not serve dotfiles from the repository root', async () => {
        const response = await request(port, '/.env.example');
        expect(response.status).toBe(403);
        expect(response.body).not.toContain('SUPABASE_SECRET_KEY');
    });

    test('continues to serve public login assets', async () => {
        const response = await request(port, '/login.html');
        expect(response.status).toBe(200);
        expect(response.body).toContain('Access is by invitation');
    });
});
