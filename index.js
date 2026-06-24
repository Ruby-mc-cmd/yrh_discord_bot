import { Client, GatewayIntentBits } from "discord.js";

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const TOKEN = process.env.TOKEN;
const CHANNEL_ID = process.env.CHANNEL_ID;
const MC_CHANNEL_ID = "1519156682209497209";

const YOUTUBE_RSS_URL =
  "https://www.youtube.com/feeds/videos.xml?channel_id=UCNfndWRyWneyURFe9_I9jLg";

const MC_VERSION_API =
  "https://piston-meta.mojang.com/mc/game/version_manifest_v2.json";

const MC_ARTICLE_BASE = "https://www.minecraft.net/en-us/article/";

let lastVideoLink = null;
let latestVideo = null;
let lastSnapshotId = null;
let latestSnapshot = null;

client.once("ready", async () => {
  console.log(`Logged in as ${client.user.tag}`);
  await checkYoutube();
  await checkMinecraft();
  setInterval(checkYoutube, 60 * 1000);
  setInterval(checkMinecraft, 5 * 60 * 1000);
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
    return;
  }

  if (content === "!snap" || content === "!snapshot") {
    try {
      const snap = await fetchLatestSnapshot();
      if (!snap) {
        await message.reply("Snapshot / Pre-release / Preview が見つかりませんでした");
        return;
      }
      await sendMinecraftPost(snap);
      await message.reply("最新Minecraft記事を送信しました");
    } catch (err) {
      console.error("!snapshot エラー:", err);
      await message.reply(`Minecraft情報の取得に失敗しました\nエラー: \`${err.message}\``);
    }
    return;
  }
});

async function checkYoutube() {
  try {
    const res = await fetch(YOUTUBE_RSS_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();

    const titleMatch = text.match(/<entry>[\s\S]*?<title>([\s\S]*?)<\/title>/);
    const linkMatch = text.match(/<link rel="alternate"[^>]*href="([^"]+)"/);
    if (!titleMatch || !linkMatch) return;

    const video = {
      title: titleMatch[1].replace(/<!\[CDATA\[|\]\]>/g, "").trim(),
      link: linkMatch[1]
    };

    latestVideo = video;

    if (lastVideoLink === null) {
      lastVideoLink = video.link;
      console.log("初回動画保存:", video.title);
      return;
    }

    if (video.link !== lastVideoLink) {
      lastVideoLink = video.link;
      await sendVideo(video);
      console.log("新動画通知:", video.title);
    }
  } catch (err) {
    console.error("YouTube RSS取得エラー:", err.message);
  }
}

async function checkMinecraft() {
  try {
    const snap = await fetchLatestSnapshot();
    if (!snap) return;

    latestSnapshot = snap;

    if (lastSnapshotId === null) {
      lastSnapshotId = snap.id;
      console.log("初回Minecraft保存:", snap.id);
      return;
    }

    if (snap.id !== lastSnapshotId) {
      lastSnapshotId = snap.id;
      await sendMinecraftPost(snap);
      console.log("新Minecraft通知:", snap.id);
    }
  } catch (err) {
    console.error("Minecraft API取得エラー:", err.message);
  }
}

async function fetchLatestSnapshot() {
  const res = await fetch(MC_VERSION_API);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();

  const snap = json.versions.find(v => v.type === "snapshot");
  if (!snap) return null;

  const articleSlug = `minecraft-java-edition-${snap.id.toLowerCase().replace(/ /g, "-")}`;
  return {
    id: snap.id,
    releaseTime: snap.releaseTime,
    url: `${MC_ARTICLE_BASE}${articleSlug}`,
    type: detectType(snap.id)
  };
}

function detectType(id) {
  const lower = id.toLowerCase();
  if (lower.includes("preview")) return "Preview";
  if (lower.includes("pre")) return "Pre-release";
  if (lower.includes("rc")) return "Release Candidate";
  return "Snapshot";
}

async function sendVideo(video) {
  const channel = await client.channels.fetch(CHANNEL_ID);
  if (!channel?.isTextBased()) return;
  await channel.send(
    `📺 新しい動画が投稿されました！\n**${video.title}**\n${video.link}`
  );
}

async function sendMinecraftPost(snap) {
  const channel = await client.channels.fetch(MC_CHANNEL_ID);
  if (!channel?.isTextBased()) return;

  const released = new Date(snap.releaseTime).toLocaleDateString("ja-JP", {
    year: "numeric", month: "long", day: "numeric"
  });

  await channel.send(
    `🧪 新しいMinecraft **${snap.type}** が公開されました！\n` +
    `**${snap.id}** (${released})\n` +
    `${snap.url}`
  );
}

client.login(TOKEN);
