import express from "express";

export function keepAlive() {
  const app = express();

  app.get("/", (_, res) => res.send("Running..."));

  app.listen(process.env.PORT || 5000, () => {
    console.log("Server runngin...");
  });
}
