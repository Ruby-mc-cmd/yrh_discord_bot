import { Client, GatewayIntentBits } from "discord.js";
import Parser from "rss-parser";

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const parser = new Parser();

const TOKEN = process.env.TOKEN;
const CHANNEL_ID = process.env.CHANNEL_ID;

const RSS_URL =
  "https://www.youtube.com/feeds/videos.xml?channel_id=UCNfndWRyWneyURFe9_I9jLg";

let lastVideo = null;
let latestVideo = null;

client.once("ready", async () => {
  console.log(`Logged in as ${client.user.tag}`);

  await checkYoutube();
  setInterval(checkYoutube, 60000);
});

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  const content = message.content.trim();

  if (content === "!load") {
    if (!latestVideo) {
      await message.reply("動画データがまだありません");
      return;
    }

    await sendVideo(latestVideo);
    await message.reply("最新動画を送信しました");
  }
});

async function checkYoutube() {
  try {
    const feed = await parser.parseURL(RSS_URL);
    const video = feed.items[0];
    if (!video) return;

    latestVideo = video;

    if (lastVideo === null) {
      lastVideo = video.link;
      console.log("初回動画保存:", video.title);
      return;
    }

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

client.login(TOKEN);
