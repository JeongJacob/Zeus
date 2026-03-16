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

const DATA_DIR = path.join(__dirname, "../data/duo");

function loadGuildData(guildId) {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    const filePath = path.join(DATA_DIR, `${guildId}.json`);
    if (!fs.existsSync(filePath) || fs.statSync(filePath).size === 0) return {};
    const content = fs.readFileSync(filePath, "utf-8").trim();
    return content ? JSON.parse(content) : {};
  } catch (err) {
    console.error(`[${guildId}] 듀오 데이터 로드 실패 (초기화):`, err.message);
    return {};
  }
}

function saveGuildData(guildId, data) {
  try {
    const filePath = path.join(DATA_DIR, `${guildId}.json`);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
  } catch (err) {
    console.error(`[${guildId}] 듀오 데이터 저장 실패:`, err.message);
  }
}

const MAX_PLAYERS = 2;

const data = new SlashCommandBuilder()
  .setName("듀오")
  .setDescription("솔로랭크 듀오 모집을 시작합니다.");

async function execute(interaction) {
  if (!interaction.guild) {
    return interaction.reply({
      content: "서버에서만 명령어를 실행할 수 있습니다.",
      flags: 64,
    });
  }

  await interaction.reply({
    flags: 64,
    content: "듀오 모집 메시지를 생성 중입니다...",
  });

  try {
    const embed = new EmbedBuilder()
      .setTitle("🎯 솔로랭크 듀오 모집")
      .setDescription("아래 버튼을 클릭하여 게임 정보를 입력해주세요.")
      .setColor(0xe74c3c);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("duo_set_start_time")
        .setLabel("게임 정보 입력")
        .setStyle(ButtonStyle.Primary),
    );

    const msg = await interaction.channel.send({
      content: "@everyone",
      embeds: [embed],
      components: [row],
    });

    const guildId = interaction.guild.id;
    const guildLobby = loadGuildData(guildId);

    guildLobby[msg.id] = {
      creator: interaction.user.id,
      creatorName: null,
      startTime: null,
      players: {},
      // players 구조:
      // { userId: { nickname, tier, positions } }
      substitutes: [],
      messageId: msg.id,
      channelId: interaction.channel.id,
    };
    saveGuildData(guildId, guildLobby);

    await interaction.editReply({
      content: "✅ 듀오 모집이 성공적으로 생성되었습니다.",
    });
  } catch (err) {
    console.error("듀오 메시지 전송 실패:", err);
    await interaction.editReply({
      content: "❌ 메시지 전송 중 오류가 발생했습니다.",
    });
  }
}

async function handleDuoInteraction(interaction) {
  const guildId = interaction.guild?.id;
  if (!guildId) return;

  const customId = interaction.customId;
  if (!customId) return;

  const guildLobby = loadGuildData(guildId);
  const userId = interaction.user.id;

  const msgId = interaction.isModalSubmit()
    ? customId.split(":")[1]
    : interaction.message?.id;

  // 삭제 확인 버튼
  if (customId.startsWith("duo_delete_confirm:")) {
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
      saveGuildData(guildId, guildLobby);
      return interaction.update({
        content: "✅ 모집이 삭제되었습니다.",
        components: [],
      });
    } catch (e) {
      console.error("듀오 모집 삭제 실패:", e);
    }
  }

  if (customId === "duo_delete_cancel") {
    return interaction.update({
      content: "삭제가 취소되었습니다.",
      components: [],
    });
  }

  if (!msgId || !guildLobby[msgId]) {
    if (interaction.isButton() || interaction.isModalSubmit()) {
      return interaction.reply({
        content: "❌ 만료된 모집이거나 데이터를 찾을 수 없습니다.",
        flags: 64,
      });
    }
    return;
  }

  if (interaction.isButton()) {
    // 모집자 시작 시간 입력
    if (customId === "duo_set_start_time") {
      if (userId !== guildLobby[msgId].creator) {
        return interaction.reply({
          content: "당신은 이 모집을 생성한 사용자가 아닙니다.",
          flags: 64,
        });
      }
      const nickname =
        interaction.member?.displayName || interaction.user.username;
      const modal = new ModalBuilder()
        .setCustomId(`duo_time_modal:${msgId}`)
        .setTitle("듀오 시작 설정");

      const nameInput = new TextInputBuilder()
        .setCustomId("creator_name_input")
        .setLabel("모집자 닉네임")
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setValue(nickname.slice(0, 100));

      const timeInput = new TextInputBuilder()
        .setCustomId("start_time_input")
        .setLabel("게임 정보 입력")
        .setStyle(TextInputStyle.Short)
        .setPlaceholder("예: 시간/티어/비고")
        .setRequired(true);

      modal.addComponents(
        new ActionRowBuilder().addComponents(nameInput),
        new ActionRowBuilder().addComponents(timeInput),
      );
      return interaction.showModal(modal);
    }

    // 참가 버튼 클릭 → 닉네임/티어/포지션 입력 모달
    if (customId === "duo_join") {
      const playerCount = Object.keys(guildLobby[msgId].players).length;
      if (playerCount >= MAX_PLAYERS) {
        return interaction.reply({
          content: "❌ 이미 모집이 완료되었습니다.",
          flags: 64,
        });
      }
      if (guildLobby[msgId].players[userId]) {
        return interaction.reply({
          content: "❌ 이미 참가 중입니다.",
          flags: 64,
        });
      }

      const modal = new ModalBuilder()
        .setCustomId(`duo_join_modal:${msgId}`)
        .setTitle("듀오 참가 정보 입력");

      const nicknameInput = new TextInputBuilder()
        .setCustomId("nickname_input")
        .setLabel("롤 닉네임")
        .setStyle(TextInputStyle.Short)
        .setPlaceholder("예: Hide on bush#KR1")
        .setRequired(true);

      const tierInput = new TextInputBuilder()
        .setCustomId("tier_input")
        .setLabel("티어")
        .setStyle(TextInputStyle.Short)
        .setPlaceholder("예: 실버2, 에메랄드4 등")
        .setRequired(true);

      const positionInput = new TextInputBuilder()
        .setCustomId("position_input")
        .setLabel("포지션 (최대 2개)")
        .setStyle(TextInputStyle.Short)
        .setPlaceholder("예: 미드, 원딜")
        .setRequired(true);

      modal.addComponents(
        new ActionRowBuilder().addComponents(nicknameInput),
        new ActionRowBuilder().addComponents(tierInput),
        new ActionRowBuilder().addComponents(positionInput),
      );
      return interaction.showModal(modal);
    }

    // 예비 참가
    if (customId === "duo_substitute") {
      if (guildLobby[msgId].players[userId]) {
        return interaction.reply({
          content: "❌ 이미 참가 중입니다. 참여 취소 후 예비 참가해주세요.",
          flags: 64,
        });
      }
      if (!guildLobby[msgId].substitutes.includes(userId)) {
        guildLobby[msgId].substitutes.push(userId);
      }
      saveGuildData(guildId, guildLobby);
      return await updateEmbed(msgId, interaction, guildLobby[msgId]);
    }

    // 참여 취소
    if (customId === "duo_cancel") {
      delete guildLobby[msgId].players[userId];
      guildLobby[msgId].substitutes = guildLobby[msgId].substitutes.filter(
        (id) => id !== userId,
      );
      saveGuildData(guildId, guildLobby);
      return await updateEmbed(msgId, interaction, guildLobby[msgId]);
    }

    // 모집 삭제
    if (customId === "duo_delete") {
      const isCreator = userId === guildLobby[msgId].creator;
      const isAdmin = interaction.member.permissions.has("Administrator");

      if (!isCreator && !isAdmin) {
        return interaction.reply({
          content: "❌ 모집자 또는 관리자만 삭제할 수 있습니다.",
          flags: 64,
        });
      }

      return interaction.reply({
        content: "정말 모집을 삭제하시겠습니까?",
        flags: 64,
        components: [
          new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId(`duo_delete_confirm:${msgId}`)
              .setLabel("확인 ✅")
              .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
              .setCustomId("duo_delete_cancel")
              .setLabel("취소")
              .setStyle(ButtonStyle.Secondary),
          ),
        ],
      });
    }
  }

  // 시작 시간 모달 제출
  if (
    interaction.type === InteractionType.ModalSubmit &&
    customId.startsWith("duo_time_modal:")
  ) {
    guildLobby[msgId].creatorName =
      interaction.fields.getTextInputValue("creator_name_input");
    guildLobby[msgId].startTime =
      interaction.fields.getTextInputValue("start_time_input");
    saveGuildData(guildId, guildLobby);
    return await updateEmbed(msgId, interaction, guildLobby[msgId]);
  }

  // 참가 정보 모달 제출
  if (
    interaction.type === InteractionType.ModalSubmit &&
    customId.startsWith("duo_join_modal:")
  ) {
    const nickname = interaction.fields.getTextInputValue("nickname_input");
    const tier = interaction.fields.getTextInputValue("tier_input");
    const positions = interaction.fields.getTextInputValue("position_input");

    guildLobby[msgId].players[userId] = {
      nickname,
      tier,
      positions,
    };
    // 예비에서 제거
    guildLobby[msgId].substitutes = guildLobby[msgId].substitutes.filter(
      (id) => id !== userId,
    );
    saveGuildData(guildId, guildLobby);
    return await updateEmbed(msgId, interaction, guildLobby[msgId]);
  }
}

async function updateEmbed(msgId, interaction, partyData) {
  try {
    const msg =
      interaction.message || (await interaction.channel.messages.fetch(msgId));
    const { startTime, players, substitutes, creatorName } = partyData;

    const playerCount = Object.keys(players).length;
    const isFull = playerCount >= MAX_PLAYERS;

    // 참가자 목록 텍스트 생성
    const playerText = Object.entries(players)
      .map(
        ([uid, info], i) =>
          `${i + 1}번: <@${uid}>\n` +
          `　닉네임: ${info.nickname}\n` +
          `　티어: ${info.tier}\n` +
          `　포지션: ${info.positions}`,
      )
      .join("\n\n");

    const embed = new EmbedBuilder()
      .setTitle(
        isFull ? "🔒 솔로랭크 듀오 모집 (완료)" : "🎯 솔로랭크 듀오 모집",
      )
      .setDescription(
        `모집자: ${creatorName || "미입력"}\n` +
          `게임 정보: ${startTime || "미정"}\n\n` +
          `👥 참가자 (${playerCount}/${MAX_PLAYERS})\n` +
          `${playerText || "없음"}\n\n` +
          `예비 참가: ${substitutes.map((uid) => `<@${uid}>`).join(", ") || "없음"}`,
      )
      .setColor(isFull ? 0x95a5a6 : 0xe74c3c);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("duo_join")
        .setLabel(isFull ? "모집 완료" : "참가 🎯")
        .setStyle(ButtonStyle.Success)
        .setDisabled(isFull),
      new ButtonBuilder()
        .setCustomId("duo_substitute")
        .setLabel("예비 참가")
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId("duo_cancel")
        .setLabel("참여 취소")
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId("duo_delete")
        .setLabel("모집 삭제 🗑️")
        .setStyle(ButtonStyle.Danger),
    );

    await msg.edit({ embeds: [embed], components: [row] });
    if (!interaction.deferred && !interaction.replied)
      await interaction.deferUpdate();
  } catch (e) {
    console.error("듀오 Embed 업데이트 실패:", e);
  }
}

module.exports = { data, execute, handleDuoInteraction };
