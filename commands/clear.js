const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("지우개")
        .setDescription("채널의 최근 메시지를 삭제합니다.")
        .addIntegerOption(option =>
            option
                .setName("개수")
                .setDescription("삭제할 메시지 개수 (1~100)")
                .setRequired(true)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

    async execute(interaction) {
        const amount = interaction.options.getInteger("개수");

        if (amount < 1 || amount > 100) {
            return interaction.reply({
                content: "삭제할 메시지는 1~100개 사이로 입력해주세요.",
                ephemeral: true
            });
        }

        try {
            await interaction.channel.bulkDelete(amount, true);

            await interaction.reply({
                content: `🧹 ${amount}개의 메시지를 삭제했습니다.`,
                ephemeral: true
            });

        } catch (error) {
            console.error(error);

            await interaction.reply({
                content: "메시지를 삭제하는 중 오류가 발생했습니다.",
                ephemeral: true
            });
        }
    },
};