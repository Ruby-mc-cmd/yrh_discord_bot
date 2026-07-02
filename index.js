import { Client, GatewayIntentBits, EmbedBuilder, PermissionFlagsBits, MessageFlags } from "discord.js";

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildMembers
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

const ROLE_REACTIONS = {
  "❤️": "1522070132183269467",
  "🔔": "1522070352841277620"
};

let panelMessageId = null;

let lastVideoLink = null;
let latestVideo = null;
let lastSnapshotId = null;
let latestSnapshot = null;

client.once("ready", async () => {
  console.log(`Logged in as ${client.user.tag}`);
  await checkYoutube();
  await checkMinecraft();
  setInterval(checkYoutube, 60 * 1000);
  setInterval(checkMinecraft, 60 * 1000);
});

// ========== コマンド ==========
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;
  const content = message.content.trim();

  if (content === "!panel") {
    if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
      await message.reply("このコマンドは管理者のみ使用できます");
      return;
    }

    const guild = message.guild;
    const role1 = guild.roles.cache.get("1522070132183269467");
    const role2 = guild.roles.cache.get("1522070352841277620");

    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle("🎭 ロール取得パネル")
      .setDescription(
        "下のリアクションを押すと対応したロールが付与されます。\n" +
        "もう一度押すとロールが外れます。\n\n" +
        `❤️ → **${role1?.name ?? "不明なロール"}**\n` +
        `🔔 → **${role2?.name ?? "不明なロール"}**`
      )
      .setFooter({ text: "リアクションはいつでも変更できます" });

    const panel = await message.channel.send({ embeds: [embed] });
    panelMessageId = panel.id;

    for (const emoji of Object.keys(ROLE_REACTIONS)) {
      await panel.react(emoji);
    }

    await message.delete().catch(() => {});
    return;
  }

  if (content === "!video") {
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

// ========== リアクション追加 ==========
client.on("messageReactionAdd", async (reaction, user) => {
  if (user.bot) return;
  if (reaction.message.id !== panelMessageId) return;

  const emoji = reaction.emoji.name;
  const roleId = ROLE_REACTIONS[emoji];
  if (!roleId) return;

  try {
    const guild = reaction.message.guild;
    const member = await guild.members.fetch(user.id);
    const role = guild.roles.cache.get(roleId);
    await member.roles.add(roleId);

    await reaction.message.channel.send({
      content: `✅ <@${user.id}> **${emoji} ${role?.name ?? roleId}** を付与しました！`,
      flags: MessageFlags.Ephemeral
    }).then(msg => setTimeout(() => msg.delete().catch(() => {}), 5000));

    console.log(`ロール付与: ${user.tag} → ${emoji} (${roleId})`);
  } catch (err) {
    console.error("ロール付与エラー:", err.message);
  }
});

// ========== リアクション削除 ==========
client.on("messageReactionRemove", async (reaction, user) => {
  if (user.bot) return;
  if (reaction.message.id !== panelMessageId) return;

  const emoji = reaction.emoji.name;
  const roleId = ROLE_REACTIONS[emoji];
  if (!roleId) return;

  try {
    const guild = reaction.message.guild;
    const member = await guild.members.fetch(user.id);
    const role = guild.roles.cache.get(roleId);
    await member.roles.remove(roleId);

    await reaction.message.channel.send({
      content: `🗑️ <@${user.id}> **${emoji} ${role?.name ?? roleId}** を外しました`,
      flags: MessageFlags.Ephemeral
    }).then(msg => setTimeout(() => msg.delete().catch(() => {}), 5000));

    console.log(`ロール削除: ${user.tag} → ${emoji} (${roleId})`);
  } catch (err) {
    console.error("ロール削除エラー:", err.message);
  }
});

// ========== YouTube ==========
async function checkYoutube() {
  try {
    const res = await fetch(YOUTUBE_RSS_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();

    const entryMatch = text.match(/<entry>([\s\S]*?)<\/entry>/);
    if (!entryMatch) return;

    const entry = entryMatch[1];
    const titleMatch = entry.match(/<title>([\s\S]*?)<\/title>/);
    const linkMatch = entry.match(/<link rel="alternate"[^>]*href="([^"]+)"/);
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

// ========== Minecraft ==========
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

  const articleSlug = snap.id.toLowerCase().replace(/\./g, "-");
  const url = `${MC_ARTICLE_BASE}minecraft-${articleSlug}`;
  const ogImage = await fetchOgImage(url);

  return {
    id: snap.id,
    releaseTime: snap.releaseTime,
    url,
    type: detectType(snap.id),
    image: ogImage
  };
}

async function fetchOgImage(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const html = await res.text();
    const match = html.match(/<meta[^>]*property="og:image"[^>]*content="([^"]+)"/);
    if (!match) {
      const match2 = html.match(/<meta[^>]*content="([^"]+)"[^>]*property="og:image"/);
      return match2 ? match2[1] : null;
    }
    return match[1];
  } catch {
    return null;
  }
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
    `<@&1522070132183269467>\n📺 新しい動画が投稿されました！\n**${video.title}**\n${video.link}`
  );
}

async function sendMinecraftPost(snap) {
  const channel = await client.channels.fetch(MC_CHANNEL_ID);
  if (!channel?.isTextBased()) return;

  const released = new Date(snap.releaseTime).toLocaleDateString("ja-JP", {
    year: "numeric", month: "long", day: "numeric"
  });

  const embed = new EmbedBuilder()
    .setColor(0x4CAF50)
    .setTitle(`🧪 新しいMinecraft ${snap.type} が公開されました！`)
    .setDescription(`**${snap.id}** (${released})`)
    .setURL(snap.url);

  if (snap.image) embed.setImage(snap.image);

  await channel.send({
    content: `<@&1522070352841277620>`,
    embeds: [embed]
  });
}

client.login(TOKEN);
