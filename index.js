const { Client, GatewayIntentBits, Collection } = require("discord.js");
require("dotenv").config();

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

client.commands = new Collection();

// 명령어 모듈 로드
const party = require("./commands/party");
const scrim = require("./commands/scrim");
const puuid = require("./commands/puuid");
const match = require("./commands/match");
const clear = require("./commands/clear");
const help = require("./commands/help");

// 커맨드 등록
const commands = [party, scrim, puuid, match, clear, help];
commands.forEach((cmd) => {
  client.commands.set(cmd.data.name, cmd);
});

client.once("ready", async () => {
    console.log(`✅ 로그인됨: ${client.user.tag}`);

    try {
        // 1. 모든 길드(서버)의 명령어 삭제
        const guilds = await client.guilds.fetch();
        for (const [guildId, guild] of guilds) {
            const fullGuild = await guild.fetch();
            await fullGuild.commands.set([]); 
            console.log(`🧹 ${fullGuild.name} 서버 명령어 초기화 완료`);
        }

        // 2. 글로벌 명령어 삭제
        await client.application.commands.set([]);
        console.log("🧹 글로벌 명령어 초기화 완료");

        console.log("⚠️ 모든 명령어가 삭제되었습니다. 이제 이 코드를 지우고 다시 실행하세요.");
    } catch (err) {
        console.error("초기화 실패:", err);
    }
});

// client.once("ready", async () => {
//   console.log(`로그인됨: ${client.user.tag}`);
//   try {
//     const slashCommands = commands.map((cmd) => cmd.data.toJSON());
//     await client.application.commands.set(slashCommands);
//     console.log("슬래시 명령어 동기화 완료");
//   } catch (err) {
//     console.error("명령어 등록 실패:", err);
//   }
// });

// ⭐ 통합 인터랙션 리스너 (여기서 모든 것을 배분)
client.on("interactionCreate", async (interaction) => {
  // 1. 슬래시 명령어 처리
  if (interaction.isChatInputCommand()) {
    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    try {
      await command.execute(interaction);
    } catch (err) {
      console.error(err);
      if (!interaction.replied) {
        await interaction.reply({ content: "오류가 발생했습니다.", flags: 64 });
      }
    }
    return;
  }

  // 2. 버튼 및 모달 처리
  if (interaction.isButton() || interaction.isModalSubmit()) {
    const customId = interaction.customId;

    // ID 규칙에 따라 핸들러 배분
    if (customId.includes("scrim")) {
      await scrim.handleScrimInteraction(interaction);
    } else {
      // 자랭 모집(party) 및 기타 포지션 버튼 처리
      await party.handlePartyInteraction(interaction);
    }
  }
});

client.login(process.env.TOKEN);
