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

// --- 라인 설정 ---
const LANE_EMOJIS = {
  top: "🗡️ 탑",
  jungle: "🌲 정글",
  mid: "⚡ 미드",
  adc: "🏹 원딜",
  support: "🛡️ 서포터",
};

const DATA_DIR = path.join(__dirname, "../data/scrim");

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
    .setDescription("내전 진행 모드를 설정하세요.")
    .setColor(0x3498db);

  const actionRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("scrim_set_start_time")
      .setLabel("게임 정보 입력")
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
    participants: [], // [{ userId, lanes: ["top","mid"] }, ...]
    substitutes: [], // [{ userId, lanes: [...] }, ...]
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

  const customId = interaction.customId;
  if (!customId) return;

  const guildLobby = loadScrimData(guildId);
  const userId = interaction.user.id;

  const msgId = interaction.isModalSubmit()
    ? customId.split(":")[1]
    : interaction.message?.id;

  // ── 삭제 확인 ──────────────────────────────────────────────
  if (customId.startsWith("scrim_delete_confirm:")) {
    const targetMsgId = customId.split(":")[1];
    try {
      const originalChannel = await interaction.client.channels
        .fetch(guildLobby[targetMsgId]?.channelId)
        .catch(() => null);
      if (originalChannel) {
        const originalMsg = await originalChannel.messages
          .fetch(targetMsgId)
          .catch(() => null);
        if (originalMsg) await originalMsg.delete().catch(() => null);
      }
      delete guildLobby[targetMsgId];
      saveScrimData(guildId, guildLobby);
      return interaction.update({
        content: "✅ 내전 모집이 삭제되었습니다.",
        components: [],
      });
    } catch (e) {
      console.error("내전 삭제 실패:", e);
    }
  }

  if (customId === "scrim_delete_cancel") {
    return interaction.update({
      content: "삭제가 취소되었습니다.",
      components: [],
    });
  }

  if (!msgId || !guildLobby[msgId]) {
    if (interaction.isButton() || interaction.isModalSubmit()) {
      return interaction.reply({
        content: "❌ 만료된 내전 데이터입니다.",
        flags: 64,
      });
    }
    return;
  }

  // ── 게임 정보 입력 버튼 ─────────────────────────────────────
  if (customId === "scrim_set_start_time") {
    if (userId !== guildLobby[msgId].creator) {
      return interaction.reply({
        content: "❌ 당신은 이 모집을 생성한 사용자가 아닙니다.",
        flags: 64,
      });
    }
    const modal = new ModalBuilder()
      .setCustomId(`scrim_modal:${msgId}`)
      .setTitle("내전 게임 모드 설정");
    const timeInput = new TextInputBuilder()
      .setCustomId("start_time_input")
      .setLabel("내전 게임 모드 설정")
      .setStyle(TextInputStyle.Short)
      .setPlaceholder("예: 시간/티어/비고")
      .setRequired(true);
    modal.addComponents(new ActionRowBuilder().addComponents(timeInput));
    return interaction.showModal(modal);
  }

  // ── 게임 정보 모달 제출 ─────────────────────────────────────
  if (
    interaction.type === InteractionType.ModalSubmit &&
    customId.startsWith("scrim_modal:")
  ) {
    guildLobby[msgId].startTime =
      interaction.fields.getTextInputValue("start_time_input");
    saveScrimData(guildId, guildLobby);
    return updateScrimEmbed(msgId, interaction, guildLobby[msgId]);
  }

  // ── 라인 선택 모달 제출 ─────────────────────────────────────
  if (
    interaction.type === InteractionType.ModalSubmit &&
    customId.startsWith("scrim_lane_modal:")
  ) {
    const lobby = guildLobby[msgId];

    const raw = interaction.fields
      .getTextInputValue("lane_input")
      .toLowerCase()
      .trim();
    // 쉼표/공백/슬래시 모두 구분자로 허용
    const tokens = raw.split(/[\s,/]+/).filter(Boolean);

    // 한글·영문 별칭 매핑
    const aliasMap = {
      탑: "top",
      top: "top",
      정글: "jungle",
      jungle: "jungle",
      jg: "jungle",
      미드: "mid",
      mid: "mid",
      원딜: "adc",
      원딭: "adc",
      adc: "adc",
      bot: "adc",
      서포터: "support",
      서폿: "support",
      support: "support",
      sup: "support",
    };

    const selectedLanes = [
      ...new Set(tokens.map((t) => aliasMap[t]).filter(Boolean)),
    ].slice(0, 2);

    if (selectedLanes.length === 0) {
      return interaction.reply({
        content:
          "❌ 올바른 라인을 입력해주세요.\n예: `탑`, `탑, 정글`, `mid adc`",
        flags: 64,
      });
    }

    // 이미 참가 중이면 라인만 업데이트
    const existingIdx = lobby.participants.findIndex(
      (p) => p.userId === userId,
    );
    if (existingIdx !== -1) {
      lobby.participants[existingIdx].lanes = selectedLanes;
    } else {
      if (lobby.participants.length >= 10) {
        return interaction.reply({
          content: "참가 인원이 가득 찼습니다.",
          flags: 64,
        });
      }
      // 예비 목록에서 제거 후 참가자에 추가
      lobby.substitutes = lobby.substitutes.filter((p) => p.userId !== userId);
      lobby.participants.push({ userId, lanes: selectedLanes });
    }

    saveScrimData(guildId, guildLobby);
    return updateScrimEmbed(msgId, interaction, lobby);
  }

  // ── 모집 삭제 버튼 ──────────────────────────────────────────
  if (customId === "scrim_delete") {
    const isCreator = userId === guildLobby[msgId].creator;
    const isAdmin = interaction.member.permissions.has("Administrator");
    if (!isCreator && !isAdmin) {
      return interaction.reply({
        content: "❌ 모집자 또는 관리자만 삭제할 수 있습니다.",
        flags: 64,
      });
    }
    return interaction.reply({
      content: "정말 내전 모집을 삭제하시겠습니까?",
      flags: 64,
      components: [
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`scrim_delete_confirm:${msgId}`)
            .setLabel("확인 ✅")
            .setStyle(ButtonStyle.Danger),
          new ButtonBuilder()
            .setCustomId("scrim_delete_cancel")
            .setLabel("취소")
            .setStyle(ButtonStyle.Secondary),
        ),
      ],
    });
  }

  // ── 참가 버튼 → 라인 선택 모달 표시 ───────────────────────
  if (customId === "join_scrim") {
    const lobby = guildLobby[msgId];
    if (lobby.isClosed) {
      return interaction.reply({ content: "❌ 마감된 모집입니다.", flags: 64 });
    }

    const alreadyIn = lobby.participants.find((p) => p.userId === userId);
    const currentLanesText = alreadyIn
      ? alreadyIn.lanes.map((l) => LANE_EMOJIS[l]).join(", ")
      : "";

    const modal = new ModalBuilder()
      .setCustomId(`scrim_lane_modal:${msgId}`)
      .setTitle("라인 선택 (최대 2개)");
    const laneInput = new TextInputBuilder()
      .setCustomId("lane_input")
      .setLabel("라인을 입력하세요 (최대 2개)")
      .setStyle(TextInputStyle.Short)
      .setPlaceholder("탑 / 정글 / 미드 / 원딜 / 서포터")
      .setValue(alreadyIn ? alreadyIn.lanes.join(", ") : "")
      .setRequired(true);
    modal.addComponents(new ActionRowBuilder().addComponents(laneInput));
    return interaction.showModal(modal);
  }

  // ── 예비 참가 버튼 ──────────────────────────────────────────
  if (customId === "substitute_scrim") {
    const lobby = guildLobby[msgId];

    const modal = new ModalBuilder()
      .setCustomId(`scrim_sub_lane_modal:${msgId}`)
      .setTitle("예비 라인 선택 (최대 2개)");
    const laneInput = new TextInputBuilder()
      .setCustomId("lane_input")
      .setLabel("라인을 입력하세요 (최대 2개)")
      .setStyle(TextInputStyle.Short)
      .setPlaceholder("탑 / 정글 / 미드 / 원딜 / 서포터")
      .setRequired(true);
    modal.addComponents(new ActionRowBuilder().addComponents(laneInput));
    return interaction.showModal(modal);
  }

  // ── 예비 라인 모달 제출 ─────────────────────────────────────
  if (
    interaction.type === InteractionType.ModalSubmit &&
    customId.startsWith("scrim_sub_lane_modal:")
  ) {
    const lobby = guildLobby[msgId];
    const raw = interaction.fields
      .getTextInputValue("lane_input")
      .toLowerCase()
      .trim();
    const tokens = raw.split(/[\s,/]+/).filter(Boolean);
    const aliasMap = {
      탑: "top",
      top: "top",
      정글: "jungle",
      jungle: "jungle",
      jg: "jungle",
      미드: "mid",
      mid: "mid",
      원딜: "adc",
      원딭: "adc",
      adc: "adc",
      bot: "adc",
      서포터: "support",
      서폿: "support",
      support: "support",
      sup: "support",
    };
    const selectedLanes = [
      ...new Set(tokens.map((t) => aliasMap[t]).filter(Boolean)),
    ].slice(0, 2);

    if (selectedLanes.length === 0) {
      return interaction.reply({
        content:
          "❌ 올바른 라인을 입력해주세요.\n예: `탑`, `탑, 정글`, `mid adc`",
        flags: 64,
      });
    }

    const existingSubIdx = lobby.substitutes.findIndex(
      (p) => p.userId === userId,
    );
    if (existingSubIdx !== -1) {
      lobby.substitutes[existingSubIdx].lanes = selectedLanes;
    } else {
      lobby.participants = lobby.participants.filter(
        (p) => p.userId !== userId,
      );
      lobby.substitutes.push({ userId, lanes: selectedLanes });
    }

    saveScrimData(guildId, guildLobby);
    return updateScrimEmbed(msgId, interaction, lobby);
  }

  // ── 참가 취소 버튼 ──────────────────────────────────────────
  // ── 참가 취소 버튼 ──────────────────────────────────────────
  if (customId === "cancel_scrim") {
    const lobby = guildLobby[msgId];
    const wasParticipant = lobby.participants.some((p) => p.userId === userId);

    lobby.participants = lobby.participants.filter((p) => p.userId !== userId);
    lobby.substitutes = lobby.substitutes.filter((p) => p.userId !== userId);

    if (
      wasParticipant &&
      lobby.participants.length < 10 &&
      lobby.substitutes.length > 0
    ) {
      const promoted = lobby.substitutes.shift();
      lobby.participants.push(promoted);

      try {
        const promotedUser = await interaction.client.users.fetch(
          promoted.userId,
        );
        await promotedUser
          .send(
            `✅ **내전 예비에서 본 참가자로 승격되었습니다!**\n` +
              `선택한 라인: ${promoted.lanes.map((l) => LANE_EMOJIS[l] ?? l).join(", ")}`,
          )
          .catch(() => null);
      } catch (_) {}
    }

    saveScrimData(guildId, guildLobby);
    return updateScrimEmbed(msgId, interaction, lobby);
  }
}

// ── 임베드 업데이트 ────────────────────────────────────────────
async function updateScrimEmbed(msgId, interaction, lobbyData) {
  try {
    const msg =
      interaction.message || (await interaction.channel.messages.fetch(msgId));
    const isFull = lobbyData.participants.length >= 10;

    // 참가자 한 줄: @멘션 + 라인 이모지
    const formatParticipant = ({ userId, lanes }) => {
      const laneStr =
        lanes && lanes.length > 0
          ? " · " + lanes.map((l) => LANE_EMOJIS[l] ?? l).join(", ")
          : "";
      return `<@${userId}>${laneStr}`;
    };

    const embed = new EmbedBuilder()
      .setTitle(isFull ? "🔥 내전 모집 (정원 완료)" : "⚔️ 내전 모집")
      .setDescription(
        `**게임 정보:** ⏳ ${lobbyData.startTime || "미정"}\n\n` +
          `**참가자 (${lobbyData.participants.length}/10):**\n` +
          (lobbyData.participants.map(formatParticipant).join("\n") || "없음") +
          `\n\n**예비 참가자:**\n` +
          (lobbyData.substitutes.map(formatParticipant).join("\n") || "없음"),
      )
      .setColor(isFull ? 0xe74c3c : 0x3498db);

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
      new ButtonBuilder()
        .setCustomId("scrim_delete")
        .setLabel("모집 삭제 🗑️")
        .setStyle(ButtonStyle.Danger),
    );

    await msg.edit({ embeds: [embed], components: [joinRow] });
    if (!interaction.deferred && !interaction.replied)
      await interaction.deferUpdate();
  } catch (e) {
    console.error("내전 임베드 업데이트 실패:", e);
  }
}

module.exports = { data, execute, handleScrimInteraction };
