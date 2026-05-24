import { Client, GatewayIntentBits } from "discord.js";
import Parser from "rss-parser";

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

const parser = new Parser();

const TOKEN = process.env.TOKEN;
const CHANNEL_ID = process.env.CHANNEL_ID;

const RSS_URL =
  "https://www.youtube.com/feeds/videos.xml?channel_id=UCNfndWRyWneyURFe9_I9jLg";

let lastVideo = "";

client.once("ready", async () => {
  console.log(`Logged in as ${client.user.tag}`);

  setInterval(checkYoutube, 60000);
});

async function checkYoutube() {
  const feed = await parser.parseURL(RSS_URL);

  const video = feed.items[0];

  if (!video) return;

  if (video.link !== lastVideo) {
    lastVideo = video.link;

    const channel = await client.channels.fetch(CHANNEL_ID);

    channel.send(
      `📺 新しい動画！\n**${video.title}**\n${video.link}`
    );
  }
}

client.login(TOKEN);
