const { Client, GatewayIntentBits, Collection } = require("discord.js");
require("dotenv").config();

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

// 명령어 파일들
const getPuuidCommand = require("./commands/puuid");
const handleMatchCommand = require("./commands/match");
const handleClearCommand = require("./commands/clear");
const setupPartyHandlers = require("./commands/party");
const handleHelpCommand = require("./commands/help");
const { setupScrimHandlers } = require("./commands/scrim");

// 명령어 컬렉션
client.commands = new Collection();
client.commands.set(getPuuidCommand.data.name, getPuuidCommand);
client.commands.set(handleMatchCommand.data.name, handleMatchCommand);
client.commands.set(handleHelpCommand.data.name, handleHelpCommand);
client.commands.set(handleClearCommand.data.name, handleClearCommand);

// 봇 로그인 및 슬래시 명령어 등록
client.once("ready", async () => {
  console.log(`✅ 로그인됨: ${client.user.tag}`);

  try {
    const commands = client.commands.map((command) =>
      command.data.toJSON()
    );

    // 글로벌 슬래시 명령어 등록 (모든 서버)
    await client.application.commands.set(commands);

    console.log("✅ 글로벌 슬래시 명령어 등록 완료 (모든 서버 사용 가능)");
  } catch (error) {
    console.error("❌ 명령어 등록 중 오류 발생:", error);
  }
});

// interactionCreate 이벤트 처리
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isCommand()) return;

  const command = client.commands.get(interaction.commandName);

  if (!command) return;

  try {
    await command.execute(interaction);
  } catch (err) {
    console.error("❌ 명령어 실행 오류:", err);

    if (!interaction.replied) {
      await interaction.reply({
        content: "❌ 명령어 실행 중 오류가 발생했습니다.",
        ephemeral: true,
      });
    }
  }
});

// 파티 / 스크림 핸들러
setupPartyHandlers(client);
setupScrimHandlers(client);

// 봇 로그인
client.login(process.env.TOKEN).catch((err) => {
  console.error("❌ 봇 로그인 실패:", err);
  process.exit(1);
});

