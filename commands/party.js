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

const DATA_DIR = path.join(__dirname, "../data/party");

function loadGuildData(guildId) {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    const filePath = path.join(DATA_DIR, `${guildId}.json`);
    if (!fs.existsSync(filePath) || fs.statSync(filePath).size === 0) return {};
    const content = fs.readFileSync(filePath, "utf-8").trim();
    return content ? JSON.parse(content) : {};
  } catch (err) {
    console.error(`[${guildId}] 데이터 로드 실패 (초기화):`, err.message);
    return {};
  }
}

function saveGuildData(guildId, data) {
  try {
    const filePath = path.join(DATA_DIR, `${guildId}.json`);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
  } catch (err) {
    console.error(`[${guildId}] 데이터 저장 실패:`, err.message);
  }
}

const positions = {
  탑: "🛡️",
  정글: "🌲",
  미드: "⚔️",
  원딜: "🏹",
  서폿: "✨",
};

const data = new SlashCommandBuilder()
  .setName("자랭")
  .setDescription("게임 모집을 시작합니다.");

async function execute(interaction) {
  if (!interaction.guild) {
    return interaction.reply({
      content: "서버에서만 명령어를 실행할 수 있습니다.",
      flags: 64,
    });
  }

  await interaction.reply({
    flags: 64,
    content: "게임 모집 메시지를 생성 중입니다...",
  });

  try {
    const embed = new EmbedBuilder()
      .setTitle("게임 모집 설정")
      .setDescription("아래 버튼을 클릭하여 시작 시간을 입력해주세요.")
      .setColor(0x00ff00);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("party_set_start_time")
        .setLabel("시작 시간 입력")
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
      players: {},
      substitutes: [],
      any: [],
      messageId: msg.id,
      startTime: null,
      channelId: interaction.channel.id,
    };
    saveGuildData(guildId, guildLobby);

    await interaction.editReply({
      content: "✅ 게임 모집이 성공적으로 생성되었습니다.",
    });
  } catch (err) {
    console.error("메시지 전송 실패:", err);
    await interaction.editReply({
      content: "❌ 메시지 전송 중 오류가 발생했습니다.",
    });
  }
}

async function handlePartyInteraction(interaction) {
  const guildId = interaction.guild?.id;
  if (!guildId) return;

  // ✅ customId를 맨 먼저 선언 (TDZ 방지)
  const customId = interaction.customId;
  if (!customId) return;

  const guildLobby = loadGuildData(guildId);
  const userId = interaction.user.id;

  const msgId = interaction.isModalSubmit()
    ? customId.split(":")[1]
    : interaction.message?.id;

  // ✅ party_delete_confirm 처리 (msgId 체크 전에 처리해야 함)
  if (customId.startsWith("party_delete_confirm:")) {
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
      console.error("모집 삭제 실패:", e);
    }
  }

  if (customId === "party_delete_cancel") {
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
    if (customId === "party_set_start_time") {
      if (userId !== guildLobby[msgId].creator) {
        return interaction.reply({
          content: "당신은 이 모집을 생성한 사용자가 아닙니다.",
          flags: 64,
        });
      }
      const nickname = interaction.member?.displayName || interaction.user.username;
      const modal = new ModalBuilder()
        .setCustomId(`party_modal:${msgId}`)
        .setTitle("게임 시작 설정");

      const nameInput = new TextInputBuilder()
        .setCustomId("creator_name_input")
        .setLabel("모집자 닉네임")
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setValue(nickname.slice(0, 100));

      const timeInput = new TextInputBuilder()
        .setCustomId("start_time_input")
        .setLabel("게임 시작 시간")
        .setStyle(TextInputStyle.Short)
        .setPlaceholder("예: 지금 바로 시작, 20분 후, 18:30 등")
        .setRequired(true);

      modal.addComponents(
        new ActionRowBuilder().addComponents(nameInput),
        new ActionRowBuilder().addComponents(timeInput),
      );
      return interaction.showModal(modal);
    }

    if (customId === "party_delete") {
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
              .setCustomId(`party_delete_confirm:${msgId}`)
              .setLabel("확인 ✅")
              .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
              .setCustomId("party_delete_cancel")
              .setLabel("취소")
              .setStyle(ButtonStyle.Secondary),
          ),
        ],
      });
    }

    if (customId === "party_cancel") {
      removePlayer(guildLobby[msgId], userId);
    } else if (customId === "party_substitute") {
      removePlayer(guildLobby[msgId], userId);
      if (!guildLobby[msgId].substitutes.includes(userId))
        guildLobby[msgId].substitutes.push(userId);
    } else if (customId === "party_any") {
      removePlayer(guildLobby[msgId], userId);
      if (!guildLobby[msgId].any.includes(userId))
        guildLobby[msgId].any.push(userId);
    } else if (positions[customId]) {
      if (guildLobby[msgId].players[customId]) {
        return interaction.reply({
          content: "이미 선택된 포지션입니다.",
          flags: 64,
        });
      }
      removePlayer(guildLobby[msgId], userId);
      guildLobby[msgId].players[customId] = userId;
    }

    saveGuildData(guildId, guildLobby);
    await updateEmbed(msgId, interaction, guildLobby[msgId]);
  }

  if (
    interaction.type === InteractionType.ModalSubmit &&
    customId.startsWith("party_modal:")
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
  for (const role in partyData.players) {
    if (partyData.players[role] === userId) {
      delete partyData.players[role];
      break;
    }
  }
  partyData.substitutes = partyData.substitutes.filter((uid) => uid !== userId);
  partyData.any = partyData.any.filter((uid) => uid !== userId);
}

async function updateEmbed(msgId, interaction, partyData) {
  try {
    const msg =
      interaction.message || (await interaction.channel.messages.fetch(msgId));
    const { startTime, players, substitutes, creatorName, any } = partyData;

    const positionText = Object.keys(positions)
      .map((role) => {
        const user = players[role];
        return `${positions[role]} ${role}: ${user ? `<@${user}>` : ""}`;
      })
      .join("\n");

    const embed = new EmbedBuilder()
      .setDescription(
        `모집자: ${creatorName || "미입력"}\n` +
          `게임 시작 시간: ${startTime || "미정"}\n\n` +
          `${positionText}\n\n` +
          `🎲 상관없음: ${any.map((u) => `<@${u}>`).join(", ") || ""}\n\n` +
          `예비 참가: ${substitutes.map((uid) => `<@${uid}>`).join(", ") || ""}`,
      )
      .setColor(0x00ff00);

    const row1 = new ActionRowBuilder();
    const row2 = new ActionRowBuilder();

    for (const [role, emoji] of Object.entries(positions)) {
      row1.addComponents(
        new ButtonBuilder()
          .setCustomId(role)
          .setLabel(`${role} ${emoji}`)
          .setStyle(ButtonStyle.Primary)
          .setDisabled(!!players[role]),
      );
    }

    row2.addComponents(
      new ButtonBuilder()
        .setCustomId("party_any")
        .setLabel("상관없음 🎲")
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId("party_substitute")
        .setLabel("예비 참가")
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId("party_cancel")
        .setLabel("참여 취소")
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId("party_delete")
        .setLabel("모집 삭제 🗑️")
        .setStyle(ButtonStyle.Danger),
    );

    await msg.edit({ embeds: [embed], components: [row1, row2] });
    if (!interaction.deferred && !interaction.replied)
      await interaction.deferUpdate();
  } catch (e) {
    console.error("Embed 업데이트 실패:", e);
  }
}

module.exports = { data, execute, handlePartyInteraction };