import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 4171);
const DATA_DIR = path.join(__dirname, 'data');
const STORE_PATH = path.join(DATA_DIR, 'store.json');
const SEED_PATH = path.join(DATA_DIR, 'seed.json');
const PUBLIC_DIR = path.join(__dirname, 'public');

const send = (res, status, body, type = 'application/json') => {
	res.writeHead(status, { 'content-type': type });
	res.end(type === 'application/json' ? JSON.stringify(body, null, 2) : body);
};

async function ensureStore() {
	await mkdir(DATA_DIR, { recursive: true });
	if (!existsSync(STORE_PATH)) {
		const seed = await readFile(SEED_PATH, 'utf8');
		await writeFile(STORE_PATH, seed);
	}
}

async function readStore() {
	await ensureStore();
	return JSON.parse(await readFile(STORE_PATH, 'utf8'));
}

async function writeStore(store) {
	await writeFile(STORE_PATH, JSON.stringify(store, null, 2));
}

async function readBody(req) {
	let raw = '';
	for await (const chunk of req) raw += chunk;
	return raw ? JSON.parse(raw) : {};
}

function validateShift(input) {
	const required = ['person', 'role', 'date', 'start', 'end'];
	const missing = required.filter((key) => !String(input[key] || '').trim());
	if (missing.length) return `Missing fields: ${missing.join(', ')}`;
	if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) return 'Date must be YYYY-MM-DD';
	if (!/^\d{2}:\d{2}$/.test(input.start) || !/^\d{2}:\d{2}$/.test(input.end)) {
		return 'Start and end must be HH:MM';
	}
	if (input.start >= input.end) return 'Shift must end after it starts';
	return null;
}

function buildSummary(shifts) {
	const byDate = shifts.reduce((acc, shift) => {
		acc[shift.date] ??= [];
		acc[shift.date].push(shift);
		return acc;
	}, {});

	return Object.entries(byDate)
		.sort(([a], [b]) => a.localeCompare(b))
		.map(([date, items]) => ({
			date,
			count: items.length,
			roles: [...new Set(items.map((item) => item.role))].sort(),
			warning: items.length < 2 ? 'Needs coverage' : 'Covered'
		}));
}

async function serveStatic(res, pathname) {
	const safePath = pathname === '/' ? '/index.html' : pathname;
	const filePath = path.normalize(path.join(PUBLIC_DIR, safePath));
	if (!filePath.startsWith(PUBLIC_DIR)) return send(res, 403, 'Forbidden', 'text/plain');

	try {
		const file = await readFile(filePath);
		const ext = path.extname(filePath);
		const type = ext === '.css' ? 'text/css' : ext === '.js' ? 'text/javascript' : 'text/html';
		send(res, 200, file, type);
	} catch {
		send(res, 404, 'Not found', 'text/plain');
	}
}

const server = createServer(async (req, res) => {
	try {
		const url = new URL(req.url, `http://${req.headers.host}`);
		const store = await readStore();

		if (req.method === 'GET' && url.pathname === '/api/summary') {
			return send(res, 200, { coverage: buildSummary(store.shifts), pendingRequests: store.requests.filter((request) => request.status === 'pending').length });
		}

		if (req.method === 'GET' && url.pathname === '/api/shifts') return send(res, 200, store.shifts);

		if (req.method === 'POST' && url.pathname === '/api/shifts') {
			const body = await readBody(req);
			const error = validateShift(body);
			if (error) return send(res, 400, { error });
			const shift = { id: `sh_${Date.now()}`, person: body.person.trim(), role: body.role.trim(), date: body.date, start: body.start, end: body.end };
			store.shifts.unshift(shift);
			await writeStore(store);
			return send(res, 201, shift);
		}

		if (req.method === 'GET' && url.pathname === '/api/requests') return send(res, 200, store.requests);

		if (req.method === 'PATCH' && url.pathname.startsWith('/api/requests/')) {
			const id = url.pathname.split('/').pop();
			const body = await readBody(req);
			const request = store.requests.find((item) => item.id === id);
			if (!request) return send(res, 404, { error: 'Request not found' });
			if (!['approved', 'declined'].includes(body.status)) return send(res, 400, { error: 'Invalid status' });
			request.status = body.status;
			await writeStore(store);
			return send(res, 200, request);
		}

		return serveStatic(res, url.pathname);
	} catch (error) {
		send(res, 500, { error: error.message });
	}
});

server.listen(PORT, () => {
	console.log(`RosterForge running at http://localhost:${PORT}`);
});
