const {
  Client,
  GatewayIntentBits,
  Collection,
  EmbedBuilder,
} = require("discord.js");
require("dotenv").config();

// 1. 명령어 파일 로드
const party = require("./commands/party");
const normal = require("./commands/normal");
const scrim = require("./commands/scrim");
const clear = require("./commands/clear");
const help = require("./commands/help");
const aram = require("./commands/aram");
const tft = require("./commands/tft");
const duo = require("./commands/duo");
const log = require("./commands/log");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

client.commands = new Collection();

// 2. 명령어 배열 구성
const commands = [party, scrim, clear, help, aram, tft, normal, duo, log];

// 컬렉션에 등록
commands.forEach((cmd) => {
  if (cmd.data && cmd.data.name) {
    client.commands.set(cmd.data.name, cmd);
    console.log(`📦 로드된 명령어: ${cmd.data.name}`);
  } else {
    console.log("⚠️ 명령어를 로드하지 못했습니다. (data.name 누락)");
  }
});

client.once("ready", async () => {
  console.log(`✅ 로그인됨: ${client.user.tag}`);

  // ── 서버 정보 출력 ──────────────────────────────────────
  console.log(`\n📊 총 서버 수: ${client.guilds.cache.size}`);
  for (const guild of client.guilds.cache.values()) {
    try {
      const fetchedGuild = await guild.fetch();

      console.log(`\n📌 서버명: ${fetchedGuild.name}`);
      console.log(`   🆔 서버 ID: ${fetchedGuild.id}`);
      console.log(`   👑 소유자 ID: ${fetchedGuild.ownerId}`);
      console.log(`   👥 멤버 수: ${fetchedGuild.memberCount}`);
      console.log(
        `   📅 생성일: ${fetchedGuild.createdAt.toLocaleDateString("ko-KR")}`,
      );
      console.log(`   🌍 지역: ${fetchedGuild.preferredLocale}`);
      console.log(`   💬 채널 수: ${fetchedGuild.channels.cache.size}`);

      try {
        const invites = await fetchedGuild.invites.fetch();
        if (invites.size === 0) {
          console.log(`   🔗 초대링크: 없음`);
        } else {
          invites.forEach((invite) => {
            console.log(`   🔗 초대링크: https://discord.gg/${invite.code}`);
          });
        }
      } catch (e) {
        console.log(`   ❌ 초대링크 권한 없음`);
      }
    } catch (e) {
      console.log(`❌ 서버 정보 fetch 실패: ${e.message}`);
    }
  }
  console.log("\n");
  // ────────────────────────────────────────────────────────

  try {
    const commandData = commands.map((cmd) => cmd.data.toJSON());
    console.log(`🔄 ${commandData.length}개의 명령어 동기화 시작...`);
    await client.application.commands.set(commandData);
    console.log("✅ 글로벌 명령어 동기화 요청 완료");
  } catch (error) {
    console.error("❌ 전체 명령어 동기화 중 에러 발생:", error);
  }
});

// ── 로그 명령어 목록 (로그를 남길 명령어) ─────────────────
const LOG_COMMANDS = ["자랭", "일반", "내전", "칼바람", "롤체", "듀오"];

// ── 모드별 이모지 ──────────────────────────────────────────
const MODE_EMOJI = {
  자랭: "🏹",
  일반: "🎮",
  내전: "⚔️",
  칼바람: "❄️",
  롤체: "🎲",
  듀오: "🎯",
};

// 인터랙션 리스너
client.on("interactionCreate", async (interaction) => {
  if (interaction.isChatInputCommand()) {
    const command = client.commands.get(interaction.commandName);
    if (!command) return;
    try {
      await command.execute(interaction);

      // ✅ 모집 생성 로그 (지우개, 도움말, 로그채널 제외)
      if (LOG_COMMANDS.includes(interaction.commandName)) {
        const emoji = MODE_EMOJI[interaction.commandName] || "📋";
        const embed = new EmbedBuilder()
          .setTitle(`${emoji} 모집 생성`)
          .setColor(0x3498db)
          .addFields(
            {
              name: "명령어",
              value: `/${interaction.commandName}`,
              inline: true,
            },
            {
              name: "생성자",
              value: `<@${interaction.user.id}>`,
              inline: true,
            },
            {
              name: "채널",
              value: `<#${interaction.channelId}>`,
              inline: true,
            },
          )
          .setTimestamp();
        await log.sendLog(client, interaction.guild?.id, embed);
      }
    } catch (error) {
      console.error(error);
    }
    return;
  }

  if (interaction.isButton() || interaction.isModalSubmit()) {
    const customId = interaction.customId;
    if (!customId) return;

    // ✅ 모집 삭제 로그
    const isDeleteConfirm =
      customId.startsWith("party_delete_confirm:") ||
      customId.startsWith("normal_delete_confirm:") ||
      customId.startsWith("aram_delete_confirm:") ||
      customId.startsWith("tft_delete_confirm:") ||
      customId.startsWith("scrim_delete_confirm:") ||
      customId.startsWith("duo_delete_confirm:");

    if (isDeleteConfirm) {
      const modeMap = {
        party: "자랭",
        normal: "일반",
        aram: "칼바람",
        tft: "롤체",
        scrim: "내전",
        duo: "듀오",
      };
      const prefix = customId.split("_delete_confirm:")[0];
      const modeName = modeMap[prefix] || prefix;
      const emoji = MODE_EMOJI[modeName] || "📋";

      const embed = new EmbedBuilder()
        .setTitle(`${emoji} 모집 삭제`)
        .setColor(0xe74c3c)
        .addFields(
          { name: "모드", value: modeName, inline: true },
          { name: "삭제자", value: `<@${interaction.user.id}>`, inline: true },
          { name: "채널", value: `<#${interaction.channelId}>`, inline: true },
        )
        .setTimestamp();
      await log.sendLog(client, interaction.guild?.id, embed);
    }

    // 라우팅
    if (customId.includes("scrim")) {
      await scrim.handleScrimInteraction(interaction);
    } else if (customId.includes("aram")) {
      await aram.handleAramInteraction(interaction);
    } else if (customId.includes("tft")) {
      await tft.handleTftInteraction(interaction);
    } else if (customId.includes("duo")) {
      await duo.handleDuoInteraction(interaction);
    } else if (customId.includes("normal")) {
      await normal.handleNormalInteraction(interaction);
    } else {
      await party.handlePartyInteraction(interaction);
    }
  }
});

client.login(process.env.TOKEN);
