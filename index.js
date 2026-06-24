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

// YouTube RSS
const YOUTUBE_RSS_URL =
"https://www.youtube.com/feeds/videos.xml?channel_id=UCNfndWRyWneyURFe9_I9jLg";

// Minecraft RSS
const MC_RSS_URL =
"https://www.minecraft.net/content/minecraft-net/_jcr_content.articles.feed";

const MC_CHANNEL_ID = "1519156682209497209";

let lastVideo = null;
let latestVideo = null;

let lastMinecraftPost = null;
let latestMinecraftPost = null;

client.once("ready", async () => {
console.log("Logged in as ${client.user.tag}");

await checkYoutube();
await checkMinecraft();

// YouTube: 1分ごと
setInterval(checkYoutube, 60 * 1000);

// Minecraft: 5分ごと
setInterval(checkMinecraft, 5 * 60 * 1000);
});

client.on("messageCreate", async (message) => {
if (message.author.bot) return;

const content = message.content.trim();

// 最新YouTube動画を送信
if (content === "!load") {
if (!latestVideo) {
await message.reply("動画データがまだありません");
return;
}

await sendVideo(latestVideo);
await message.reply("最新動画を送信しました");
return;

}

// 最新Minecraft記事を取得して送信
if (content === "!snapshot") {
try {
const feed = await parser.parseURL(MC_RSS_URL);

  const post = feed.items.find(item =>
    /snapshot|pre-release|preview/i.test(item.title)
  );

  if (!post) {
    await message.reply(
      "Snapshot / Pre-release / Preview が見つかりませんでした"
    );
    return;
  }

  await sendMinecraftPost(post);
  await message.reply("最新Minecraft記事を送信しました");
} catch (err) {
  console.error(err);
  await message.reply("Minecraft記事の取得に失敗しました");
}

return;

}
});

async function checkYoutube() {
try {
const feed = await parser.parseURL(YOUTUBE_RSS_URL);
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
console.error("YouTube RSS取得エラー:", err);
}
}

async function checkMinecraft() {
try {
const feed = await parser.parseURL(MC_RSS_URL);

const post = feed.items.find(item =>
  /snapshot|pre-release|preview/i.test(item.title)
);

if (!post) return;

latestMinecraftPost = post;

if (lastMinecraftPost === null) {
  lastMinecraftPost = post.link;
  console.log("初回Minecraft記事保存:", post.title);
  return;
}

if (post.link !== lastMinecraftPost) {
  lastMinecraftPost = post.link;

  await sendMinecraftPost(post);

  console.log("新Minecraft記事通知:", post.title);
}

} catch (err) {
console.error("Minecraft RSS取得エラー:", err);
}
}

async function sendVideo(video) {
const channel = await client.channels.fetch(CHANNEL_ID);

if (!channel?.isTextBased()) return;

await channel.send(
"📺 新しい動画が投稿されました！\n" +
"**${video.title}**\n" +
"${video.link}"
);
}

async function sendMinecraftPost(post) {
const channel = await client.channels.fetch(MC_CHANNEL_ID);

if (!channel?.isTextBased()) return;

let type = "Minecraft News";

if (/snapshot/i.test(post.title)) {
type = "Snapshot";
} else if (/pre-release/i.test(post.title)) {
type = "Pre-release";
} else if (/preview/i.test(post.title)) {
type = "Preview";
}

await channel.send(
"🧪 新しいMinecraft ${type} が公開されました！\n" +
"**${post.title}**\n" +
"${post.link}"
);
}

client.login(TOKEN);
