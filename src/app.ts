import express, { Request, Response } from "express";
import { getClientIp } from "request-ip";
import cors from "cors";
import { docClient, twitchAuth } from "../src/aws";
import { getTwitchUsers } from "../src/api";

//#region Server initial
const app = express();
const port = 3000;

const clients = new Map<string, Response>();
const streamers = new Map<string, { [key: string]: string }>();
const headerParams = new Map<string, string>();

twitchAuth().then(({ auth, token }) => {
  headerParams.set("clientId", auth?.[0] || "");
  headerParams.set("accessToken", token?.[0].access_token);
});

app.listen(port, "0.0.0.0", () => {
  console.log(`Example app listening at http://localhost:${port}`);
});
//#endregion

app.use(cors());

app.get("/getStream", async (req: Request, res: Response) => {
  const items = (await docClient.scan({ TableName: "Streamer" }).promise())
    .Items;
  items?.forEach((item) => {
    streamers.set(item.user_name, item);
  });
  res.send(items);
});

app.get("/putStream", async (req: Request, res: Response) => {
  res.send(headerParams.get("accessToken"));
  /*const message = req.query.message as string;
  if (!streamers.has(message)) {
    // Search users in twitch

    // Update on "Streamers" DynamoDB
    let updateExpression = "SET ";
    const expressionAttributeKeys: { [key: string]: string } = {};
    const expressionAttributeValues: { [key: string]: any } = {};

    const attributes = {};

    // attributes 객체키를 배열로 나열하고 이를 순회
    Object.keys(attributes).forEach((key, index) => {
      const placeholder = `#attr${index}`;
      updateExpression += `${placeholder} = :value${index}, `;
      expressionAttributeKeys[placeholder] = key;
      expressionAttributeValues[`:value${index}`] = attributes[key];
    });

    const params = {
      TableName: "Streamer",
      Key: {
        streamer_id: message,
      },
      UpdateExpression: updateExpression.slice(0, -2),
      ExpressionAttributeNames: expressionAttributeKeys,
      ExpressionAttributeValues: expressionAttributeValues,
    };

    docClient.update(params);
  }*/
});

app.get("/change", async (req: Request, res: Response) => {
  const message = req.query.message as string;

  res.send(
    await getTwitchUsers(
      message,
      headerParams.get("clientId") as string,
      headerParams.get("accessToken") as string
    )
  );
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

app.get("/report", (req: Request, res: Response) => {
  res.send(`Current clients: ${clients.size}`);
});

const sendEvent = (data: { [key: string]: string }) => {
  clients.forEach((client) => {
    client.write(`data: ${JSON.stringify(data)}\n\n`);
  });
};
