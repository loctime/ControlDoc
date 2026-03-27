// Solo para browser
if (typeof window !== 'undefined') {
  if (!globalThis.Request && window.Request) {
    globalThis.Request = window.Request;
  }
}
