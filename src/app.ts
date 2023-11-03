import express, { Request, Response } from "express";
import { getClientIp } from "request-ip";
import cors from "cors";

const app = express();
const port = 3000;
const clients = new Map<string, Response>();

app.listen(port, "0.0.0.0", () => {
  console.log(`Example app listening at http://localhost:${port}`);
});

// const whiteList: string[] = [];

app.use(cors());

app.get("/report", (req: Request, res: Response) => {
  res.send(`Current clients: ${clients.size}`);
});

app.get("/change", (req: Request, res: Response) => {
  const message = req.query.message as string;
  sendEvent({ message });
  res.end();
});

app.get("/sse", (req: Request, res: Response) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const ip = getClientIp(req) ?? "not-found";
  if (!clients.has(ip)) {
    clients.set(ip, res);
    console.log(`🖐 Client connected ${ip}`);

    req.on("close", () => {
      clients.delete(ip);
      console.log(`👋Client disonnected  ${ip}`);
      return res.end();
    });
  } else {
    res.send(
      `event: error\ndata: {"error": "❌Connected client is already exist"}\n\n`
    );
  }
});

const sendEvent = (data: { [key: string]: string }) => {
  clients.forEach((client) => {
    client.write(`data: ${JSON.stringify(data)}\n\n`);
  });
};
