const registerMode = window.location.pathname === '/register';
const form = document.getElementById('authPageForm');
const intro = document.getElementById('authPageIntro');
const submit = document.getElementById('authPageSubmit');
const password = document.getElementById('authPagePassword');
const toggle = document.getElementById('authPageSwitch');
const reset = document.getElementById('authPasswordReset');
const verificationLabel = document.getElementById('verificationCodeLabel');
const verificationCode = document.getElementById('authVerificationCode');
const sendCode = document.getElementById('sendVerificationCode');
let emailVerificationEnabled = true;
const error = document.getElementById('authPageError');

function setMode(register) {
  intro.textContent = register ? 'Create an account to keep your calculations private.' : 'Log in to access your private calculations and settings.';
  submit.textContent = register ? 'Register' : 'Log in';
  toggle.textContent = register ? 'Already have an account' : 'Create an account';
  verificationLabel.classList.toggle('hidden', !register || !emailVerificationEnabled);
  verificationCode.required = register && emailVerificationEnabled;
  if (register) password.setAttribute('pattern', '(?=.*[A-Z])(?=.*[0-9])(?=.*[^A-Za-z0-9]).{8,}');
  else password.removeAttribute('pattern');
  window.history.replaceState({}, '', register ? '/register' : '/login');
}

fetch('/api/auth/config').then((response) => response.json()).then((config) => {
  emailVerificationEnabled = Boolean(config.email_verification_enabled);
  setMode(registerMode);
}).catch(() => setMode(registerMode));
toggle.addEventListener('click', () => setMode(window.location.pathname !== '/register'));
reset.addEventListener('click', () => { error.textContent = 'Password recovery will be available soon.'; });
sendCode.addEventListener('click', async () => {
  error.textContent = '';
  const email = document.getElementById('authPageEmail').value.trim();
  if (!email) { error.textContent = 'Enter your email address first.'; return; }
  const result = await fetch('/api/auth/send-code', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) });
  const data = await result.json().catch(() => ({}));
  error.textContent = result.ok ? 'Verification code sent.' : (data.error || 'Unable to send verification code.');
});
form.addEventListener('submit', async (event) => {
  event.preventDefault();
  error.textContent = '';
  const endpoint = window.location.pathname === '/register' ? '/api/auth/register' : '/api/auth/login';
  const result = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: document.getElementById('authPageEmail').value, password: document.getElementById('authPagePassword').value, verification_code: verificationCode.value }) });
  const data = await result.json().catch(() => ({}));
  if (!result.ok) { error.textContent = data.error || 'Authentication failed.'; return; }
  if (data.access_token) localStorage.setItem('access_token', data.access_token);
  window.location.assign('/');
});
