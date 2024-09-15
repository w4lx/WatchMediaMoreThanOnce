import express from "express";

export function keepAlive() {
  const PORT = process.env.PORT || process.env.SERVER_PORT;

  const app = express();

  app.get("/", (_, res) => res.send("Running..."));

  app.listen(PORT || 3000, () => {
    console.log("Server runngin...");
  });
}
