const { Client, GatewayIntentBits, Collection } = require("discord.js");
require("dotenv").config();

// 1. 명령어 파일 로드
const party = require("./commands/party");
const normal = require("./commands/normal");
const scrim = require("./commands/scrim");
const clear = require("./commands/clear");
const help = require("./commands/help");
const aram = require("./commands/aram"); // ✅ 칼바람
const tft = require("./commands/tft"); // ✅ TFT
const duo = require("./commands/duo");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

client.commands = new Collection();

// 2. 명령어 배열 구성
const commands = [party, scrim, clear, help, aram, tft, normal, duo]; // ✅ aram, tft 추가

// 컬렉션에 등록
commands.forEach((cmd) => {
  if (cmd.data && cmd.data.name) {
    client.commands.set(cmd.data.name, cmd);
    console.log(`📦 로드된 명령어: ${cmd.data.name}`);
  } else {
    console.log("⚠️ 명령어를 로드하지 못했습니다. (data.name 누락)");
  }
});

client.once("ready", async () => {
  console.log(`✅ 로그인됨: ${client.user.tag}`);

  try {
    const commandData = commands.map((cmd) => cmd.data.toJSON());
    console.log(`🔄 ${commandData.length}개의 명령어 동기화 시작...`);

    // 글로벌 명령어 등록
    await client.application.commands.set(commandData);
    console.log("✅ 글로벌 명령어 동기화 요청 완료");

    // 각 서버(길드)마다 즉시 동기화 (이게 떠야 채팅창에 바로 나옵니다)
    //     const guilds = await client.guilds.fetch();
    //     for (const [guildId, guild] of guilds) {
    //       try {
    //         await client.application.commands.set(commandData, guildId);
    //         console.log(
    //           `✅ [${guild.name || guildId}] 서버 명령어 즉시 동기화 완료`,
    //         );
    //       } catch (err) {
    //         console.error(`❌ [${guildId}] 서버 동기화 실패:`, err.message);
    //       }
    //     }
  } catch (error) {
    console.error("❌ 전체 명령어 동기화 중 에러 발생:", error);
  }
});

// client.once("ready", async () => {
//   console.log(`✅ 로그인됨: ${client.user.tag}`);

//   try {
//     // 1. 글로벌 명령어 전체 삭제
//     await client.application.commands.set([]);
//     console.log("🗑️ 글로벌 명령어 전체 삭제 완료");

//     // 2. 모든 서버(길드)의 명령어 전체 삭제
//     const guilds = await client.guilds.fetch();
//     for (const [guildId, guild] of guilds) {
//       await client.application.commands.set([], guildId);
//       console.log(`🗑️ [${guild.name}] 서버 명령어 삭제 완료`);
//     }

//     console.log("✨ 모든 명령어가 초기화되었습니다. 이제 이 코드를 지우고 다시 동기화하세요.");
//   } catch (error) {
//     console.error("❌ 명령어 삭제 중 에러 발생:", error);
//   }
// });

// 인터랙션 리스너
client.on("interactionCreate", async (interaction) => {
  if (interaction.isChatInputCommand()) {
    const command = client.commands.get(interaction.commandName);
    if (!command) return;
    try {
      await command.execute(interaction);
    } catch (error) {
      console.error(error);
    }
    return;
  }

  if (interaction.isButton() || interaction.isModalSubmit()) {
    const customId = interaction.customId;
    if (!customId) return;

if (customId.includes("scrim")) {
  await scrim.handleScrimInteraction(interaction);
} else if (customId.includes("aram")) {
  await aram.handleAramInteraction(interaction);
} else if (customId.includes("tft")) {
  await tft.handleTftInteraction(interaction);
} else if (customId.includes("duo")) {
  await duo.handleDuoInteraction(interaction);
} else if (customId.includes("normal")) {
  await normal.handleNormalInteraction(interaction);
} else {
  await party.handlePartyInteraction(interaction);
}
  }
});

client.login(process.env.TOKEN);
