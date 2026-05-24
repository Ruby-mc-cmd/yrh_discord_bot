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

let lastVideo = null;

client.once("clientReady", async () => {
  console.log(`Logged in as ${client.user.tag}`);

  // 起動時に即チェック
  checkYoutube();

  // 1分ごとに確認
  setInterval(checkYoutube, 60000);
});

async function checkYoutube() {
  try {
    const feed = await parser.parseURL(RSS_URL);

    const video = feed.items[0];

    if (!video) return;

    // 初回起動時は保存だけ
    if (lastVideo === null) {
      lastVideo = video.link;
      console.log("初回動画保存:", video.title);
      return;
    }

    // 新動画チェック
    if (video.link !== lastVideo) {
      lastVideo = video.link;

      const channel = await client.channels.fetch(CHANNEL_ID);

      await channel.send({
        content: video.link,
        embeds: [
          {
            title: video.title,
            url: video.link,
            description:
              `📺 新しい動画が投稿されました！\n${video.link}`,
            thumbnail: {
              url: video.enclosure?.url || null
            },
            color: 0xff0000
          }
        ]
      });

      console.log("新動画通知:", video.title);
    }
  } catch (err) {
    console.error("RSS取得エラー:", err);
  }
}

client.login(TOKEN);
