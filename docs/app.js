const apiBase = window.__SCOPEBRIDGE_BACKEND_URL__ || '';

const loginForm = document.getElementById('loginForm');
const registrationForm = document.getElementById('registrationForm');
const messageEl = document.getElementById('message');

function setMessage(text, kind = '') {
  const target = messageEl || document.body;
  target.textContent = text;
  if (messageEl) {
    messageEl.className = 'message';
    if (kind) messageEl.classList.add(kind);
  }
}

async function submitLoginSubmission(userId, password) {
  if (!userId || !password) {
    setMessage('Please enter both a user ID and password.', 'error');
    return;
  }

  try {
    setMessage('Signing in…');
    const response = await fetch(`${apiBase}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ userId, password })
    });

    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || 'Invalid user ID or password');
    }

    setMessage(`Welcome ${payload.user.profile.fullName || payload.user.userId}. Redirecting…`, 'success');
    const target = payload.user.role === 'admin' ? './admin.html' : './profile.html';
    setTimeout(() => { window.location.href = target; }, 500);
  } catch (error) {
    setMessage(error.message || 'Login failed.', 'error');
  }
}

if (loginForm) {
  loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(loginForm);
    const userId = String(formData.get('userId') || '').trim();
    const password = String(formData.get('password') || '');
    await submitLoginSubmission(userId, password);
  });
}

if (registrationForm) {
  registrationForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(registrationForm);
    const fullName = String(formData.get('fullName') || '').trim();
    const email = String(formData.get('email') || '').trim();
    const password = String(formData.get('password') || '');
    const role = String(formData.get('role') || 'guest');
    const plan = String(formData.get('plan') || 'guest-free');
    const selectedPlan = registrationForm.querySelector(`input[name="plan"][value="${plan}"]`);
    const monthlyFee = Number(selectedPlan?.dataset.fee || 0);
    const phone = String(formData.get('phone') || '').trim();
    const address = String(formData.get('address') || '').trim();

    if (!fullName || !email || !password) {
      setMessage('Full name, email, and password are required.', 'error');
      return;
    }

    try {
      setMessage('Creating account…');
      const response = await fetch(`${apiBase}/api/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ role, fullName, email, password, phone, address, plan, monthlyFee })
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || 'Registration failed');
      }

      setMessage(`Account created for ${payload.user.profile.fullName}. Redirecting…`, 'success');
      setTimeout(() => { window.location.href = payload.user.role === 'admin' ? './admin.html' : './profile.html'; }, 500);
    } catch (error) {
      setMessage(error.message || 'Registration failed.', 'error');
    }
  });
}
