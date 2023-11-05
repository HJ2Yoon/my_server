import express, { Request, Response } from "express";
import { getClientIp } from "request-ip";
import cors from "cors";
import { docClient, setStreamer, twitchAuth } from "../src/aws";
import { getTwitchUser } from "../src/api";

//#region Server initial
const app = express();
const port = 3000;

const clients = new Map<string, { wishList: string[]; res: Response }>();
const streamers = new Map<string, Streamer>();
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
interface Streamer {
  streamer_id: string;
  id: string;
  user_name: string;
  title: string;
  profile_image_url: string;
  started_at: string;
  type: string;
  viewer_count: number;
}

// Get stream data from DynaomoDB
setInterval(async () => {
  const items = (await docClient.scan({ TableName: "Streamer" }).promise())
    .Items as Streamer[];
  items?.forEach((item) => {
    // Compare preData(before 1min) event trigger
    const preData = streamers.get(item.streamer_id);
    console.log(preData, item);

    if (preData) {
      // 방송(type) change event
      console.log(preData?.type, item.type);
      if (preData.type !== item.type) {
        sendEvent(item);
      }
      // 제목(title) change event
      console.log(preData?.title, item.title);
      if (preData.title !== item.title) {
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
  res.json();
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
    if (!user)
      return res
        .status(400)
        .json(new Error("Error: 해당하는 유저를 찾을수 없습니다."));

    setStreamer(user);
  }
  // Search req ip and add "streamer_id" on wishlist
  const ip = getClientIp(req) as string;
  clients.get(ip)?.wishList.push(login);
  res.status(200).end();
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

const sendEvent = (data: Streamer) => {
  clients.forEach((client) => {
    if (!client.wishList.find((element) => element === data.streamer_id))
      return;
    client.res.write(`data: ${JSON.stringify(data)}\n\n`);
  });
};
