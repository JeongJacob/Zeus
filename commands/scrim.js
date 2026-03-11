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

// --- JSON 데이터 관리 로직 ---
const dataPath = path.join(__dirname, "../data/scrim.json");

function loadScrimLobby() {
  try {
    const dirPath = path.dirname(dataPath);
    if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
    if (!fs.existsSync(dataPath))
      fs.writeFileSync(dataPath, JSON.stringify({}));
    return JSON.parse(fs.readFileSync(dataPath, "utf-8"));
  } catch (err) {
    console.error("내전 데이터 로드 실패:", err);
    return {};
  }
}

function saveScrimLobby(data) {
  try {
    fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("내전 데이터 저장 실패:", err);
  }
}

// 봇 실행 시 데이터 불러오기
let scrimLobby = loadScrimLobby();

const data = new SlashCommandBuilder()
  .setName("내전")
  .setDescription("내전을 모집합니다.");

async function execute(interaction) {
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

  scrimLobby[msg.id] = {
    participants: [],
    substitutes: [],
    creator: interaction.user.id,
    messageId: msg.id,
    startTime: null,
    isClosed: false,
    channelId: interaction.channel.id, // 삭제 로직용 채널 ID 추가
  };
  saveScrimLobby(scrimLobby);

  await interaction.reply({
    flags: 64,
    content: "내전 모집이 생성되었습니다.",
  });
}

async function handleScrimInteraction(interaction) {
  const userId = interaction.user.id;
  const customId = interaction.customId;
  const msgId = interaction.isModalSubmit()
    ? customId.split(":")[1]
    : interaction.message.id;

  if (!scrimLobby[msgId]) {
    if (interaction.isButton() || interaction.isModalSubmit()) {
      return interaction.reply({
        content: "❌ 만료된 내전 데이터입니다.",
        flags: 64,
      });
    }
    return;
  }

  if (customId === "scrim_set_start_time") {
    if (userId !== scrimLobby[msgId].creator) {
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
    scrimLobby[msgId].startTime =
      interaction.fields.getTextInputValue("start_time_input");
    saveScrimLobby(scrimLobby);
    await updateScrimEmbed(msgId, interaction);
  }

  if (["join_scrim", "substitute_scrim", "cancel_scrim"].includes(customId)) {
    if (customId === "join_scrim") {
      if (scrimLobby[msgId].participants.includes(userId))
        return interaction.reply({ content: "이미 참가 중입니다.", flags: 64 });
      if (scrimLobby[msgId].participants.length >= 10)
        return interaction.reply({
          content: "참가 인원이 가득 찼습니다.",
          flags: 64,
        });

      scrimLobby[msgId].participants.push(userId);
      scrimLobby[msgId].substitutes = scrimLobby[msgId].substitutes.filter(
        (id) => id !== userId,
      );
    } else if (customId === "substitute_scrim") {
      if (!scrimLobby[msgId].substitutes.includes(userId))
        scrimLobby[msgId].substitutes.push(userId);
      scrimLobby[msgId].participants = scrimLobby[msgId].participants.filter(
        (id) => id !== userId,
      );
    } else if (customId === "cancel_scrim") {
      scrimLobby[msgId].participants = scrimLobby[msgId].participants.filter(
        (id) => id !== userId,
      );
      scrimLobby[msgId].substitutes = scrimLobby[msgId].substitutes.filter(
        (id) => id !== userId,
      );
    }

    saveScrimLobby(scrimLobby);
    await updateScrimEmbed(msgId, interaction);
  }
}

async function updateScrimEmbed(msgId, interaction) {
  try {
    const msg = await interaction.channel.messages.fetch(msgId);
    const lobby = scrimLobby[msgId];

    const isFull = lobby.participants.length >= 10;

    const embed = new EmbedBuilder()
      .setTitle(isFull ? "🔥 내전 모집 (정원 완료)" : "⚔️ 내전 모집")
      .setDescription(
        `**게임 시작 시간:** ⏳ ${lobby.startTime || "미정"}\n\n` +
          `**참가자 (${lobby.participants.length}/10):**\n` +
          (lobby.participants.map((id) => `<@${id}>`).join("\n") || "없음") +
          `\n\n**예비 참가자:**\n` +
          (lobby.substitutes.map((id) => `<@${id}>`).join("\n") || "없음"),
      )
      .setColor(isFull ? 0xe74c3c : 0x3498db);

    // 버튼 상태 업데이트: 풀방이면 참가 버튼 비활성화
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
    console.error("내전 Embed 업데이트 실패:", e);
  }
}

module.exports = { data, execute, handleScrimInteraction };
