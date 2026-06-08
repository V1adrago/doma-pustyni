// Заглушка авторизации. В будущем здесь будет Supabase/Firebase Auth.
// Для подключения: заменить каждую функцию на реальные вызовы SDK.

export function isOnlineAuthEnabled() {
  return false;
}

export function getCurrentUser() {
  return null;
}

export function signIn(_email, _password) {
  return Promise.reject(new Error('Онлайн-авторизация ещё не подключена'));
}

export function signUp(_email, _password) {
  return Promise.reject(new Error('Онлайн-авторизация ещё не подключена'));
}

export function signOut() {
  return Promise.resolve();
}
