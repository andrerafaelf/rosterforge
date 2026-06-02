const $ = (selector) => document.querySelector(selector);
const api = (path, options = {}) =>
	fetch(path, {
		headers: { 'content-type': 'application/json' },
		...options
	}).then(async (response) => {
		const data = await response.json();
		if (!response.ok) throw new Error(data.error || 'Request failed');
		return data;
	});

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
