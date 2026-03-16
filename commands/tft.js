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

const DATA_DIR = path.join(__dirname, "../data/tft");

function loadGuildData(guildId) {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    const filePath = path.join(DATA_DIR, `${guildId}.json`);
    if (!fs.existsSync(filePath) || fs.statSync(filePath).size === 0) return {};
    const content = fs.readFileSync(filePath, "utf-8").trim();
    return content ? JSON.parse(content) : {};
  } catch (err) {
    console.error(`[${guildId}] TFT 데이터 로드 실패 (초기화):`, err.message);
    return {};
  }
}

function saveGuildData(guildId, data) {
  try {
    const filePath = path.join(DATA_DIR, `${guildId}.json`);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
  } catch (err) {
    console.error(`[${guildId}] TFT 데이터 저장 실패:`, err.message);
  }
}

// TFT는 최대 8명
const MAX_PLAYERS = 8;

const data = new SlashCommandBuilder()
  .setName("롤체")
  .setDescription("TFT(전략적 팀 전투) 파티 모집을 시작합니다.");

async function execute(interaction) {
  if (!interaction.guild) {
    return interaction.reply({
      content: "서버에서만 명령어를 실행할 수 있습니다.",
      flags: 64,
    });
  }

  await interaction.reply({
    flags: 64,
    content: "TFT 모집 메시지를 생성 중입니다...",
  });

  try {
    const embed = new EmbedBuilder()
      .setTitle("🎲 TFT 파티 모집")
      .setDescription("아래 버튼을 클릭하여 게임 정보를 입력해주세요.")
      .setColor(0xffd700);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("tft_set_start_time")
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

    // players: { "1": userId, ..., "8": userId } 형태로 슬롯 관리
    guildLobby[msg.id] = {
      creator: interaction.user.id,
      creatorName: null,
      players: {},
      substitutes: [],
      messageId: msg.id,
      startTime: null,
      channelId: interaction.channel.id,
    };
    saveGuildData(guildId, guildLobby);

    await interaction.editReply({
      content: "✅ TFT 모집이 성공적으로 생성되었습니다.",
    });
  } catch (err) {
    console.error("TFT 메시지 전송 실패:", err);
    await interaction.editReply({
      content: "❌ 메시지 전송 중 오류가 발생했습니다.",
    });
  }
}

async function handleTftInteraction(interaction) {
  const guildId = interaction.guild?.id;
  if (!guildId) return;

  const customId = interaction.customId;
  if (!customId) return;

  const guildLobby = loadGuildData(guildId);
  const userId = interaction.user.id;

  const msgId = interaction.isModalSubmit()
    ? customId.split(":")[1]
    : interaction.message?.id;

  // 삭제 확인 버튼 처리
  if (customId.startsWith("tft_delete_confirm:")) {
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
      console.error("TFT 모집 삭제 실패:", e);
    }
  }

  if (customId === "tft_delete_cancel") {
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
    // 시작 시간 입력 모달
    if (customId === "tft_set_start_time") {
      if (userId !== guildLobby[msgId].creator) {
        return interaction.reply({
          content: "당신은 이 모집을 생성한 사용자가 아닙니다.",
          flags: 64,
        });
      }
      const nickname =
        interaction.member?.displayName || interaction.user.username;
      const modal = new ModalBuilder()
        .setCustomId(`tft_modal:${msgId}`)
        .setTitle("TFT 시작 설정");

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

    // 모집 삭제
    if (customId === "tft_delete") {
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
              .setCustomId(`tft_delete_confirm:${msgId}`)
              .setLabel("확인 ✅")
              .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
              .setCustomId("tft_delete_cancel")
              .setLabel("취소")
              .setStyle(ButtonStyle.Secondary),
          ),
        ],
      });
    }

    // 참여 취소
    if (customId === "tft_cancel") {
      removePlayer(guildLobby[msgId], userId);
      saveGuildData(guildId, guildLobby);
      return await updateEmbed(msgId, interaction, guildLobby[msgId]);
    }

    // 예비 참가
    if (customId === "tft_substitute") {
      removePlayer(guildLobby[msgId], userId);
      if (!guildLobby[msgId].substitutes.includes(userId)) {
        guildLobby[msgId].substitutes.push(userId);
      }
      saveGuildData(guildId, guildLobby);
      return await updateEmbed(msgId, interaction, guildLobby[msgId]);
    }

    // 슬롯 참가 버튼 (tft_slot_1 ~ tft_slot_8)
    if (customId.startsWith("tft_slot_")) {
      const slotNum = customId.replace("tft_slot_", ""); // "1" ~ "8"
      const players = guildLobby[msgId].players;

      if (players[slotNum]) {
        return interaction.reply({
          content: "이미 참가한 슬롯입니다.",
          flags: 64,
        });
      }

      removePlayer(guildLobby[msgId], userId);
      players[slotNum] = userId;
      saveGuildData(guildId, guildLobby);
      return await updateEmbed(msgId, interaction, guildLobby[msgId]);
    }
  }

  // 모달 제출 처리
  if (
    interaction.type === InteractionType.ModalSubmit &&
    customId.startsWith("tft_modal:")
  ) {
    guildLobby[msgId].creatorName =
      interaction.fields.getTextInputValue("creator_name_input");
    guildLobby[msgId].startTime =
      interaction.fields.getTextInputValue("start_time_input");
    saveGuildData(guildId, guildLobby);
    await updateEmbed(msgId, interaction, guildLobby[msgId]);
  }
}

function removePlayer(partyData, userId) {
  if (!partyData) return;
  for (const slot in partyData.players) {
    if (partyData.players[slot] === userId) {
      delete partyData.players[slot];
      break;
    }
  }
  partyData.substitutes = partyData.substitutes.filter((uid) => uid !== userId);
}

async function updateEmbed(msgId, interaction, partyData) {
  try {
    const msg =
      interaction.message || (await interaction.channel.messages.fetch(msgId));
    const { startTime, players, substitutes, creatorName } = partyData;

    const filledCount = Object.keys(players).length;

    // 슬롯 텍스트 (4명씩 두 줄로 보기 좋게)
    const slotText = Array.from({ length: MAX_PLAYERS }, (_, i) => {
      const slot = String(i + 1);
      const user = players[slot];
      return `${slot}번: ${user ? `<@${user}>` : ""}`;
    }).join("\n");

    const embed = new EmbedBuilder()
      .setTitle("🎲 TFT 파티 모집")
      .setDescription(
        `모집자: ${creatorName || "미입력"}\n` +
          `게임 시작 시간: ${startTime || "미정"}\n\n` +
          `👥 참가자 (${filledCount}/${MAX_PLAYERS})\n` +
          `${slotText}\n\n` +
          `예비 참가: ${substitutes.map((uid) => `<@${uid}>`).join(", ") || "없음"}`,
      )
      .setColor(0xffd700);

    // TFT는 8명 슬롯 → 버튼 5개 한도 때문에 두 행으로 나눔 (1~4 / 5~8)
    const row1 = new ActionRowBuilder();
    for (let i = 1; i <= 4; i++) {
      const slot = String(i);
      row1.addComponents(
        new ButtonBuilder()
          .setCustomId(`tft_slot_${slot}`)
          .setLabel(`${slot}번`)
          .setStyle(ButtonStyle.Primary)
          .setDisabled(!!players[slot]),
      );
    }

    const row2 = new ActionRowBuilder();
    for (let i = 5; i <= MAX_PLAYERS; i++) {
      const slot = String(i);
      row2.addComponents(
        new ButtonBuilder()
          .setCustomId(`tft_slot_${slot}`)
          .setLabel(`${slot}번`)
          .setStyle(ButtonStyle.Primary)
          .setDisabled(!!players[slot]),
      );
    }

    // 기타 버튼 행
    const row3 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("tft_substitute")
        .setLabel("예비 참가")
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId("tft_cancel")
        .setLabel("참여 취소")
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId("tft_delete")
        .setLabel("모집 삭제 🗑️")
        .setStyle(ButtonStyle.Danger),
    );

    await msg.edit({ embeds: [embed], components: [row1, row2, row3] });
    if (!interaction.deferred && !interaction.replied)
      await interaction.deferUpdate();
  } catch (e) {
    console.error("TFT Embed 업데이트 실패:", e);
  }
}

module.exports = { data, execute, handleTftInteraction };
