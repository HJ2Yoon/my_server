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
    // 방송(type) change event
    if (preData?.type !== item.type) sendEvent(item);
    // 제목(title) change event
    if (preData?.title !== item.title) sendEvent(item);
    // curData update
    streamers.set(item.user_name, item);
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

    if (!user)
      return res
        .status(400)
        .json(new Error("Error: 해당하는 유저를 찾을수 없습니다."));
    console.log(user);
    setStreamer(user);

    // Search req ip and add "streamer_id" on wishlist
    const ip = getClientIp(req) as string;
    clients.get(ip)?.wishList.push(login);
  }
  res.status(200).end();
});

app.get("/sse", (req: Request, res: Response) => {
  const ip = getClientIp(req) ?? "not-found";
  const clientList = req.params.list.split(",");

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  console.log(`🖐 Client connected ${ip}`);

  if (!clients.has(ip)) {
    clients.set(ip, { wishList: clientList ?? [], res });
    console.log(clients);

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
    `Current clients: ${clients.size}\n
    ${JSON.stringify(Object.fromEntries(clients))}\n
    ${JSON.stringify(Object.fromEntries(streamers))}`
  );
});

const sendEvent = (data: Streamer) => {
  clients.forEach((client) => {
    if (!client.wishList.find((element) => element === data.streamer_id))
      return;
    client.res.write(`data: ${JSON.stringify(data)}\n\n`);
  });
};
