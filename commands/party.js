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

const positions = {
  탑: "🛡️",
  정글: "🌲",
  미드: "⚔️",
  원딜: "🏹",
  서폿: "✨",
};

let lobby = {};

const data = new SlashCommandBuilder()
  .setName("자랭")
  .setDescription("게임 모집을 시작합니다.");

async function execute(interaction) {
  // 1. 채널 확인 및 즉시 응답 (봇이 터지는 것을 방지)
  if (!interaction.channel) {
    return interaction.reply({ content: "명령어를 실행할 채널을 찾을 수 없습니다.", flags: 64 });
  }

  // 봇이 생각 중임을 먼저 알림 (3초 제한 해결 및 안정성 확보)
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

    // 2. 채널에 메시지 전송 (에러 핸들링 추가)
    const msg = await interaction.channel.send({
      content: "@everyone",
      embeds: [embed],
      components: [row],
    });

    // 3. 데이터 저장
    lobby[msg.id] = {
      creator: interaction.user.id,
      creatorName: null,
      players: {},
      substitutes: [],
      any: [],
      messageId: msg.id,
      startTime: null,
      channelId: interaction.channel.id,
    };

    // 12시간 후 삭제 로직
    // setTimeout(async () => {
    //   try {
    //     if (!lobby[msg.id]) return;
    //     const channel = await interaction.client.channels.fetch(lobby[msg.id].channelId);
    //     const message = await channel.messages.fetch(msg.id);
    //     if (message) await message.delete();
    //     delete lobby[msg.id];
    //   } catch (error) {
    //     // Unknown Message 에러 등은 무시하도록 설정
    //     if (error.code !== 10008) console.error(`12시간 후 메시지 삭제 실패: ${error}`);
    //   }
    // }, 12 * 60 * 60 * 1000);

    // 응답 업데이트
    await interaction.editReply({ content: "✅ 게임 모집이 성공적으로 생성되었습니다." });

  } catch (err) {
    console.error("메시지 전송 실패:", err);
    await interaction.editReply({ content: "❌ 메시지 전송 중 오류가 발생했습니다." });
  }
}

// 버튼 및 모달 통합 핸들러
async function handlePartyInteraction(interaction) {
  const userId = interaction.user.id;
  const customId = interaction.customId;

  // 메시지 ID 추출
  const msgId = interaction.isModalSubmit()
    ? customId.split(":")[1]
    : interaction.message?.id;

  if (!msgId || !lobby[msgId]) return;

  if (interaction.isButton()) {
    if (customId === "party_set_start_time") {
      if (userId !== lobby[msgId].creator) {
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

    if (customId === "party_cancel") {
      removePlayer(msgId, userId);
    } else if (customId === "party_substitute") {
      removePlayer(msgId, userId);
      if (!lobby[msgId].substitutes.includes(userId))
        lobby[msgId].substitutes.push(userId);
    } else if (customId === "party_any") {
      removePlayer(msgId, userId);
      if (!lobby[msgId].any.includes(userId)) lobby[msgId].any.push(userId);
    } else if (positions[customId]) {
      if (lobby[msgId].players[customId]) {
        return interaction.reply({
          content: "이미 선택된 포지션입니다.",
          flags: 64,
        });
      }
      removePlayer(msgId, userId);
      lobby[msgId].players[customId] = userId;
    }
    await updateEmbed(msgId, interaction);
  }

  if (interaction.type === InteractionType.ModalSubmit) {
    if (customId.startsWith("party_modal:")) {
      lobby[msgId].creatorName = interaction.fields.getTextInputValue("creator_name_input");
      lobby[msgId].startTime = interaction.fields.getTextInputValue("start_time_input");
      await updateEmbed(msgId, interaction);
    }
  }
}

function removePlayer(msgId, userId) {
  if (!lobby[msgId]) return;
  for (const role in lobby[msgId].players) {
    if (lobby[msgId].players[role] === userId) {
      delete lobby[msgId].players[role];
      break;
    }
  }
  lobby[msgId].substitutes = lobby[msgId].substitutes.filter((uid) => uid !== userId);
  lobby[msgId].any = lobby[msgId].any.filter((uid) => uid !== userId);
}

async function updateEmbed(msgId, interaction) {
  try {
    const msg = await interaction.channel.messages.fetch(msgId);
    const { startTime, players, substitutes, creatorName, any } = lobby[msgId];

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
      new ButtonBuilder().setCustomId("party_any").setLabel("상관없음 🎲").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("party_substitute").setLabel("예비 참가").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("party_cancel").setLabel("참여 취소").setStyle(ButtonStyle.Danger),
    );

    await msg.edit({ embeds: [embed], components: [row1, row2] });
    if (!interaction.deferred && !interaction.replied) await interaction.deferUpdate();
  } catch (e) {
    console.error("Embed 업데이트 실패:", e);
  }
}

module.exports = { data, execute, handlePartyInteraction };