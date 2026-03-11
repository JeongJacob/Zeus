const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  InteractionType,
  SlashCommandBuilder,
} = require("discord.js");
const fs = require("fs");
const path = require("path");

// --- 서버별 데이터 관리 설정 ---
const DATA_DIR = path.join(__dirname, "../data/scrim.json");

// 서버별 데이터 로드 함수
function loadScrimData(guildId) {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    const filePath = path.join(DATA_DIR, `${guildId}.json`);

    if (!fs.existsSync(filePath) || fs.statSync(filePath).size === 0) return {};
    const content = fs.readFileSync(filePath, "utf-8").trim();
    return content ? JSON.parse(content) : {};
  } catch (err) {
    console.error(`[${guildId}] 내전 데이터 로드 실패:`, err.message);
    return {};
  }
}

// 서버별 데이터 저장 함수
function saveScrimData(guildId, data) {
  try {
    const filePath = path.join(DATA_DIR, `${guildId}.json`);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
  } catch (err) {
    console.error(`[${guildId}] 내전 데이터 저장 실패:`, err.message);
  }
}

const data = new SlashCommandBuilder()
  .setName("내전")
  .setDescription("내전을 모집합니다.");

async function execute(interaction) {
  if (!interaction.guild)
    return interaction.reply({
      content: "서버에서만 사용 가능합니다.",
      flags: 64,
    });

  const embed = new EmbedBuilder()
    .setTitle("내전 모집")
    .setDescription("게임 시작 시간을 설정하세요.")
    .setColor(0x3498db);

  const actionRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("scrim_set_start_time")
      .setLabel("시작 시간 입력")
      .setStyle(ButtonStyle.Primary),
  );

  const msg = await interaction.channel.send({
    content: "@everyone",
    embeds: [embed],
    components: [actionRow],
  });

  const guildId = interaction.guild.id;
  const guildLobby = loadScrimData(guildId);

  guildLobby[msg.id] = {
    participants: [],
    substitutes: [],
    creator: interaction.user.id,
    messageId: msg.id,
    startTime: null,
    isClosed: false,
    channelId: interaction.channel.id,
  };
  saveScrimData(guildId, guildLobby);

  await interaction.reply({
    flags: 64,
    content: "내전 모집이 생성되었습니다.",
  });
}

async function handleScrimInteraction(interaction) {
  const guildId = interaction.guild?.id;
  if (!guildId) return;

  const guildLobby = loadScrimData(guildId);
  const userId = interaction.user.id;
  const customId = interaction.customId;
  const msgId = interaction.isModalSubmit()
    ? customId.split(":")[1]
    : interaction.message.id;

  if (!msgId || !guildLobby[msgId]) {
    if (interaction.isButton() || interaction.isModalSubmit()) {
      return interaction.reply({
        content: "❌ 만료된 내전 데이터입니다.",
        flags: 64,
      });
    }
    return;
  }

  if (customId === "scrim_set_start_time") {
    if (userId !== guildLobby[msgId].creator) {
      return interaction.reply({
        content: "❌ 당신은 이 모집을 생성한 사용자가 아닙니다.",
        flags: 64,
      });
    }
    const modal = new ModalBuilder()
      .setCustomId(`scrim_modal:${msgId}`)
      .setTitle("게임 시작 시간 입력");
    const timeInput = new TextInputBuilder()
      .setCustomId("start_time_input")
      .setLabel("게임 시작 시간 입력")
      .setStyle(TextInputStyle.Short)
      .setPlaceholder("예: 지금 바로 시작, 20분 후, 18:30 등")
      .setRequired(true);
    modal.addComponents(new ActionRowBuilder().addComponents(timeInput));
    return interaction.showModal(modal);
  }

  if (
    interaction.type === InteractionType.ModalSubmit &&
    customId.startsWith("scrim_modal:")
  ) {
    guildLobby[msgId].startTime =
      interaction.fields.getTextInputValue("start_time_input");
    saveScrimData(guildId, guildLobby);
    await updateScrimEmbed(msgId, interaction, guildLobby[msgId]);
  }

  if (["join_scrim", "substitute_scrim", "cancel_scrim"].includes(customId)) {
    const lobby = guildLobby[msgId];
    if (customId === "join_scrim") {
      if (lobby.participants.includes(userId))
        return interaction.reply({ content: "이미 참가 중입니다.", flags: 64 });
      if (lobby.participants.length >= 10)
        return interaction.reply({
          content: "참가 인원이 가득 찼습니다.",
          flags: 64,
        });
      lobby.participants.push(userId);
      lobby.substitutes = lobby.substitutes.filter((id) => id !== userId);
    } else if (customId === "substitute_scrim") {
      if (!lobby.substitutes.includes(userId)) lobby.substitutes.push(userId);
      lobby.participants = lobby.participants.filter((id) => id !== userId);
    } else if (customId === "cancel_scrim") {
      lobby.participants = lobby.participants.filter((id) => id !== userId);
      lobby.substitutes = lobby.substitutes.filter((id) => id !== userId);
    }

    saveScrimData(guildId, guildLobby);
    await updateScrimEmbed(msgId, interaction, lobby);
  }
}

async function updateScrimEmbed(msgId, interaction, lobbyData) {
  try {
    const msg =
      interaction.message || (await interaction.channel.messages.fetch(msgId));
    const isFull = lobbyData.participants.length >= 10;

    const embed = new EmbedBuilder()
      .setTitle(isFull ? "🔥 내전 모집 (정원 완료)" : "⚔️ 내전 모집")
      .setDescription(
        `**게임 시작 시간:** ⏳ ${lobbyData.startTime || "미정"}\n\n` +
          `**참가자 (${lobbyData.participants.length}/10):**\n` +
          (lobbyData.participants.map((id) => `<@${id}>`).join("\n") ||
            "없음") +
          `\n\n**예비 참가자:**\n` +
          (lobbyData.substitutes.map((id) => `<@${id}>`).join("\n") || "없음"),
      )
      .setColor(isFull ? 0xe74c3c : 0x3498db);

    // 버튼: 풀방이면 참가 버튼 비활성화, 시간이 정해지면 항상 표시
    const joinRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("join_scrim")
        .setLabel(isFull ? "정원 완료" : "참가")
        .setStyle(ButtonStyle.Success)
        .setDisabled(isFull),
      new ButtonBuilder()
        .setCustomId("substitute_scrim")
        .setLabel("예비 참가")
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId("cancel_scrim")
        .setLabel("참가 취소")
        .setStyle(ButtonStyle.Danger),
    );

    await msg.edit({ embeds: [embed], components: [joinRow] });
    if (!interaction.deferred && !interaction.replied)
      await interaction.deferUpdate();
  } catch (e) {
    console.error("내전 임베드 업데이트 실패:", e);
  }
}

// 아래는 index.js용 명령어 초기화 주석 코드입니다. (보존)
/*
client.once("ready", async () => {
  console.log(`✅ 로그인됨: ${client.user.tag}`);

  try {
    // 1. 글로벌 명령어 전체 삭제
    await client.application.commands.set([]);
    console.log("🗑️ 글로벌 명령어 전체 삭제 완료");

    // 2. 모든 서버(길드)의 명령어 전체 삭제
    const guilds = await client.guilds.fetch();
    for (const [guildId, guild] of guilds) {
      await client.application.commands.set([], guildId);
      console.log(`🗑️ [${guild.name}] 서버 명령어 삭제 완료`);
    }

    console.log("✨ 모든 명령어가 초기화되었습니다. 이제 이 코드를 지우고 다시 동기화하세요.");
  } catch (error) {
    console.error("❌ 명령어 삭제 중 에러 발생:", error);
  }
});
*/

module.exports = { data, execute, handleScrimInteraction };
