export type AuthState = { error?: string; message?: string };

export function readCredentials(form: FormData, signup = false) {
  const email = form.get('email');
  const password = form.get('password');
  if (typeof email !== 'string' || typeof password !== 'string') return null;
  const normalizedEmail = email.trim();
  if (normalizedEmail.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) return null;
  if (password.length < (signup ? 8 : 1) || password.length > 128) return null;
  if (signup && form.get('passwordConfirm') !== password) return null;
  return { email: normalizedEmail, password };
}

export function authError(code?: string) {
  switch (code) {
    case 'email_not_confirmed': return '이메일 인증을 완료한 뒤 로그인해 주세요.';
    case 'over_request_rate_limit':
    case 'over_email_send_rate_limit': return '요청이 많습니다. 잠시 후 다시 시도해 주세요.';
    case 'weak_password': return '더 강한 비밀번호를 사용해 주세요.';
    default: return '인증에 실패했습니다. 입력 내용을 확인하고 다시 시도해 주세요.';
  }
}
