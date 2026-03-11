const { Client, GatewayIntentBits, Collection } = require("discord.js");
require("dotenv").config();

// 명령어 파일 로드
const party = require("./commands/party");
const scrim = require("./commands/scrim");
// 다른 명령어들이 있다면 여기에 추가 (예: const match = require("./commands/match");)

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

client.commands = new Collection();

// 명령어 등록
const commands = [party, scrim]; // 명칭 확인 (위에서 require한 변수명)
commands.forEach((cmd) => {
  if (cmd.data && cmd.data.name) {
    client.commands.set(cmd.data.name, cmd);
  }
});

client.once("ready", async () => {
  console.log(`✅ 로그인됨: ${client.user.tag}`);

  // 슬래시 명령어 동기화 (필요할 때만 주석 해제하여 사용하세요)
  /*
  try {
    const commandData = commands.map((cmd) => cmd.data.toJSON());
    await client.application.commands.set(commandData);
    console.log("✅ 슬래시 명령어 동기화 완료");
  } catch (error) {
    console.error("❌ 명령어 동기화 실패:", error);
  }
  */
});

// ⭐ 통합 인터랙션 리스너
client.on("interactionCreate", async (interaction) => {
  // 1. 슬래시 명령어 처리
  if (interaction.isChatInputCommand()) {
    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    try {
      await command.execute(interaction);
    } catch (error) {
      console.error(`❌ 명령어 실행 에러 (${interaction.commandName}):`, error);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: "명령어 실행 중 오류가 발생했습니다.",
          flags: 64,
        });
      }
    }
    return; // 실행 후 종료 (버튼 로직으로 넘어가지 않게 함)
  }

  // 2. 버튼 및 모달 처리
  if (interaction.isButton() || interaction.isModalSubmit()) {
    const customId = interaction.customId;
    if (!customId) return;

    try {
      // customId에 'scrim'이 포함되어 있으면 scrim.js로, 나머지는 party.js로 배분
      // (만약 다른 기능이 추가되면 else if를 늘려가면 됩니다)
      if (customId.includes("scrim")) {
        await scrim.handleScrimInteraction(interaction);
      } else if (
        customId.includes("party") ||
        customId.startsWith("party") ||
        // party.js의 포지션 버튼(탑, 정글 등)은 한글이므로 예외 처리
        ["탑", "정글", "미드", "원딜", "서폿"].some((p) => customId.includes(p))
      ) {
        await party.handlePartyInteraction(interaction);
      }
    } catch (error) {
      console.error("❌ 인터랙션 핸들링 에러:", error);
    }
  }
});

// 에러 발생 시 봇이 완전히 죽지 않도록 방지
process.on("unhandledRejection", (error) => {
  console.error("⚠️ 처리되지 않은 약속 거부:", error);
});

client.login(process.env.TOKEN);
