const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    SlashCommandBuilder,
    InteractionType,
} = require("discord.js");

let scrimLobby = {};

function setupScrimHandlers(client) {
    client.on("ready", async () => {
        try {
            await client.application.commands.create(
                new SlashCommandBuilder().setName("내전").setDescription("내전 모집을 시작합니다.")
            );
            console.log("✅ '/내전' 명령어 등록 완료");
        } catch (error) {
            console.error("❌ '/내전' 명령어 등록 실패:", error);
        }
    });

    client.on("interactionCreate", async (interaction) => {
        if (interaction.isCommand() && interaction.commandName === "내전") {
            const embed = new EmbedBuilder()
                .setTitle("내전 모집")
                .setDescription("게임 시작 시간을 설정하세요.")
                .setColor(0x3498db);

            const actionRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId("set_start_time")
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

        if (!interaction.isButton() && interaction.type !== InteractionType.ModalSubmit) return;

        const msgId = interaction.message?.id || interaction.customId?.split(":")[1];
        if (!scrimLobby[msgId]) return;

        const userId = interaction.user.id;
        const action = interaction.customId;

        if (action === "set_start_time") {
            if (userId !== scrimLobby[msgId].creator) {
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
            scrimLobby[msgId].startTime = startTime;

            await updateScrimEmbed(msgId, interaction, true); // true -> 버튼 추가
        }

        if (["join_scrim", "substitute_scrim", "cancel_scrim"].includes(action)) {
            if (action === "join_scrim") {
                if (scrimLobby[msgId].participants.includes(userId))
                    return interaction.reply({ content: "이미 참가 중입니다.", ephemeral: true });
                if (scrimLobby[msgId].participants.length >= 10)
                    return interaction.reply({ content: "참가 인원이 가득 찼습니다.", ephemeral: true });

                scrimLobby[msgId].participants.push(userId);
                scrimLobby[msgId].substitutes = scrimLobby[msgId].substitutes.filter((id) => id !== userId);
            }

            if (action === "substitute_scrim") {
                if (!scrimLobby[msgId].substitutes.includes(userId)) {
                    scrimLobby[msgId].substitutes.push(userId);
                }
                scrimLobby[msgId].participants = scrimLobby[msgId].participants.filter((id) => id !== userId);
            }

            if (action === "cancel_scrim") {
                scrimLobby[msgId].participants = scrimLobby[msgId].participants.filter((id) => id !== userId);
                scrimLobby[msgId].substitutes = scrimLobby[msgId].substitutes.filter((id) => id !== userId);
            }

            await updateScrimEmbed(msgId, interaction, false); // false -> 버튼 변경 없음
        }
    });
}

async function updateScrimEmbed(msgId, interaction, showJoinButtons) {
    const msg = await interaction.channel.messages.fetch(msgId);
    const lobby = scrimLobby[msgId];

    const embed = new EmbedBuilder()
        .setTitle("내전 모집")
        .setDescription(
            `**게임 시작 시간:** ⏳ ${lobby.startTime || "미정"}\n\n` +
                `**참가자 (${lobby.participants.length}/10):**\n` +
                (lobby.participants.map((id) => `<@${id}>`).join("\n") || "없음") +
                `\n\n**예비 참가자:**\n` +
                (lobby.substitutes.map((id) => `<@${id}>`).join("\n") || "없음")
        )
        .setColor(0x3498db);

    let components = [];

    if (showJoinButtons) {
        const joinRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId("join_scrim").setLabel("참가").setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId("substitute_scrim").setLabel("예비 참가").setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId("cancel_scrim").setLabel("참가 취소").setStyle(ButtonStyle.Danger)
        );
        components.push(joinRow);
    } else {
        components = msg.components; // 기존 버튼 유지
    }

    await msg.edit({ embeds: [embed], components });
    await interaction.deferUpdate();
}

module.exports = { setupScrimHandlers, scrimLobby };
