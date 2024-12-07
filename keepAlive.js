import { createServer } from "http";

export function keepAlive() {
  const PORT = process.env.PORT || process.env.SERVER_PORT || 3000;

  const server = createServer((_, res) => {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("Running...");
  });

  server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}
