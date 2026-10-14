const root = document.getElementById('app');
const modalRoot = document.getElementById('modal-root');
const toastEl = document.getElementById('toast');
const state = { me: null, setupRequired: false, events: [], current: null, socket: null, socketGeneration: 0, socketRetry: null, socketBackoff: 1000, refreshDebounce: null, refreshInFlight: null, refreshQueued: false, refreshQueuedRender: false, authMode: 'login', passwordResetToken: new URLSearchParams(location.hash.slice(1)).get('reset_token') || '', timer: null, refresh: null };
if (state.passwordResetToken) history.replaceState({}, '', location.pathname);

function esc(value = '') {
  return String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}

function readCookie(name) {
  const entry = document.cookie.split('; ').find((item) => item.startsWith(`${name}=`));
  return entry ? decodeURIComponent(entry.slice(name.length + 1)) : '';
}

async function api(path, options = {}) {
  const headers = new Headers(options.headers || {});
  if (options.body && !(options.body instanceof FormData) && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes((options.method || 'GET').toUpperCase())) {
    const csrf = readCookie('labcentral_csrf');
    if (csrf) headers.set('X-CSRF-Token', csrf);
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs || 30000);
  try {
    const { timeoutMs: _timeoutMs, ...fetchOptions } = options;
    const response = await fetch(path, { ...fetchOptions, headers, credentials: 'same-origin', signal: controller.signal });
    const contentType = response.headers.get('content-type') || '';
    const payload = contentType.includes('application/json') ? await response.json() : await response.text();
    if (!response.ok) {
      let message = typeof payload === 'string' ? payload : payload.detail || 'No se pudo completar la solicitud';
      if (Array.isArray(message)) message = message.map((item) => item.msg).join('. ');
      throw new Error(message);
    }
    return payload;
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('La solicitud tardó demasiado. Comprueba la conexión antes de volver a enviarla.');
    if (error instanceof TypeError) throw new Error('No hay respuesta del servidor. Revisa la conexión e inténtalo de nuevo.');
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function toast(message, isError = false) {
  toastEl.textContent = message;
  toastEl.classList.toggle('error', isError);
  toastEl.classList.add('show');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toastEl.classList.remove('show'), 3200);
}

function setLoading(message = 'Cargando…') {
  root.innerHTML = `<div class="topbar"><div class="brand"><span class="brand-mark">L2</span> LabCentral 2</div></div><div class="loading"><div class="spinner"></div>${esc(message)}</div>`;
}

function shell(content) {
  const initials = (state.me?.display_name || state.me?.username || 'U').trim().slice(0, 1).toUpperCase();
  return `<header class="topbar">
    <div class="brand"><span class="brand-mark">L2</span> LabCentral 2</div>
    ${state.me ? `<div class="topbar-right"><div class="user-chip"><span class="avatar">${esc(initials)}</span><span class="user-name">${esc(state.me.display_name)}</span>${state.me.is_admin ? '<span class="pill admin-label">Organización</span>' : ''}</div><button class="button button-quiet button-small" id="account-email">${state.me.email ? 'Correo' : 'Agregar correo'}</button><button class="icon-button" id="logout" title="Cerrar sesión" aria-label="Cerrar sesión">↗</button></div>` : ''}
  </header>${content}`;
}

function bindAccountEmail() {
  document.getElementById('account-email')?.addEventListener('click', showEmailModal);
}

function renderAuth(mode = 'login') {
  state.authMode = mode;
  const setup = state.setupRequired;
  const signup = mode === 'register' && !setup;
  const recovery = mode === 'forgot';
  const resetting = mode === 'reset';
  const title = setup ? 'Configura LabCentral 2' : signup ? 'Crea tu cuenta' : recovery ? 'Recupera tu contraseña' : resetting ? 'Elige una contraseña nueva' : 'Vuelve a LabCentral 2';
  const subtitle = setup ? 'Crea la cuenta organizadora inicial. Después podrás crear eventos e invitar participantes.' : signup ? 'Usa el código de invitación para crear tu cuenta y entrar al evento.' : recovery ? 'Te enviaremos un enlace de un solo uso si la cuenta tiene correo registrado.' : resetting ? 'El enlace vence a los 30 minutos y solo puede utilizarse una vez.' : 'Inicia sesión para ver tus eventos y seguir la clasificación.';
  root.innerHTML = shell(`<main class="auth-wrap"><form id="auth-form" class="auth-card">
    <div class="eyebrow">Plataforma local de desafíos</div><h1>${esc(title)}</h1><p>${esc(subtitle)}</p>
    ${setup ? '<div class="field"><label for="setup_key">Clave de instalación</label><input class="input" id="setup_key" name="setup_key" type="password" minlength="24" maxlength="200" autocomplete="off" required placeholder="La clave definida en el archivo .env"></div>' : ''}
    ${setup || signup ? `<div class="field"><label for="display_name">Nombre visible</label><input class="input" id="display_name" name="display_name" maxlength="80" autocomplete="name" required placeholder="Cómo aparecerás en el marcador"></div><div class="field"><label for="email">Correo electrónico</label><input class="input" id="email" name="email" type="email" maxlength="254" autocomplete="email" required placeholder="tu@correo.cl"></div>` : ''}
    ${signup ? '<div class="field"><label for="event_code">Código del evento</label><input class="input input-code" id="event_code" name="event_code" minlength="5" maxlength="12" autocomplete="off" required placeholder="CÓDIGO DE INVITACIÓN"></div>' : ''}
    ${!signup && !recovery && !resetting ? '<div class="field"><label for="username">Usuario</label><input class="input" id="username" name="username" minlength="3" maxlength="40" autocomplete="username" required placeholder="por ejemplo, ana.rios"></div>' : ''}
    ${recovery ? '<div class="field"><label for="email">Correo electrónico</label><input class="input" id="email" name="email" type="email" maxlength="254" autocomplete="email" required placeholder="tu@correo.cl"></div>' : ''}
    ${resetting || setup || signup || (!recovery && !resetting && !setup && !signup) ? `<div class="field"><label for="password">${resetting ? 'Nueva contraseña' : 'Contraseña'}</label><input class="input" id="password" name="password" type="password" minlength="${resetting || setup || signup ? '12' : '1'}" maxlength="200" autocomplete="${resetting || setup || signup ? 'new-password' : 'current-password'}" required placeholder="${resetting || setup || signup ? 'Al menos 12 caracteres' : 'Tu contraseña'}"></div>` : ''}
    <button class="button button-primary auth-submit" type="submit">${setup ? 'Crear organización' : signup ? 'Crear cuenta' : recovery ? 'Enviar enlace' : resetting ? 'Guardar contraseña' : 'Iniciar sesión'} <span>→</span></button>
    ${setup ? '<div class="footer-note">El registro público no concede permisos de organización.</div>' : recovery || resetting ? `<p class="auth-switch"><button class="text-button" id="auth-toggle" type="button">Volver a iniciar sesión</button></p>` : `<p class="auth-switch">${signup ? '¿Ya tienes una cuenta?' : '¿Primera vez aquí?'} <button class="text-button" id="auth-toggle" type="button">${signup ? 'Inicia sesión' : 'Regístrate'}</button>${!signup ? '<br><button class="text-button" id="forgot-password" type="button">¿Olvidaste tu contraseña?</button>' : ''}</p>`}
  </form></main>`);
  document.getElementById('auth-form').addEventListener('submit', onAuthSubmit);
  document.getElementById('auth-toggle')?.addEventListener('click', () => renderAuth(recovery || resetting || signup ? 'login' : 'register'));
  document.getElementById('forgot-password')?.addEventListener('click', () => renderAuth('forgot'));
}

async function onAuthSubmit(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const payload = Object.fromEntries(form.entries());
  const submittedMode = state.authMode;
  const button = event.currentTarget.querySelector('button[type="submit"]');
  button.disabled = true;
  try {
    if (submittedMode === 'forgot') {
      const result = await api('/api/password/forgot', { method: 'POST', body: JSON.stringify({ email: payload.email }) });
      toast(result.message);
      renderAuth('login');
      return;
    }
    if (submittedMode === 'reset') {
      const result = await api('/api/password/reset', { method: 'POST', body: JSON.stringify({ token: state.passwordResetToken, password: payload.password }) });
      state.passwordResetToken = '';
      history.replaceState({}, '', location.pathname);
      toast(result.message);
      renderAuth('login');
      return;
    }
    const endpoint = state.setupRequired ? '/api/setup' : state.authMode === 'register' ? '/api/register' : '/api/login';
    state.me = await api(endpoint, { method: 'POST', body: JSON.stringify(payload) });
    if (submittedMode === 'setup') state.setupRequired = false;
    await loadEvents();
    if (submittedMode === 'register' && state.me.event_id) openEvent(state.me.event_id);
    else renderHome();
  } catch (error) {
    toast(error.message, true);
    button.disabled = false;
  }
}

function dateLabel(value) {
  if (!value) return 'Sin definir';
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? 'Sin definir' : new Intl.DateTimeFormat('es', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function eventCard(event) {
  const statusLabel = { live: 'En curso', scheduled: 'Programado', ended: 'Finalizado', draft: 'Borrador' }[event.status] || event.status;
  return `<article class="event-card">
    <div class="event-card-top"><span class="pill ${esc(event.status)}">${esc(statusLabel)}</span><span class="pill">${event.mode === 'teams' ? 'Equipos' : 'Individual'}</span></div>
    <h3>${esc(event.title)}</h3><p>${esc(event.description || 'Evento CTF de la red local.')}</p>
    <div class="event-card-bottom"><span class="event-meta">${event.status === 'ended' ? 'Finalizó' : event.status === 'live' ? 'Termina' : 'Comienza'} · ${dateLabel(event.status === 'live' ? event.ends_at : event.starts_at)}</span>
    <button class="button button-dark button-small" data-open="${event.id}">${event.status === 'ended' ? 'Ver resultados' : event.joined ? 'Abrir evento' : 'Administrar'} <span>→</span></button></div>
    ${event.join_code ? `<div class="challenge-foot"><span>Código de acceso</span><span class="input-code">${esc(event.join_code)}</span></div>` : ''}
  </article>`;
}

function renderHome() {
  disconnectLive();
  const eventCards = state.events.length ? `<div class="grid event-list">${state.events.map(eventCard).join('')}</div>` : '<div class="empty-state"><strong>Aún no hay eventos</strong>Crea tu primer CTF o únete con el código que te compartió la organización.</div>';
  root.innerHTML = shell(`<main class="page">
    <div class="page-head"><div><div class="eyebrow">Panel de control</div><h1 class="page-title">Tu espacio de juego</h1><p class="page-subtitle">${state.me.is_admin ? 'Organiza eventos, publica retos y sigue el progreso en directo.' : 'Abre un evento activo o ingresa el código de invitación.'}</p></div>${state.me.is_admin ? '<button class="button button-primary" id="new-event">＋ Crear evento</button>' : ''}</div>
    ${state.me.is_admin ? '' : `<section class="join-panel"><div><h2>¿Tienes un código?</h2><p>Únete a un evento con el código de acceso de la organización.</p></div><form id="join-event" class="join-form"><input class="input input-code" name="code" required minlength="5" maxlength="12" placeholder="CÓDIGO" aria-label="Código de evento"><button class="button button-primary">Unirme <span>→</span></button></form></section>`}
    <div class="section-heading"><h2>${state.me.is_admin ? 'Eventos' : 'Mis eventos'}</h2><span>${state.events.length} ${state.events.length === 1 ? 'evento' : 'eventos'}</span></div>
    ${eventCards}
  </main>`);
  document.getElementById('logout')?.addEventListener('click', onLogout);
  bindAccountEmail();
  document.getElementById('new-event')?.addEventListener('click', () => showEventModal());
  document.getElementById('join-event')?.addEventListener('submit', onJoinEvent);
  root.querySelectorAll('[data-open]').forEach((button) => button.addEventListener('click', () => openEvent(Number(button.dataset.open))));
}

async function loadEvents() {
  state.events = await api('/api/events');
}

async function onJoinEvent(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector('button');
  if (button) button.disabled = true;
  const code = new FormData(form).get('code');
  try {
    const result = await api('/api/events/join', { method: 'POST', body: JSON.stringify({ code }) });
    toast(result.already_joined ? 'Ya estabas inscrito en ese evento.' : 'Te uniste al evento.');
    await loadEvents();
    openEvent(result.event_id);
  } catch (error) { toast(error.message, true); }
  finally { if (button?.isConnected) button.disabled = false; }
}

async function onLogout() {
  disconnectLive();
  try { await api('/api/logout', { method: 'POST' }); } catch (_) {}
  state.me = null;
  state.events = [];
  renderAuth('login');
}

async function openEvent(id) {
  disconnectLive();
  setLoading('Abriendo evento…');
  try {
    state.current = await api(`/api/events/${id}/dashboard`);
    renderEvent();
    connectLive(id);
  } catch (error) {
    toast(error.message, true);
    await loadEvents();
    renderHome();
  }
}

function countdownText(event) {
  const now = Date.now();
  if (event.status === 'ended') return 'Evento finalizado';
  if (event.status === 'draft') return 'A la espera de que comience';
  const target = event.status === 'scheduled' ? event.starts_at : event.ends_at;
  if (!target) return event.status === 'live' ? 'Sin límite de tiempo' : 'A la espera de inicio';
  const seconds = Math.max(0, Math.floor((new Date(target).getTime() - now) / 1000));
  if (seconds <= 0 && event.status === 'live') return 'Tiempo cumplido';
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return `${event.status === 'scheduled' ? 'Comienza en ' : 'Termina en '}${days ? `${days}d ` : ''}${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function scoreboardMarkup(rows) {
  if (!rows.length) return '<div class="score-empty">Aún no hay participantes en el marcador.</div>';
  return `<div class="score-list">${rows.map((row) => `<div class="score-row"><div class="rank ${row.rank === 1 ? 'first' : ''}">${String(row.rank).padStart(2, '0')}</div><div><div class="score-name">${esc(row.name)}</div><div class="score-solves">${row.solves} ${row.solves === 1 ? 'reto' : 'retos'} resueltos</div></div><div class="score-points">${row.score.toLocaleString('es')} <span class="points-suffix">pts</span></div></div>`).join('')}</div>`;
}

function challengeMarkup(challenge, solved, event, isAdmin) {
  const canSubmit = event.status === 'live' && (event.mode === 'solo' || state.current.team);
  const canManage = isAdmin && event.status !== 'ended';
  const pointsCaption = challenge.scoring_mode === 'dynamic' ? 'PRÓXIMO VALOR' : 'PUNTOS';
  const assets = challenge.assets?.length ? `<div class="asset-list">${challenge.assets.map((asset) => `<div class="asset-row"><a href="${esc(asset.download_url)}" download>${esc(asset.name)} <small>${(asset.size_bytes / 1024).toFixed(0)} KiB</small></a>${canManage ? `<button class="text-button" data-delete-asset="${asset.id}" title="Eliminar archivo">Quitar</button>` : ''}</div>`).join('')}</div>` : '';
  return `<article class="challenge-card">
    <div class="challenge-head"><div><div class="challenge-category">${esc(challenge.category)}${challenge.scoring_mode === 'dynamic' ? ' · PUNTAJE DINÁMICO' : ''}</div><h3 class="challenge-title">${esc(challenge.title)}</h3></div><div class="points-badge"><strong>${challenge.next_points.toLocaleString('es')}</strong><small>${pointsCaption}</small></div></div>
    <p class="challenge-description">${esc(challenge.description)}</p>
    ${assets}
    ${solved ? `<div class="solved-label">✓ Resuelto <span class="awarded-score">· +${solved.points} pts</span></div>` : `<form class="submit-form" data-submit="${challenge.id}"><input class="input" name="flag" autocomplete="off" spellcheck="false" placeholder="Ingresa la flag" aria-label="Flag para ${esc(challenge.title)}" ${canSubmit ? '' : 'disabled'} required><button class="button button-dark button-small" ${canSubmit ? '' : 'disabled'}>Enviar <span>→</span></button></form>`}
    <div class="challenge-foot"><span>${challenge.solves} ${challenge.solves === 1 ? 'solución' : 'soluciones'}</span>${canManage ? `<span class="admin-tools"><button class="button button-quiet button-small" data-upload-asset="${challenge.id}">＋ Archivo</button><button class="button button-quiet button-small" data-edit-challenge="${challenge.id}">Editar</button><button class="button button-danger button-small" data-delete-challenge="${challenge.id}">Quitar</button></span>` : ''}</div>
  </article>`;
}

function teamMarkup() {
  const team = state.current.team;
  if (team) return `<section class="team-banner"><div><strong>✳ ${esc(team.name)}</strong><p>${team.size} ${team.size === 1 ? 'integrante' : 'integrantes'} · Código del equipo <span class="input-code">${esc(team.join_code)}</span></p></div><span class="pill live">Equipo activo</span></section>`;
  return `<section class="team-banner"><div><strong>Forma tu equipo</strong><p>En modo equipo debes crear uno o unirte con su código para enviar flags.</p></div><div class="team-actions"><button class="button button-dark button-small" id="create-team">＋ Crear equipo</button><button class="button button-quiet button-small" id="join-team">Tengo código</button></div></section>`;
}

function renderEvent() {
  const data = state.current;
  const event = data.event;
  const isAdmin = data.is_admin;
  const solved = new Map(data.solves.map((row) => [row.challenge_id, row]));
  const challenges = data.challenges.length ? `<div class="challenge-list">${data.challenges.map((challenge) => challengeMarkup(challenge, solved.get(challenge.id), event, isAdmin)).join('')}</div>` : `<div class="empty-state"><strong>No hay retos publicados</strong>${isAdmin ? 'Agrega el primer reto para empezar.' : 'La organización todavía no ha publicado retos.'}</div>`;
  const statusName = { live: 'En curso', scheduled: 'Programado', ended: 'Finalizado', draft: 'Borrador' }[event.status] || event.status;
  const actions = isAdmin ? `${event.status === 'draft' ? '<button class="button button-primary button-small" id="start-event">▶ Iniciar</button>' : ''}${event.status === 'live' || event.status === 'scheduled' ? '<button class="button button-quiet button-small" id="end-event">Finalizar</button>' : ''}${event.status !== 'ended' ? '<button class="button button-quiet button-small" id="edit-event">Editar evento</button><button class="button button-quiet button-small" id="add-challenge">＋ Reto</button><button class="button button-quiet button-small" id="checkpoint">Guardar checkpoint</button><button class="button button-quiet button-small" id="checkpoints-list">Historial</button>' : ''}<button class="button button-quiet button-small" id="integrity-review">Integridad</button><a class="button button-quiet button-small" href="/api/events/${event.id}/export.csv">Exportar CSV</a>` : '';
  root.innerHTML = shell(`<main class="page">
    <div class="page-head event-nav-head"><button class="button button-quiet button-small" id="back-home">← Eventos</button><span class="eyebrow">LabCentral 2 / evento ${event.id}</span></div>
    <section class="event-hero"><div class="hero-top"><div><span class="pill ${esc(event.status)}">${esc(statusName)}</span><h1 class="hero-title">${esc(event.title)}</h1><p class="hero-description">${esc(event.description || 'Desafíos de ciberseguridad para resolver en equipo.')}</p></div><div class="hero-actions">${actions}</div></div>
      <div class="hero-bottom"><span class="hero-stat">◷ <strong id="timer">${esc(countdownText(event))}</strong></span><span class="hero-stat">♧ <strong>${data.participant_count}</strong> participantes</span><span class="hero-stat">⌘ <strong>${event.mode === 'teams' ? 'Por equipos' : 'Individual'}</strong></span>${isAdmin ? `<span class="hero-stat">Código <strong class="input-code">${esc(event.join_code || '')}</strong></span>` : ''}</div>
    </section>
    ${isAdmin ? '<div id="checkpoints-area"></div><div id="integrity-area"></div>' : ''}
    ${event.mode === 'teams' && data.participant ? teamMarkup() : ''}
    <div class="event-layout"><section><div class="section-heading"><h2>Retos</h2><span>${data.challenges.length} disponibles</span></div>${challenges}</section>
      <aside class="panel score-panel"><div class="score-header"><div><h2>Clasificación</h2><p>El marcador se actualiza en vivo.</p></div><span class="live-indicator">EN VIVO</span></div><div id="scoreboard">${scoreboardMarkup(data.scoreboard)}</div></aside>
    </div>
  </main>`);
  document.getElementById('logout')?.addEventListener('click', onLogout);
  bindAccountEmail();
  document.getElementById('back-home')?.addEventListener('click', async () => { disconnectLive(); await loadEvents(); renderHome(); });
  document.getElementById('start-event')?.addEventListener('click', () => changeEventStatus('live'));
  document.getElementById('end-event')?.addEventListener('click', () => changeEventStatus('ended'));
  document.getElementById('edit-event')?.addEventListener('click', () => showEventModal(event));
  document.getElementById('add-challenge')?.addEventListener('click', () => showChallengeModal());
  document.getElementById('checkpoint')?.addEventListener('click', createCheckpoint);
  document.getElementById('checkpoints-list')?.addEventListener('click', toggleCheckpoints);
  document.getElementById('integrity-review')?.addEventListener('click', toggleIntegrity);
  document.getElementById('create-team')?.addEventListener('click', createTeam);
  document.getElementById('join-team')?.addEventListener('click', joinTeam);
  root.querySelectorAll('[data-submit]').forEach((form) => form.addEventListener('submit', (event) => submitFlag(event, Number(form.dataset.submit))));
  root.querySelectorAll('[data-edit-challenge]').forEach((button) => button.addEventListener('click', () => showChallengeModal(data.challenges.find((item) => item.id === Number(button.dataset.editChallenge)))));
  root.querySelectorAll('[data-delete-challenge]').forEach((button) => button.addEventListener('click', () => removeChallenge(Number(button.dataset.deleteChallenge))));
  root.querySelectorAll('[data-upload-asset]').forEach((button) => button.addEventListener('click', () => chooseChallengeAsset(Number(button.dataset.uploadAsset))));
  root.querySelectorAll('[data-delete-asset]').forEach((button) => button.addEventListener('click', () => removeChallengeAsset(Number(button.dataset.deleteAsset))));
  clearInterval(state.timer);
  state.timer = setInterval(() => { const target = document.getElementById('timer'); if (target) target.textContent = countdownText(event); }, 1000);
  clearInterval(state.refresh);
  state.refresh = setInterval(async () => {
    if (state.current?.event.id === event.id) await refreshDashboard(false);
  }, 30000);
}

async function refreshDashboard(shouldRender = true) {
  if (!state.current) return;
  if (state.refreshInFlight) {
    state.refreshQueued = true;
    state.refreshQueuedRender ||= shouldRender;
    return state.refreshInFlight;
  }
  const eventId = state.current.event.id;
  const operation = (async () => {
    try {
      const dashboard = await api(`/api/events/${eventId}/dashboard`);
      if (state.current?.event.id !== eventId) return;
      state.current = dashboard;
      if (shouldRender) renderEvent();
      else {
        const scoreboard = document.getElementById('scoreboard');
        if (scoreboard) scoreboard.innerHTML = scoreboardMarkup(state.current.scoreboard);
        const timer = document.getElementById('timer');
        if (timer) timer.textContent = countdownText(state.current.event);
      }
    } catch (error) {
      if (shouldRender) toast(error.message, true);
    }
  })();
  state.refreshInFlight = operation;
  try { await operation; }
  finally {
    if (state.refreshInFlight === operation) state.refreshInFlight = null;
    if (state.refreshQueued) {
      const render = state.refreshQueuedRender;
      state.refreshQueued = false;
      state.refreshQueuedRender = false;
      scheduleDashboardRefresh(render, 150);
    }
  }
}

function scheduleDashboardRefresh(shouldRender = true, delay = 180) {
  clearTimeout(state.refreshDebounce);
  state.refreshDebounce = setTimeout(() => {
    state.refreshDebounce = null;
    refreshDashboard(shouldRender);
  }, delay);
}

function connectLive(eventId) {
  clearTimeout(state.socketRetry);
  const generation = ++state.socketGeneration;
  const scheme = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const connect = () => {
    if (generation !== state.socketGeneration || state.current?.event.id !== eventId) return;
    const socket = new WebSocket(`${scheme}//${location.host}/ws/events/${eventId}`);
    state.socket = socket;
    socket.addEventListener('open', () => { if (generation === state.socketGeneration) { state.socketBackoff = 1000; scheduleDashboardRefresh(false); } });
    socket.addEventListener('message', () => { if (state.current?.event.id === eventId) scheduleDashboardRefresh(true); });
    socket.addEventListener('close', (event) => {
      if (generation === state.socketGeneration && state.current?.event.id === eventId) {
        if (event.code === 4401) {
          state.me = null;
          disconnectLive();
          renderAuth('login');
          toast('Tu sesión venció. Inicia sesión de nuevo.', true);
          return;
        }
        const delay = state.socketBackoff + Math.floor(Math.random() * 500);
        state.socketBackoff = Math.min(state.socketBackoff * 2, 30000);
        state.socketRetry = setTimeout(connect, delay);
      }
    }, { once: true });
  };
  connect();
}

function disconnectLive() {
  state.socketGeneration += 1;
  clearTimeout(state.socketRetry);
  state.socketRetry = null;
  clearInterval(state.timer);
  clearInterval(state.refresh);
  clearTimeout(state.refreshDebounce);
  state.refreshDebounce = null;
  state.refreshQueued = false;
  state.refreshQueuedRender = false;
  if (state.socket) { state.socket.close(); state.socket = null; }
  state.current = null;
}

async function changeEventStatus(status) {
  const label = status === 'live' ? 'iniciar' : 'finalizar';
  if (status === 'ended' && !window.confirm('¿Finalizar este evento? Dejará de aceptar respuestas.')) return;
  try {
    await api(`/api/events/${state.current.event.id}/status`, { method: 'POST', body: JSON.stringify({ status }) });
    toast(`Evento ${status === 'live' ? 'iniciado' : 'finalizado'}.`);
    await refreshDashboard();
  } catch (error) { toast(error.message || `No se pudo ${label} el evento.`, true); }
}

function dateInput(value) {
  if (!value) return '';
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function modal(title, body, onReady) {
  modalRoot.innerHTML = `<div class="modal-backdrop" id="modal-backdrop"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div class="modal-head"><h2 id="modal-title">${esc(title)}</h2><button type="button" class="icon-button" id="modal-close" aria-label="Cerrar">×</button></div>${body}</section></div>`;
  const backdrop = document.getElementById('modal-backdrop');
  document.getElementById('modal-close').addEventListener('click', closeModal);
  backdrop.addEventListener('click', (event) => { if (event.target === backdrop) closeModal(); });
  onReady?.();
}

function closeModal() { modalRoot.innerHTML = ''; }

function showEmailModal() {
  modal('Correo de recuperación', `<form id="email-form">
    <p class="field-hint">Usaremos este correo solo para enviar enlaces seguros para recuperar tu cuenta.</p>
    <div class="field"><label for="account-email-value">Correo electrónico</label><input class="input" id="account-email-value" name="email" type="email" maxlength="254" required value="${esc(state.me?.email || '')}" placeholder="tu@correo.cl"></div>
    <div class="field"><label for="account-current-password">Contraseña actual</label><input class="input" id="account-current-password" name="current_password" type="password" autocomplete="current-password" required></div>
    <div class="modal-actions"><button type="button" class="button button-quiet" id="cancel-modal">Cancelar</button><button class="button button-primary">Guardar correo</button></div>
  </form>`, () => {
    document.getElementById('cancel-modal').addEventListener('click', closeModal);
    document.getElementById('email-form').addEventListener('submit', async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const button = form.querySelector('button[type="submit"]');
      button.disabled = true;
      const data = new FormData(form);
      try {
        const result = await api('/api/me/email', { method: 'PATCH', body: JSON.stringify({ email: data.get('email'), current_password: data.get('current_password') }) });
        state.me.email = result.email;
        closeModal();
        toast('Correo de recuperación guardado.');
        if (state.current) renderEvent(); else renderHome();
      } catch (error) { toast(error.message, true); button.disabled = false; }
    });
  });
}

function showEventModal(event = null) {
  const editing = Boolean(event);
  modal(editing ? 'Editar evento' : 'Crear evento', `<form id="event-form">
    <div class="field"><label for="event-title">Nombre del evento</label><input class="input" id="event-title" name="title" required minlength="2" maxlength="120" value="${esc(event?.title || '')}" placeholder="CTF de primavera"></div>
    <div class="field"><label for="event-description">Descripción</label><textarea class="input" id="event-description" name="description" maxlength="2000" rows="3" placeholder="Contexto e instrucciones breves">${esc(event?.description || '')}</textarea></div>
    ${editing ? '' : `<div class="field"><label for="event-mode">Modo de juego</label><select class="input" id="event-mode" name="mode"><option value="solo">Individual</option><option value="teams">Por equipos</option></select></div>`}
    <div class="form-row"><div class="field"><label for="starts-at">Inicio (opcional)</label><input class="input" id="starts-at" name="starts_at" type="datetime-local" value="${dateInput(event?.starts_at)}"></div><div class="field"><label for="ends-at">Término (opcional)</label><input class="input" id="ends-at" name="ends_at" type="datetime-local" value="${dateInput(event?.ends_at)}"></div></div>
    <p class="field-hint">El evento empieza al pulsar “Iniciar”. Si configuras una hora de inicio futura, se abrirá a esa hora.</p>
    <div class="modal-actions"><button type="button" class="button button-quiet" id="cancel-modal">Cancelar</button><button class="button button-primary">${editing ? 'Guardar cambios' : 'Crear evento'}</button></div>
  </form>`, () => {
    document.getElementById('cancel-modal').addEventListener('click', closeModal);
    document.getElementById('event-form').addEventListener('submit', async (submitEvent) => {
      submitEvent.preventDefault();
      const form = submitEvent.currentTarget;
      const button = form.querySelector('.modal-actions .button-primary');
      if (button) button.disabled = true;
      const data = new FormData(form);
      const toIso = (name) => data.get(name) ? new Date(data.get(name)).toISOString() : null;
      const payload = { title: data.get('title'), description: data.get('description'), starts_at: toIso('starts_at'), ends_at: toIso('ends_at') };
      if (!editing) payload.mode = data.get('mode');
      try {
        if (editing) {
          await api(`/api/events/${event.id}`, { method: 'PATCH', body: JSON.stringify(payload) });
          toast('Evento actualizado.');
          closeModal();
          await refreshDashboard();
        } else {
          const created = await api('/api/events', { method: 'POST', body: JSON.stringify(payload) });
          toast(`Evento creado. Código: ${created.join_code}`);
          closeModal();
          await loadEvents();
          openEvent(created.id);
        }
      } catch (error) { toast(error.message, true); }
      finally { if (button?.isConnected) button.disabled = false; }
    });
  });
}

function showChallengeModal(challenge = null) {
  const editing = Boolean(challenge);
  modal(editing ? 'Editar reto' : 'Nuevo reto', `<form id="challenge-form">
    <div class="form-row"><div class="field"><label for="challenge-title">Nombre</label><input class="input" id="challenge-title" name="title" required minlength="2" maxlength="120" value="${esc(challenge?.title || '')}"></div><div class="field"><label for="challenge-category">Categoría</label><input class="input" id="challenge-category" name="category" required maxlength="40" value="${esc(challenge?.category || 'General')}"></div></div>
    <div class="field"><label for="challenge-description">Descripción e instrucciones</label><textarea class="input" id="challenge-description" name="description" required maxlength="5000" rows="5">${esc(challenge?.description || '')}</textarea></div>
    <div class="field"><label for="challenge-flag">Flag${editing ? ' (deja en blanco para conservarla)' : ''}</label><input class="input" id="challenge-flag" name="flag" ${editing ? '' : 'required'} minlength="1" maxlength="200" autocomplete="off" spellcheck="false" placeholder="flag{...}"></div>
    <div class="form-row"><div class="field"><label for="scoring-mode">Puntaje</label><select class="input" id="scoring-mode" name="scoring_mode"><option value="fixed" ${challenge?.scoring_mode === 'fixed' ? 'selected' : ''}>Fijo</option><option value="dynamic" ${challenge?.scoring_mode === 'dynamic' ? 'selected' : ''}>Dinámico: baja con cada solución</option></select></div><div class="field"><label for="points">Puntos iniciales</label><input class="input" id="points" name="points" type="number" min="1" max="100000" value="${challenge?.points ?? 100}" required></div></div>
    <div class="form-row"><div class="field"><label for="minimum-points">Puntaje mínimo</label><input class="input" id="minimum-points" name="minimum_points" type="number" min="1" max="100000" value="${challenge?.minimum_points ?? 50}" required></div><div class="field"><label for="decay">Baja por solución</label><input class="input" id="decay" name="decay_per_solve" type="number" min="0" max="100000" value="${challenge?.decay_per_solve ?? 10}" required></div></div>
    <div class="modal-actions"><button type="button" class="button button-quiet" id="cancel-modal">Cancelar</button><button class="button button-primary">${editing ? 'Guardar reto' : 'Publicar reto'}</button></div>
  </form>`, () => {
    document.getElementById('cancel-modal').addEventListener('click', closeModal);
    document.getElementById('challenge-form').addEventListener('submit', async (submitEvent) => {
      submitEvent.preventDefault();
      const form = submitEvent.currentTarget;
      const button = form.querySelector('.modal-actions .button-primary');
      if (button) button.disabled = true;
      const data = new FormData(form);
      const payload = { title: data.get('title'), category: data.get('category'), description: data.get('description'), scoring_mode: data.get('scoring_mode'), points: Number(data.get('points')), minimum_points: Number(data.get('minimum_points')), decay_per_solve: Number(data.get('decay_per_solve')) };
      if (data.get('flag')) payload.flag = data.get('flag');
      if (!editing) payload.flag = data.get('flag');
      try {
        const eventId = state.current.event.id;
        await api(editing ? `/api/events/${eventId}/challenges/${challenge.id}` : `/api/events/${eventId}/challenges`, { method: editing ? 'PATCH' : 'POST', body: JSON.stringify(payload) });
        closeModal();
        toast(editing ? 'Reto actualizado.' : 'Reto publicado.');
        await refreshDashboard();
      } catch (error) { toast(error.message, true); }
      finally { if (button?.isConnected) button.disabled = false; }
    });
  });
}

async function submitFlag(event, challengeId) {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector('button');
  button.disabled = true;
  const flag = new FormData(form).get('flag');
  try {
    const result = await api(`/api/events/${state.current.event.id}/submit`, { method: 'POST', body: JSON.stringify({ challenge_id: challengeId, flag }) });
    toast(result.message, !result.correct);
    if (result.correct) await refreshDashboard();
  } catch (error) { toast(error.message, true); }
  finally { if (button.isConnected) button.disabled = false; }
}

async function removeChallenge(challengeId) {
  if (!window.confirm('¿Quitar este reto del evento? Se ocultará para los participantes y conservará las soluciones registradas.')) return;
  try {
    await api(`/api/events/${state.current.event.id}/challenges/${challengeId}`, { method: 'DELETE' });
    toast('Reto retirado.');
    await refreshDashboard();
  } catch (error) { toast(error.message, true); }
}

function chooseChallengeAsset(challengeId) {
  const picker = document.createElement('input');
  picker.type = 'file';
  picker.accept = '.txt,.md,.pdf,.png,.jpg,.jpeg,.zip,.pcap,.pcapng,.csv,.json,.bin';
  picker.addEventListener('change', async () => {
    const file = picker.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast('El límite por archivo es 5 MiB.', true); return; }
    const form = new FormData();
    form.append('file', file, file.name);
    try {
      await api(`/api/events/${state.current.event.id}/challenges/${challengeId}/assets`, { method: 'POST', body: form, timeoutMs: 120000 });
      toast('Archivo adjuntado.');
      await refreshDashboard();
    } catch (error) { toast(error.message, true); }
  }, { once: true });
  picker.click();
}

async function removeChallengeAsset(assetId) {
  if (!window.confirm('¿Eliminar este archivo adjunto?')) return;
  try {
    await api(`/api/events/${state.current.event.id}/assets/${assetId}`, { method: 'DELETE' });
    toast('Archivo eliminado.');
    await refreshDashboard();
  } catch (error) { toast(error.message, true); }
}

async function toggleIntegrity() {
  const area = document.getElementById('integrity-area');
  if (!area) return;
  if (area.dataset.open === 'true') { area.innerHTML = ''; area.dataset.open = 'false'; return; }
  area.dataset.open = 'true';
  area.innerHTML = '<section class="panel checkpoint-panel"><div class="loading">Cargando señales…</div></section>';
  try {
    const rows = await api(`/api/events/${state.current.event.id}/integrity`);
    area.innerHTML = `<section class="panel checkpoint-panel"><div class="section-heading"><div><h2>Señales de integridad</h2><span>Son indicadores para revisión manual; no aplican sanciones automáticas.</span></div><a class="button button-quiet button-small" href="/api/events/${state.current.event.id}/integrity.csv">Exportar CSV</a></div>${rows.length ? `<div class="checkpoint-list">${rows.map((row) => `<div class="checkpoint-row"><div><strong>${esc(row.display_name)} · ${esc(row.username)}</strong><small>Intentos incorrectos reiterados · ${Number(row.details.failed_attempts)} en ${Number(row.details.window_minutes)} min · ${dateLabel(row.created_at)}</small></div><span class="pill">Revisar</span></div>`).join('')}</div>` : '<div class="score-empty">No hay señales registradas.</div>'}</section>`;
  } catch (error) { area.innerHTML = ''; area.dataset.open = 'false'; toast(error.message, true); }
}

async function createTeam() {
  const name = window.prompt('Nombre del equipo');
  if (!name?.trim()) return;
  try {
    const result = await api(`/api/events/${state.current.event.id}/teams`, { method: 'POST', body: JSON.stringify({ name: name.trim() }) });
    toast(`Equipo creado. Código: ${result.join_code}`);
    await refreshDashboard();
  } catch (error) { toast(error.message, true); }
}

async function joinTeam() {
  const code = window.prompt('Código de invitación del equipo');
  if (!code?.trim()) return;
  try {
    await api(`/api/events/${state.current.event.id}/teams/join`, { method: 'POST', body: JSON.stringify({ code: code.trim() }) });
    toast('Te uniste al equipo.');
    await refreshDashboard();
  } catch (error) { toast(error.message, true); }
}

async function createCheckpoint() {
  try {
    const saved = await api(`/api/events/${state.current.event.id}/checkpoints`, { method: 'POST', body: '{}' });
    await downloadCheckpoint(saved.id);
    toast('Checkpoint guardado y descargado.');
    await toggleCheckpoints(true);
  } catch (error) { toast(error.message, true); }
}

async function downloadCheckpoint(id) {
  const eventId = state.current.event.id;
  const snapshot = await api(`/api/events/${eventId}/checkpoints/${id}`);
  const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `labcentral-checkpoint-${eventId}-${id}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

async function toggleCheckpoints(forceOpen = false) {
  const area = document.getElementById('checkpoints-area');
  if (!area) return;
  if (area.dataset.open === 'true' && !forceOpen) { area.innerHTML = ''; area.dataset.open = 'false'; return; }
  try {
    const eventId = state.current.event.id;
    const entries = await api(`/api/events/${eventId}/checkpoints`);
    area.dataset.open = 'true';
    area.innerHTML = `<section class="panel checkpoint-panel"><div class="section-heading"><div><h2>Checkpoints de progreso</h2><span>Restaurar reemplaza las soluciones actuales por las guardadas en ese momento.</span></div></div>${entries.length ? `<div class="checkpoint-list">${entries.map((item) => `<div class="checkpoint-row"><div><strong>Checkpoint ${item.id}</strong><small>${dateLabel(item.created_at)} · ${item.solve_count} soluciones</small></div><div class="checkpoint-actions"><button class="button button-quiet button-small" data-download-checkpoint="${item.id}">Descargar</button><button class="button button-danger button-small" data-restore-checkpoint="${item.id}">Restaurar progreso</button></div></div>`).join('')}</div>` : '<div class="score-empty">Todavía no se han guardado checkpoints.</div>'}</section>`;
    area.querySelectorAll('[data-download-checkpoint]').forEach((button) => button.addEventListener('click', () => downloadCheckpoint(Number(button.dataset.downloadCheckpoint)).catch((error) => toast(error.message, true))));
    area.querySelectorAll('[data-restore-checkpoint]').forEach((button) => button.addEventListener('click', () => restoreCheckpoint(Number(button.dataset.restoreCheckpoint))));
  } catch (error) { toast(error.message, true); }
}

async function restoreCheckpoint(id) {
  if (!window.confirm('Restaurar este checkpoint eliminará las soluciones registradas después de él. ¿Continuar?')) return;
  try {
    const result = await api(`/api/events/${state.current.event.id}/checkpoints/${id}/restore`, { method: 'POST', body: '{}' });
    toast(`Progreso restaurado: ${result.restored_solves} soluciones.`);
    await refreshDashboard();
  } catch (error) { toast(error.message, true); }
}

async function boot() {
  setLoading('Preparando LabCentral 2…');
  try {
    const status = await api('/api/status');
    state.setupRequired = status.setup_required;
    if (state.setupRequired) { renderAuth('setup'); return; }
    if (state.passwordResetToken) { renderAuth('reset'); return; }
    try {
      state.me = await api('/api/me');
      await loadEvents();
      renderHome();
    } catch (error) {
    if (error.message === 'Inicia sesión para continuar') renderAuth('login');
      else throw error;
    }
  } catch (error) {
    root.innerHTML = shell(`<main class="page"><div class="empty-state"><strong>No se pudo iniciar LabCentral 2</strong>${esc(error.message)}<br><br><button id="retry" class="button button-dark">Reintentar</button></div></main>`);
    document.getElementById('retry')?.addEventListener('click', () => location.reload());
  }
}

boot();
