import { Client, GatewayIntentBits } from "discord.js";
import Parser from "rss-parser";
import readline from "readline";

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

const parser = new Parser();

const TOKEN = process.env.TOKEN;
const CHANNEL_ID = process.env.CHANNEL_ID;

const RSS_URL =
  "https://www.youtube.com/feeds/videos.xml?channel_id=UCNfndWRyWneyURFe9_I9jLg";

let lastVideo = null;
let latestVideo = null;

client.once("clientReady", async () => {
  console.log(`Logged in as ${client.user.tag}`);

  // 起動時に即チェック
  await checkYoutube();

  // 1分ごとに確認
  setInterval(checkYoutube, 60000);

  // コンソール入力開始
  startConsole();
});

async function checkYoutube() {
  try {
    const feed = await parser.parseURL(RSS_URL);

    const video = feed.items[0];

    if (!video) return;

    latestVideo = video;

    // 初回起動時は保存だけ
    if (lastVideo === null) {
      lastVideo = video.link;
      console.log("初回動画保存:", video.title);
      return;
    }

    // 新動画チェック
    if (video.link !== lastVideo) {
      lastVideo = video.link;

      await sendVideo(video);

      console.log("新動画通知:", video.title);
    }
  } catch (err) {
    console.error("RSS取得エラー:", err);
  }
}

async function sendVideo(video) {
  const channel = await client.channels.fetch(CHANNEL_ID);

  await channel.send(
    `📺 新しい動画が投稿されました！\n` +
    `**${video.title}**\n` +
    `${video.link}`
  );
}

function startConsole() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  console.log("コマンド受付開始");
  console.log("send = 最新動画を送信");

  rl.on("line", async (input) => {
    const command = input.trim();

    if (command === "send") {
      if (!latestVideo) {
        console.log("動画データなし");
        return;
      }

      await sendVideo(latestVideo);

      console.log("最新動画を送信しました");
    }
  });
}

client.login(TOKEN);
