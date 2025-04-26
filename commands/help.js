const { SlashCommandBuilder } = require("@discordjs/builders");

module.exports = {
    data: new SlashCommandBuilder().setName("도움말").setDescription("사용 가능한 봇 명령어를 안내합니다."),
    async execute(interaction) {
        return interaction.reply(
            "**🤖 사용 가능한 명령어 안내:**\n\n" +
                "`/id <Riot ID>`\n" +
                "➤ 해당 라이엇 계정의 PUUID를 조회합니다.\n" +
                "예시: `/id riotid: Radiohead#KR97`\n\n" +
                "`/전적 <puuid>`\n" +
                "➤ 최근 한 판의 전체 게임 정보를 조회합니다.\n" +
                "예시: `/전적 puuid: abc1234...`\n\n" +
                "`/생성`\n" +
                "➤ 롤 파티 모집을 시작합니다. (포지션 선택, 시작 시간 입력 등 가능)\n\n" +
                "`/도움말`\n" +
                "➤ 이 도움말 메시지를 다시 보여줍니다."
        );
    },
};
