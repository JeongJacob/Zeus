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

function setupPartyHandlers(client) {
    // 슬래시 명령어 등록
    client.on("ready", () => {
        const commands = [new SlashCommandBuilder().setName("생성").setDescription("게임 모집을 시작합니다.")];
        client.application.commands.set(commands);
    });

    client.on("interactionCreate", async (interaction) => {
        if (interaction.isCommand()) {
            if (interaction.commandName === "생성") {
                const embed = new EmbedBuilder()
                    .setTitle("게임 모집 설정")
                    .setDescription("아래 버튼을 클릭하여 시작 시간을 입력해주세요.")
                    .setColor(0x00ff00);

                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId("set_start_time")
                        .setLabel("시작 시간 입력")
                        .setStyle(ButtonStyle.Primary)
                );

                const msg = await interaction.channel.send({
                    content: "@everyone",
                    embeds: [embed],
                    components: [row],
                });

                // 새로운 모집을 추가 (기존 모집을 삭제하지 않음)
                lobby[msg.id] = {
                    creator: interaction.user.id,
                    players: {},
                    substitutes: [],
                    messageId: msg.id,
                    startTime: null,
                    channelId: interaction.channel.id, // 채널 ID도 추가
                    isClosed: false, // 모집 상태 관리
                };

                await interaction.reply({ flags: 64, content: "게임 모집이 생성되었습니다." });
            }
        }

        if (!interaction.isButton() && interaction.type !== InteractionType.ModalSubmit) return;

        const msgId = interaction.message.id;
        if (!lobby[msgId]) return;

        const userId = interaction.user.id;
        const action = interaction.customId;

        if (action === "set_start_time") {
            if (userId !== lobby[msgId].creator) {
                return interaction.reply({ content: "❌ 당신은 이 모집을 생성한 사용자가 아닙니다.", ephemeral: true });
            }

            const modal = new ModalBuilder().setCustomId("start_time_modal").setTitle("게임 시작 시간 입력");
            const timeInput = new TextInputBuilder()
                .setCustomId("start_time_input")
                .setLabel("게임 시작 시간 입력")
                .setStyle(TextInputStyle.Short)
                .setPlaceholder("예: 지금 바로 시작, 20분 후, 18:30 등")
                .setRequired(true);

            modal.addComponents(new ActionRowBuilder().addComponents(timeInput));

            try {
                await interaction.showModal(modal);
            } catch (error) {
                console.error("❌ 모달 표시 오류:", error);
                return interaction.reply({ content: "❌ 모달 창을 표시할 수 없습니다.", ephemeral: true });
            }
        }

        if (interaction.type === InteractionType.ModalSubmit && action === "start_time_modal") {
            const startTime = interaction.fields.getTextInputValue("start_time_input");
            lobby[msgId].startTime = startTime;
            await updateEmbed(msgId, interaction);
        }

        if (action === "cancel") {
            removePlayer(msgId, userId);
            await updateEmbed(msgId, interaction);
        } else if (action === "substitute") {
            removePlayer(msgId, userId);
            if (!lobby[msgId].substitutes.includes(userId)) {
                lobby[msgId].substitutes.push(userId);
            }
            await updateEmbed(msgId, interaction);
        } else if (positions[action]) {
            if (lobby[msgId].players[action]) {
                return interaction.reply({ content: "❌ 이미 선택된 포지션입니다.", ephemeral: true });
            }

            removePlayer(msgId, userId);
            lobby[msgId].players[action] = userId;
            await updateEmbed(msgId, interaction);
        }

        // 모집 종료 버튼 처리
        if (action === "end_recruitment") {
            if (userId !== lobby[msgId].creator) {
                return interaction.reply({ content: "❌ 당신은 이 모집을 생성한 사용자가 아닙니다.", ephemeral: true });
            }

            // 모집 종료 처리
            lobby[msgId].isClosed = true;

            // 버튼 비활성화 및 모집 종료 알림
            const row = new ActionRowBuilder();
            for (const [role, emoji] of Object.entries(positions)) {
                row.addComponents(
                    new ButtonBuilder()
                        .setCustomId(role)
                        .setLabel(`${role} ${emoji}`)
                        .setStyle(ButtonStyle.Primary)
                        .setDisabled(true) // 모집 종료 후 모든 버튼 비활성화
                );
            }

            const extraRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId("substitute")
                    .setLabel("예비 참가")
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(true),
                new ButtonBuilder()
                    .setCustomId("cancel")
                    .setLabel("참여 취소")
                    .setStyle(ButtonStyle.Danger)
                    .setDisabled(true)
            );

            const embed = new EmbedBuilder()
                .setTitle("게임 모집 종료")
                .setDescription("이 모집은 종료되었습니다. 더 이상 참여할 수 없습니다.")
                .setColor(0xff0000);

            const msg = await interaction.channel.messages.fetch(msgId);
            await msg.edit({ embeds: [embed], components: [row, extraRow] });

            await interaction.reply({ content: "모집이 종료되었습니다.", ephemeral: true });
        }
    });
}

function removePlayer(msgId, userId) {
    for (const role in lobby[msgId].players) {
        if (lobby[msgId].players[role] === userId) {
            delete lobby[msgId].players[role];
            break;
        }
    }
    lobby[msgId].substitutes = lobby[msgId].substitutes.filter((uid) => uid !== userId);
}

async function updateEmbed(msgId, interaction) {
    const msg = await interaction.channel.messages.fetch(msgId);
    const { startTime, players, substitutes, isClosed } = lobby[msgId];

    const embed = new EmbedBuilder()
        .setTitle(isClosed ? "게임 모집 종료" : "게임 모집")
        .setDescription(
            `**게임 시작 시간:** ⏳ ${startTime || "미정"}\n\n` +
                Object.entries(players)
                    .map(([role, user]) => `${positions[role]} ${role}: <@${user}>`)
                    .join("\n") +
                `\n\n**예비 참가:** ${substitutes.map((uid) => `<@${uid}>`).join(", ") || "없음"}`
        )
        .setColor(isClosed ? 0xff0000 : 0x00ff00); // 종료된 모집은 빨간색

    const row = new ActionRowBuilder();
    for (const [role, emoji] of Object.entries(positions)) {
        row.addComponents(
            new ButtonBuilder()
                .setCustomId(role)
                .setLabel(`${role} ${emoji}`)
                .setStyle(ButtonStyle.Primary)
                .setDisabled(!!players[role] || isClosed) // 모집 종료시 비활성화
        );
    }

    // 모집 종료 버튼이 시간 설정 후에만 활성화되도록 추가
    const extraRow = new ActionRowBuilder();
    if (!isClosed && startTime) {
        extraRow.addComponents(
            new ButtonBuilder().setCustomId("end_recruitment").setLabel("모집 종료").setStyle(ButtonStyle.Danger)
        );
    }

    extraRow.addComponents(
        new ButtonBuilder()
            .setCustomId("substitute")
            .setLabel("예비 참가")
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(isClosed),
        new ButtonBuilder()
            .setCustomId("cancel")
            .setLabel("참여 취소")
            .setStyle(ButtonStyle.Danger)
            .setDisabled(isClosed)
    );

    await msg.edit({ embeds: [embed], components: [row, extraRow] });
    await interaction.deferUpdate();
}

module.exports = setupPartyHandlers;
