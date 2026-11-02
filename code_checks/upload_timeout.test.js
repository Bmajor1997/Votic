import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import net from "node:net";
import { create_votic_server } from "../votic_server.js";

test("a timed-out upload sends 408, closes its reader/socket, and leaves the server available", { timeout: 5000 }, async () => {
  const server = create_votic_server({ env: {}, config: { body_timeout_ms: 100 }, logger: { warn() {}, error() {} } });
  let incoming;
  server.on("request", request => { if (request.url === "/api/extract") incoming = request; });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const socket = net.connect(server.address().port, "127.0.0.1");
  let response = "";
  socket.on("data", bytes => { response += bytes; });
  const closed = once(socket, "close");
  try {
    await once(socket, "connect");
    socket.write("POST /api/extract HTTP/1.1\r\nHost: localhost\r\nContent-Type: application/octet-stream\r\nX-Votic-Filename: slow.pdf\r\nContent-Length: 1000000\r\nConnection: keep-alive\r\n\r\n%PDF-");
    await closed;
    assert.match(response, /HTTP\/1\.1 408/);
    assert.match(response, /Connection: close/i);
    assert.equal(incoming.destroyed, true);
    const healthy = await fetch(`http://127.0.0.1:${server.address().port}/healthz`);
    assert.equal(healthy.status, 200);
    await healthy.text();
  } finally {
    socket.destroy();
    server.closeAllConnections();
    server.close();
    await once(server, "close");
  }
});
