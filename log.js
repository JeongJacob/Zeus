const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const fs = require("fs");
const path = require("path");

const DATA_PATH = path.join(__dirname, "../data/logchannels.json");

// ── 로그 채널 데이터 로드/저장 ────────────────────────────
function loadLogChannels() {
  try {
    if (!fs.existsSync(DATA_PATH)) return {};
    const content = fs.readFileSync(DATA_PATH, "utf-8").trim();
    return content ? JSON.parse(content) : {};
  } catch {
    return {};
  }
}

function saveLogChannels(data) {
  const dir = path.dirname(DATA_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2), "utf-8");
}

// ── 로그 전송 유틸 (index.js에서 import해서 사용) ─────────
async function sendLog(client, guildId, embed) {
  try {
    const channels = loadLogChannels();
    const channelId = channels[guildId];
    if (!channelId) return;

    const channel = await client.channels.fetch(channelId).catch(() => null);
    if (!channel) return;

    await channel.send({ embeds: [embed] });
  } catch (e) {
    console.error("로그 전송 실패:", e);
  }
}

// ── /로그채널 슬래시 커맨드 ───────────────────────────────
const data = new SlashCommandBuilder()
  .setName("로그채널")
  .setDescription("봇 명령어 로그를 기록할 채널을 설정합니다. (관리자 전용)")
  .addChannelOption((option) =>
    option
      .setName("채널")
      .setDescription("로그를 기록할 채널을 선택하세요.")
      .setRequired(true),
  );

async function execute(interaction) {
  if (!interaction.guild) {
    return interaction.reply({
      content: "서버에서만 사용할 수 있습니다.",
      flags: 64,
    });
  }

  const isAdmin = interaction.member.permissions.has("Administrator");
  if (!isAdmin) {
    return interaction.reply({
      content: "❌ 관리자만 로그 채널을 설정할 수 있습니다.",
      flags: 64,
    });
  }

  const channel = interaction.options.getChannel("채널");
  const guildId = interaction.guild.id;

  const channels = loadLogChannels();
  channels[guildId] = channel.id;
  saveLogChannels(channels);

  return interaction.reply({
    content: `✅ 로그 채널이 <#${channel.id}>로 설정되었습니다.\n이제 모집 생성 및 삭제 시 이 채널에 로그가 기록됩니다.`,
    flags: 64,
  });
}

module.exports = { data, execute, sendLog };
