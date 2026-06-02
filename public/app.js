const $ = (selector) => document.querySelector(selector);
const isStaticDemo = location.hostname.endsWith('github.io');
const storageKey = 'rosterforge-demo-store';
const seed = {
	shifts: [
		{ id: 'sh_1001', person: 'Marta', role: 'Support', date: '2026-06-01', start: '09:00', end: '17:00' },
		{ id: 'sh_1002', person: 'Tiago', role: 'Backend', date: '2026-06-01', start: '10:00', end: '18:00' },
		{ id: 'sh_1003', person: 'Ines', role: 'Frontend', date: '2026-06-02', start: '09:30', end: '17:30' },
		{ id: 'sh_1004', person: 'Rui', role: 'Support', date: '2026-06-03', start: '08:00', end: '16:00' }
	],
	requests: [
		{ id: 'req_2001', person: 'Marta', date: '2026-06-05', reason: 'Medical appointment', status: 'pending' },
		{ id: 'req_2002', person: 'Rui', date: '2026-06-08', reason: 'Family travel', status: 'pending' }
	]
};

function getStore() {
	const saved = localStorage.getItem(storageKey);
	return saved ? JSON.parse(saved) : structuredClone(seed);
}

function saveStore(store) {
	localStorage.setItem(storageKey, JSON.stringify(store));
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

async function demoApi(path, options = {}) {
	const store = getStore();
	const body = options.body ? JSON.parse(options.body) : {};

	if (path === '/api/summary') {
		return { coverage: buildSummary(store.shifts), pendingRequests: store.requests.filter((request) => request.status === 'pending').length };
	}
	if (path === '/api/shifts') return store.shifts;
	if (path === '/api/requests') return store.requests;
	if (path === '/api/shifts' && options.method === 'POST') {
		const shift = { id: `sh_${Date.now()}`, ...body };
		store.shifts.unshift(shift);
		saveStore(store);
		return shift;
	}
	if (path.startsWith('/api/requests/') && options.method === 'PATCH') {
		const id = path.split('/').pop();
		const request = store.requests.find((item) => item.id === id);
		if (!request) throw new Error('Request not found');
		request.status = body.status;
		saveStore(store);
		return request;
	}
	throw new Error('Route not available in demo mode');
}

const api = (path, options = {}) => {
	if (isStaticDemo) return demoApi(path, options);
	return fetch(path, {
		headers: { 'content-type': 'application/json' },
		...options
	}).then(async (response) => {
		const data = await response.json();
		if (!response.ok) throw new Error(data.error || 'Request failed');
		return data;
	});
};

async function load() {
	const [summary, shifts, requests] = await Promise.all([
		api('/api/summary'),
		api('/api/shifts'),
		api('/api/requests')
	]);
	renderCoverage(summary.coverage);
	renderShifts(shifts);
	renderRequests(requests);
}

function renderCoverage(days) {
	$('#coverage').innerHTML = days
		.map(
			(day) => `
			<article class="day ${day.warning === 'Needs coverage' ? 'warn' : ''}">
				<strong>${new Date(day.date).toLocaleDateString(undefined, { weekday: 'short', day: '2-digit', month: 'short' })}</strong>
				<span>${day.count} people</span>
				<small>${day.roles.join(', ') || 'No roles'}</small>
				<em>${day.warning}</em>
			</article>
		`
		)
		.join('');
}

function renderShifts(shifts) {
	$('#shifts').innerHTML = shifts
		.map(
			(shift) => `
			<article class="row">
				<div>
					<strong>${shift.person}</strong>
					<span>${shift.role}</span>
				</div>
				<time>${shift.date} - ${shift.start}-${shift.end}</time>
			</article>
		`
		)
		.join('');
}

function renderRequests(requests) {
	$('#requests').innerHTML = requests
		.map(
			(request) => `
			<article class="row request">
				<div>
					<strong>${request.person}</strong>
					<span>${request.date} - ${request.reason}</span>
				</div>
				${request.status === 'pending' ? `
					<div class="actions">
						<button data-id="${request.id}" data-status="approved">Approve</button>
						<button data-id="${request.id}" data-status="declined">Decline</button>
					</div>` : `<b>${request.status}</b>`}
			</article>
		`
		)
		.join('');
}

$('#shift-form').addEventListener('submit', async (event) => {
	event.preventDefault();
	const form = event.currentTarget;
	const payload = Object.fromEntries(new FormData(form));
	try {
		await api('/api/shifts', { method: 'POST', body: JSON.stringify(payload) });
		$('#form-status').textContent = 'Shift created.';
		form.reset();
		await load();
	} catch (error) {
		$('#form-status').textContent = error.message;
	}
});

$('#requests').addEventListener('click', async (event) => {
	const button = event.target.closest('button[data-id]');
	if (!button) return;
	await api(`/api/requests/${button.dataset.id}`, {
		method: 'PATCH',
		body: JSON.stringify({ status: button.dataset.status })
	});
	await load();
});

load();