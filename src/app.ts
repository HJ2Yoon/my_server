import express, { Request, Response } from "express";
import { getClientIp } from "request-ip";

const app = express();
const port = 3000;

const clients = new Map<string, Response>();
app.get("/sse", (req: Request, res: Response) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const ip = getClientIp(req) ?? "not-found";
  if (!clients.has(ip)) {
    clients.set(ip, res);
    console.log(`📞 Client connected ${ip}`);
  } else {
    console.log("❌ Connected client is already exist");
    res.end();
  }

  res.send("Attempt to try SSE!");

  req.on("close", () => {
    clients.delete(ip);
    console.log("Current clients list", clients);
  });
});

app.listen(port, "0.0.0.0", () => {
  console.log(`Example app listening at http://localhost:${port}`);
});

const sendEvent = (data: { [key: string]: string }) => {
  clients.forEach((client) => {
    client.write(data);
  });
};
