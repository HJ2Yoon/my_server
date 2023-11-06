import express, { Request, Response } from "express";
import { getClientIp } from "request-ip";
import cors from "cors";
import { docClient, setStreamer, twitchAuth } from "../src/aws";
import { getTwitchUser } from "../src/api";
import { write } from "fs";

//#region Server initial
const app = express();
const port = 3000;

const clients = new Map<string, { wishList: string[]; res: Response }>();
const streamers = new Map<string, StreamData>();
const headerParams = new Map<string, string>();

twitchAuth().then(({ auth, token }) => {
  headerParams.set("clientId", auth?.[0] || "");
  headerParams.set("accessToken", token?.[0].access_token);
});

app.listen(port, "0.0.0.0", () => {
  console.log(`Example app listening at http://localhost:${port}`);
});
//#endregion

// Type of stream data
interface StreamData {
  streamer_id: string;
  id: string;
  user_name: string;
  title: string;
  profile_image_url: string;
  started_at: string;
  type: "live" | "off";
  viewer_count: number;
}

// Get stream data from DynaomoDB
setInterval(async () => {
  const items = (await docClient.scan({ TableName: "Streamer" }).promise())
    .Items as StreamData[];
  items?.forEach((item) => {
    // Compare preData(before 1min) event trigger
    const preData = streamers.get(item.streamer_id);

    if (preData) {
      if (preData.type !== item.type) {
        // 방송(type) change event
        console.log(preData?.type, item.type);
        sendEvent(item);
      } else if (preData.title !== item.title) {
        // 제목(title) change event
        console.log(preData?.title, item.title);
        sendEvent(item);
      }
    }
    // curData update
    streamers.set(item.streamer_id, item);
  });
}, 60 * 1000);

app.use(cors());

// Client intialize 할때 불러오기
app.get("/getStream", async (req: Request, res: Response) => {
  res.setHeader("Content-Type", "application/json");

  const wishList = req.query.list as string;
  res.status(200).json(
    wishList.split(",").map((element) => {
      console.log(element, streamers.get(element));
      return streamers.get(element);
    })
  );
});

app.get("/putStream", async (req: Request, res: Response) => {
  res.setHeader("Content-Type", "application/json");
  const login = req.query.login as string;

  if (!streamers.has(login)) {
    // Search users in twitch
    const user = (
      await getTwitchUser(
        login,
        headerParams.get("clientId") as string,
        headerParams.get("accessToken") as string
      )
    ).data.data[0];
    console.log(user);
    if (!user) return res.status(406).end();
    else setStreamer(user);
  }
  // Search req ip and add "streamer_id" on wishlist
  const ip = getClientIp(req) as string;
  clients.get(ip)?.wishList.push(login);
  res.status(200).json(streamers.get(login));
});

app.get("/sse", (req: Request, res: Response) => {
  const ip = getClientIp(req) ?? "not-found";
  console.log(`🖐 Client connected ${ip}`);

  const list = (req.query.list as string) ?? "";

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  if (!clients.has(ip)) {
    clients.set(ip, { wishList: list === "" ? [] : list.split(","), res });
    console.log(clients.get(ip)?.wishList);
    res.write("event: connected\ndata: connected\n\n");

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
  res.send(
    `Current clients: ${clients.size}${JSON.stringify(
      Object.fromEntries(streamers)
    )}`
  );
});

const sendEvent = (data: StreamData) => {
  clients.forEach((client) => {
    if (!client.wishList.find((element) => element === data.streamer_id))
      return;
    client.res.write(`data: ${JSON.stringify(data)}\n\n`);
  });
};
