const { createProxyMiddleware } = require("http-proxy-middleware");

module.exports = function (app) {
  // Get backend port from environment variables
  const BACKEND_PORT = process.env.REACT_APP_BACKEND_PORT || 5000;
  const targetUrl = `http://localhost:${BACKEND_PORT}`;

  app.use(
    "/api",
    createProxyMiddleware({
      target: targetUrl,
      changeOrigin: true,
    })
  );
};
