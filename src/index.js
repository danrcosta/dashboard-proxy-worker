export default {
  async fetch(request) {
    const url = new URL(request.url);
    const targetUrl = 'http://172.27.208.1:8080' + url.pathname + url.search;
    try {
      const response = await fetch(targetUrl, {
        method: request.method,
        headers: request.headers,
        body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : undefined
      });
      return response;
    } catch (error) {
      return new Response('Dashboard unavailable: ' + error.message, { status: 503 });
    }
  }
}