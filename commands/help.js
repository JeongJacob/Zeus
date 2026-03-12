const { SlashCommandBuilder } = require("@discordjs/builders");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("도움말")
    .setDescription("사용 가능한 봇 명령어를 안내합니다."),
  async execute(interaction) {
    return interaction.reply(
      "**🤖 사용 가능한 명령어 안내:**\n\n" +
        "`/자랭`\n" +
        "➤ 롤 자랭 파티 모집을 시작합니다. (포지션 선택, 시작 시간 입력 등 가능)\n\n" +
        "`/내전`\n" +
        "➤ 롤 내전 모집을 시작합니다. (10명 인원 제한, 시작 시간 입력 등 가능)\n\n" +
        "`/칼바람`\n" +
        "➤ 칼바람 나락 파티 모집을 시작합니다. (5명 인원 제한, 시작 시간 입력 등 가능)\n\n" +
        "`/롤체`\n" +
        "➤ 롤체 파티 모집을 시작합니다. (8명 인원 제한, 시작 시간 입력 등 가능)\n\n" +
        "`/지우개`\n" +
        "➤ 작성된 글을 지웁니다. (1~100개 갯수 입력 가능)\n\n" +
        "`/도움말`\n" +
        "➤ 이 도움말 메시지를 다시 보여줍니다.",
    );
  },
};
