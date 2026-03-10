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

let scrimLobby = {};

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
      .setStyle(ButtonStyle.Primary)
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
  };

  await interaction.reply({ flags: 64, content: "내전 모집이 생성되었습니다." });
}

async function handleScrimInteraction(interaction) {
  const userId = interaction.user.id;
  const customId = interaction.customId;
  const msgId = interaction.isModalSubmit() 
    ? customId.split(":")[1] 
    : interaction.message.id;

  if (!scrimLobby[msgId]) return;

  if (customId === "scrim_set_start_time") {
    if (userId !== scrimLobby[msgId].creator) {
      return interaction.reply({ content: "❌ 당신은 이 모집을 생성한 사용자가 아닙니다.", flags: 64 });
    }
    const modal = new ModalBuilder().setCustomId(`scrim_modal:${msgId}`).setTitle("게임 시작 시간 입력");
    const timeInput = new TextInputBuilder()
      .setCustomId("start_time_input").setLabel("게임 시작 시간 입력").setStyle(TextInputStyle.Short)
      .setPlaceholder("예: 지금 바로 시작, 20분 후, 18:30 등").setRequired(true);
    modal.addComponents(new ActionRowBuilder().addComponents(timeInput));
    return interaction.showModal(modal);
  }

  if (interaction.type === InteractionType.ModalSubmit && customId.startsWith("scrim_modal:")) {
    scrimLobby[msgId].startTime = interaction.fields.getTextInputValue("start_time_input");
    await updateScrimEmbed(msgId, interaction, true);
  }

  if (["join_scrim", "substitute_scrim", "cancel_scrim"].includes(customId)) {
    if (customId === "join_scrim") {
      if (scrimLobby[msgId].participants.includes(userId)) return interaction.reply({ content: "이미 참가 중입니다.", flags: 64 });
      if (scrimLobby[msgId].participants.length >= 10) return interaction.reply({ content: "참가 인원이 가득 찼습니다.", flags: 64 });
      scrimLobby[msgId].participants.push(userId);
      scrimLobby[msgId].substitutes = scrimLobby[msgId].substitutes.filter(id => id !== userId);
    } else if (customId === "substitute_scrim") {
      if (!scrimLobby[msgId].substitutes.includes(userId)) scrimLobby[msgId].substitutes.push(userId);
      scrimLobby[msgId].participants = scrimLobby[msgId].participants.filter(id => id !== userId);
    } else if (customId === "cancel_scrim") {
      scrimLobby[msgId].participants = scrimLobby[msgId].participants.filter(id => id !== userId);
      scrimLobby[msgId].substitutes = scrimLobby[msgId].substitutes.filter(id => id !== userId);
    }
    await updateScrimEmbed(msgId, interaction, false);
  }
}

async function updateScrimEmbed(msgId, interaction, showJoinButtons) {
  const msg = await interaction.channel.messages.fetch(msgId);
  const lobby = scrimLobby[msgId];
  const embed = new EmbedBuilder()
    .setTitle("내전 모집")
    .setDescription(
      `**게임 시작 시간:** ⏳ ${lobby.startTime || "미정"}\n\n` +
      `**참가자 (${lobby.participants.length}/10):**\n` +
      (lobby.participants.map(id => `<@${id}>`).join("\n") || "없음") +
      `\n\n**예비 참가자:**\n` +
      (lobby.substitutes.map(id => `<@${id}>`).join("\n") || "없음")
    ).setColor(0x3498db);

  let components = [];
  if (showJoinButtons || msg.components.length > 0) {
    const joinRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("join_scrim").setLabel("참가").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId("substitute_scrim").setLabel("예비 참가").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("cancel_scrim").setLabel("참가 취소").setStyle(ButtonStyle.Danger)
    );
    components = [joinRow];
  }

  await msg.edit({ embeds: [embed], components });
  if (!interaction.deferred && !interaction.replied) await interaction.deferUpdate();
}

module.exports = { data, execute, handleScrimInteraction };